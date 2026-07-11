<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ACESFilmicToneMapping,
		AmbientLight,
		Box3,
		Color,
		Group,
		HemisphereLight,
		Mesh,
		MeshBasicMaterial,
		MeshStandardMaterial,
		Object3D,
		PerspectiveCamera,
		PlaneGeometry,
		PMREMGenerator,
		PointLight,
		Scene,
		Vector2,
		Vector3,
		WebGLRenderer
	} from 'three';
	// post-processing: without a bloom pass the divine/overdrive emissives read as merely
	// brighter matte. bloom is the single biggest step from "webgl demo" to "forged instrument".
	import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
	import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
	import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
	import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
	import type { Envelope } from '$lib/envelope';
	import { scoreEnvelope } from '$lib/score';
	import { cap } from '$lib/format';
	import { resolveTheme, glowColor } from '$lib/render/themes';
	import { cpuChip, gpuCard, ramSticks, driveUnit, osBadge, type Part } from '$lib/render/parts';
	import { buildStage } from '$lib/render/stage';
	import { makeRng } from '$lib/render/rng';

	let { envelope }: { envelope: Envelope } = $props();

	// built once in onMount; the parent re-keys to show a different rig (a card is a fixed
	// object, not reactive state).
	let host: HTMLDivElement;
	let labelLayer: HTMLDivElement;
	const FOV = 45;
	const CAM_Z = 9;
	const DEG = Math.PI / 180;

	onMount(() => {
		const profile = scoreEnvelope(envelope);
		const theme = resolveTheme(profile.e);
		const glow = glowColor(profile.visual.heat, envelope.seed);
		// per-part heat: each block burns to its OWN score's point on the card's palette, so a
		// monster gpu blazes warm while a weak cpu stays cool — the "unbalanced rigs look
		// unbalanced" law. the overall `glow` still drives the scene + HUD so chrome stays coherent.
		const partGlow = (score: number) => glowColor(score, envelope.seed);
		const rng = makeRng(envelope.seed);
		const specs = envelope.specs;

		const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		// filmic tone mapping rolls off the hot divine emissives so highlights keep their shape
		// instead of clipping to flat gold.
		renderer.toneMapping = ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.15;
		host.appendChild(renderer.domElement);

		const scene = new Scene();
		const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
		camera.position.set(0, 0, CAM_Z);

		// image-based lighting from a DARK studio: a near-black surround with one soft overhead
		// panel and a glow-tinted rim. metal now reflects a moody gradient with a single highlight
		// streak — reading as polished metal in a dark rig, the way the aesthetic wants — instead
		// of the flat matte it was. a bright room env would wash the heat colour out to white; this
		// also does the job the extra `fill` light was faking, so that light drops right down.
		const envScene = new Scene();
		envScene.background = new Color(0x090a0d);
		const keyPanel = new Mesh(new PlaneGeometry(26, 9), new MeshBasicMaterial({ color: 0xd7dee8 }));
		keyPanel.position.set(2, 10, -1);
		keyPanel.rotation.x = Math.PI / 2; // faces down onto the loadout
		envScene.add(keyPanel);
		const rimPanel = new Mesh(
			new PlaneGeometry(16, 4),
			new MeshBasicMaterial({ color: glow.clone().multiplyScalar(0.5) })
		);
		rimPanel.position.set(-9, -4, 3);
		envScene.add(rimPanel);
		const pmrem = new PMREMGenerator(renderer);
		const envTex = pmrem.fromScene(envScene, 0.5).texture;
		scene.environment = envTex;
		scene.environmentIntensity = 0.55;
		keyPanel.geometry.dispose();
		rimPanel.geometry.dispose();

		scene.add(new AmbientLight(0xffffff, theme.ambient));
		scene.add(new HemisphereLight(0xbfc6cc, 0x0a0a0c, 0.5 + profile.e * 0.4));
		const key = new PointLight(0xffffff, 45 + profile.e * 35); // hard specular off the metal
		key.position.set(3, 4, 5);
		const rim = new PointLight(glow.getHex(), 25 + profile.e * 45); // tier-tinted edge light
		rim.position.set(-4, -2, -3);
		const fill = new PointLight(0xffffff, 8); // light touch now that IBL lifts the shadows
		fill.position.set(0, 2, 8);
		scene.add(key, rim, fill);

		// bloom chain. threshold sits above lit-metal luminance so only the glowing seams and
		// emissive parts bloom, never the whole plate. strength tracks the rig's energy and
		// kicks harder in overdrive — the "ascension" the score promises and nothing delivered.
		const composer = new EffectComposer(renderer);
		composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		composer.addPass(new RenderPass(scene, camera));
		const bloomStrength =
			0.22 + profile.visual.energy * 0.42 + (profile.visual.overdrive ? 0.18 : 0);
		// threshold above 1.0 keeps lit metal and mid emissives out of the bloom so only the
		// truly hot cores flare — radiant, but the hardware stays legible (the first law).
		const bloom = new UnrealBloomPass(new Vector2(1, 1), bloomStrength, 0.55, 1.05);
		composer.addPass(bloom);
		// OutputPass applies the renderer's ACES tone-map + sRGB *after* bloom, so highlights
		// roll off instead of clipping to flat white.
		composer.addPass(new OutputPass());

		const stage = buildStage(scene, glow, profile.visual.energy, rng, theme.name, key, rim);

		// assemble the loadout, then place each piece. a label is pinned to every part's anchor
		// so name + value travel with it. positions are loose; a fit pass scales to frame after.
		const content = new Group();
		const spinners: Array<(t: number) => void> = [];
		const breath: MeshStandardMaterial[] = [];
		const labels: Array<{ anchor: Object3D; name: string; value: string }> = [];

		const place = (part: Part, x: number, y: number, name: string, value: string) => {
			part.object.position.set(x, y, 0);
			content.add(part.object);
			breath.push(...part.materials);
			if (part.spin) spinners.push(part.spin);
			labels.push({ anchor: part.anchor, name, value });
		};

		const isMobile = host.clientWidth / host.clientHeight < 0.9;

		const gpu = specs.gpus[0];
		const gpuValue = gpu ? gpu.model + (gpu.vram_mb ? ' · ' + cap(gpu.vram_mb) : '') : 'no gpu';
		const gpuX = 0;
		const gpuY = isMobile ? 2.2 : 1.1;
		place(gpuCard(theme, profile.parts.gpu, partGlow(profile.parts.gpu), rng), gpuX, gpuY, 'gpu', gpuValue + (specs.gpus.length > 1 ? ` +${specs.gpus.length - 1}` : ''));

		const cpuX = isMobile ? -1.2 : -3.3;
		const cpuY = isMobile ? 0.7 : 0.5;
		place(cpuChip(theme, profile.parts.cpu, partGlow(profile.parts.cpu), rng), cpuX, cpuY, 'cpu', specs.cpu.model);

		const modules = specs.ram.modules.map((m) => m.size_mb);
		const modulesToRender = modules.slice(0, 4);
		const ramX = isMobile ? 1.2 : 3.3;
		const ramY = isMobile ? 0.8 : 0.6;
		place(
			ramSticks(theme, profile.parts.ram, modulesToRender, partGlow(profile.parts.ram), rng),
			ramX,
			ramY,
			'ram',
			cap(specs.ram.total_mb) + (modules.length ? ` · ${modules.length}×` : '')
		);

		const drives = specs.drives;
		const drivesToRender = drives.slice(0, 4);
		drivesToRender.forEach((d, i) => {
			let dx = 0;
			let dy = 0;
			if (isMobile) {
				if (i === 0) {
					dx = 1.2;
					dy = -0.7;
				} else if (i === 1 && drivesToRender.length === 2) {
					dx = 0;
					dy = -1.8;
				} else if (drivesToRender.length === 3) {
					dx = i === 1 ? -0.7 : 0.7;
					dy = -1.8;
				} else {
					// 4 drives or more
					dx = i === 1 ? -1.2 : i === 2 ? 0 : 1.2;
					dy = -1.8;
				}
			} else {
				dx = (i - (drivesToRender.length - 1) / 2) * 1.5;
				dy = -2.0;
			}

			let name: string = d.kind;
			let value = cap(d.size_mb);
			if (i === 3 && drives.length > 4) {
				const remainingDrives = drives.slice(3);
				const totalRemainingSize = remainingDrives.reduce((sum, rd) => sum + rd.size_mb, 0);
				name = 'other drives';
				value = `+${remainingDrives.length} · ${cap(totalRemainingSize)}`;
			}
			place(driveUnit(theme, profile.parts.storage, d.kind, d.size_mb / 1024, value, partGlow(profile.parts.storage), rng), dx, dy, name, value);
		});

		const osX = isMobile ? -1.2 : -3.3;
		const osY = isMobile ? -0.7 : -2.0;
		place(osBadge(theme, specs.machine.os, glow, rng), osX, osY, 'os', specs.machine.os);

		// fit pass: centre content on the rig origin, scale to the frustum, so any part count
		// obeys the single-viewport law. recomputed on resize.
		const box = new Box3().setFromObject(content);
		const size = box.getSize(new Vector3());
		const center = box.getCenter(new Vector3());
		content.position.set(-center.x, -center.y, -center.z);

		const rig = new Group();
		rig.add(content);
		scene.add(rig);
		const hx = size.x / 2;
		const hy = size.y / 2;
		const fit = (aspect: number) => {
			const halfH = Math.tan((FOV * DEG) / 2) * CAM_Z;
			const halfW = halfH * aspect;
			rig.scale.setScalar(Math.min((halfW * 0.84) / hx, (halfH * 0.7) / hy));
		};

		// one html label per part, projected from its 3d anchor each frame so it tracks parallax.
		const els = labels.map((l) => {
			const el = document.createElement('div');
			el.className = 'plabel';

			const lnSpan = document.createElement('span');
			lnSpan.className = 'ln';
			lnSpan.textContent = l.name;

			const lvSpan = document.createElement('span');
			lvSpan.className = 'lv';
			lvSpan.textContent = l.value;

			el.appendChild(lnSpan);
			el.appendChild(lvSpan);
			labelLayer.appendChild(el);
			return el;
		});
		const tmp = new Vector3();
		const projectLabels = (w: number, h: number) => {
			for (let i = 0; i < labels.length; i++) {
				labels[i].anchor.getWorldPosition(tmp).project(camera);
				const behind = tmp.z > 1;
				els[i].style.opacity = behind ? '0' : '1';
				els[i].style.transform = `translate(-50%, -100%) translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px)`;
			}
		};

		// idle: fans spin, an emissive breath at the power's energy, slow particle drift.
		const TAU = Math.PI * 2;
		// the idle "breath". kept modest at the top end so a hot core pulses without spiking
		// past the bloom threshold into a blown-out white every cycle.
		const pulseAmt = 0.1 + profile.visual.energy * 0.22;
		const base = breath.map((m) => m.emissiveIntensity);

		// drag-to-orbit with inertia. when at rest the rig eases its pitch back to level and
		// resumes a slow turntable, so an untouched card still shows it lives in 3d — and unlike
		// the old absolute-cursor parallax, this works under touch (pointer events + touch-action).
		let velY = 0;
		let velX = 0;
		let dragging = false;
		let lastX = 0;
		let lastY = 0;

		const start = performance.now();
		let raf = 0;
		const tick = () => {
			const t = (performance.now() - start) / 1000;
			const b = 1 + pulseAmt * Math.sin(t * profile.visual.pulseHz * TAU);
			// a slow idle float so the loadout hangs in space with weight, not pinned to a plane.
			rig.position.y = Math.sin(t * 0.45) * 0.06;

			// apply orbit momentum when the pointer is up; ease pitch back to level and drift into
			// a lazy turntable once the fling has died down.
			if (!dragging) {
				rig.rotation.y += velY;
				rig.rotation.x = Math.max(-0.7, Math.min(0.7, rig.rotation.x + velX));
				velY *= 0.94;
				velX *= 0.94;
				rig.rotation.x += (0 - rig.rotation.x) * 0.02;
				if (Math.abs(velY) < 0.0006) rig.rotation.y += 0.0016;
			}
			for (const s of spinners) s(t);
			breath.forEach((m, i) => (m.emissiveIntensity = base[i] * b));
			if (stage.animate) {
				stage.animate(t);
			} else {
				stage.particles.rotation.y = t * 0.02;
			}
			composer.render();
			projectLabels(host.clientWidth, host.clientHeight);
			raf = requestAnimationFrame(tick);
		};
		tick();

		// grab-and-spin. dragging writes rotation directly and records a velocity; the tick loop
		// carries that velocity as inertia once released.
		const onDown = (e: PointerEvent) => {
			dragging = true;
			lastX = e.clientX;
			lastY = e.clientY;
			velY = 0;
			velX = 0;
			host.style.cursor = 'grabbing';
			try {
				host.setPointerCapture(e.pointerId);
			} catch {
				/* not all pointer types support capture */
			}
		};
		const onMove = (e: PointerEvent) => {
			if (!dragging) return;
			velY = (e.clientX - lastX) * 0.006;
			velX = (e.clientY - lastY) * 0.006;
			lastX = e.clientX;
			lastY = e.clientY;
			rig.rotation.y += velY;
			rig.rotation.x = Math.max(-0.7, Math.min(0.7, rig.rotation.x + velX));
		};
		const onUp = () => {
			dragging = false;
			host.style.cursor = 'grab';
		};
		host.style.cursor = 'grab';
		host.addEventListener('pointerdown', onDown);
		host.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);

		const resize = () => {
			const { clientWidth: w, clientHeight: h } = host;
			renderer.setSize(w, h);
			composer.setSize(w, h);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			fit(camera.aspect);
		};
		const ro = new ResizeObserver(resize);
		ro.observe(host);
		resize();

		return () => {
			cancelAnimationFrame(raf);
			host.removeEventListener('pointerdown', onDown);
			host.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			ro.disconnect();
			for (const el of els) el.remove();
			// free gpu memory: geometries, materials and the procedural textures we minted. the
			// /dev harness re-keys often, so without this the canvas textures would pile up.
			scene.traverse((o) => {
				const mesh = o as { geometry?: { dispose(): void }; material?: MeshStandardMaterial | MeshStandardMaterial[] };
				mesh.geometry?.dispose();
				const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
				for (const mat of mats) {
					mat.map?.dispose();
					mat.bumpMap?.dispose();
					mat.dispose();
				}
			});
			composer.dispose();
			envTex.dispose();
			pmrem.dispose();
			renderer.dispose();
			renderer.domElement.remove();
		};
	});
</script>

<div class="card3d">
	<div bind:this={host} class="stage"></div>
	<div bind:this={labelLayer} class="labels"></div>
	<div class="vignette"></div>
</div>

<style>
	.card3d {
		position: relative;
		width: 100%;
		height: 100%;
	}
	.stage {
		width: 100%;
		height: 100%;
		touch-action: none;
	}
	.stage :global(canvas) {
		display: block;
	}
	.labels {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
	}
	/* a part label: dim category over a bright value, pinned above the part with a leader line
	   + dot dropping to the part's anchor so the association is unambiguous. */
	.labels :global(.plabel) {
		position: absolute;
		top: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.05rem;
		padding-bottom: 16px; /* room for the leader so the dot lands on the part */
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		line-height: 1.1;
		text-shadow: 0 1px 5px rgba(0, 0, 0, 0.95);
		transition: opacity 0.2s;
		max-width: 130px;
	}
	@media (min-width: 640px) {
		.labels :global(.plabel) {
			max-width: 220px;
		}
	}
	/* leader line from the text down to the part. */
	.labels :global(.plabel::after) {
		content: '';
		position: absolute;
		left: 50%;
		bottom: 3px;
		width: 1px;
		height: 13px;
		transform: translateX(-50%);
		background: linear-gradient(to bottom, rgba(150, 158, 166, 0.7), rgba(150, 158, 166, 0));
	}
	/* the pin dot where the leader meets the part. */
	.labels :global(.plabel::before) {
		content: '';
		position: absolute;
		left: 50%;
		bottom: 1px;
		width: 4px;
		height: 4px;
		transform: translateX(-50%);
		background: #c7ccd1;
		box-shadow: 0 0 4px rgba(0, 0, 0, 0.9);
	}
	.labels :global(.plabel .ln) {
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #888f97;
		width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: center;
		white-space: nowrap;
	}
	.labels :global(.plabel .lv) {
		font-size: 0.82rem;
		letter-spacing: 0.02em;
		color: #e8ebee;
		width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: center;
		white-space: nowrap;
	}
	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(ellipse at center, transparent 50%, rgba(4, 4, 6, 0.7) 100%);
	}
</style>
