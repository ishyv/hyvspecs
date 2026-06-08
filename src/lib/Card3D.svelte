<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ACESFilmicToneMapping,
		AmbientLight,
		Box3,
		Group,
		HemisphereLight,
		MeshStandardMaterial,
		Object3D,
		PerspectiveCamera,
		PointLight,
		Scene,
		Vector3,
		WebGLRenderer
	} from 'three';
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

		scene.add(new AmbientLight(0xffffff, theme.ambient));
		scene.add(new HemisphereLight(0xbfc6cc, 0x0a0a0c, 0.5 + profile.e * 0.4));
		const key = new PointLight(0xffffff, 45 + profile.e * 35); // hard specular off the metal
		key.position.set(3, 4, 5);
		const rim = new PointLight(glow.getHex(), 25 + profile.e * 45); // tier-tinted edge light
		rim.position.set(-4, -2, -3);
		const fill = new PointLight(0xffffff, 22); // keeps camera-facing faces off black
		fill.position.set(0, 2, 8);
		scene.add(key, rim, fill);

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

		const gpu = specs.gpus[0];
		const gpuValue = gpu ? gpu.model + (gpu.vram_mb ? ' · ' + cap(gpu.vram_mb) : '') : 'no gpu';
		place(gpuCard(theme, profile.parts.gpu, glow, rng), 0, 1.1, 'gpu', gpuValue + (specs.gpus.length > 1 ? ` +${specs.gpus.length - 1}` : ''));
		place(cpuChip(theme, profile.parts.cpu, glow, rng), -3.3, 0.5, 'cpu', specs.cpu.model);

		const modules = specs.ram.modules.map((m) => m.size_mb);
		const modulesToRender = modules.slice(0, 4);
		place(
			ramSticks(theme, profile.parts.ram, modulesToRender, glow, rng),
			3.3,
			0.6,
			'ram',
			cap(specs.ram.total_mb) + (modules.length ? ` · ${modules.length}×` : '')
		);

		const drives = specs.drives;
		const drivesToRender = drives.slice(0, 4);
		drivesToRender.forEach((d, i) => {
			const x = (i - (drivesToRender.length - 1) / 2) * 1.5;
			let name: string = d.kind;
			let value = cap(d.size_mb);
			if (i === 3 && drives.length > 4) {
				const remainingDrives = drives.slice(3);
				const totalRemainingSize = remainingDrives.reduce((sum, rd) => sum + rd.size_mb, 0);
				name = 'other drives';
				value = `+${remainingDrives.length} · ${cap(totalRemainingSize)}`;
			}
			place(driveUnit(theme, profile.parts.storage, d.kind, d.size_mb / 1024, value, glow, rng), x, -2.0, name, value);
		});

		place(osBadge(theme, specs.machine.os, glow, rng), -3.3, -2.0, 'os', specs.machine.os);

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
		const pulseAmt = 0.12 + profile.visual.energy * 0.4;
		const base = breath.map((m) => m.emissiveIntensity);
		const start = performance.now();
		let raf = 0;
		const tick = () => {
			const t = (performance.now() - start) / 1000;
			const b = 1 + pulseAmt * Math.sin(t * profile.visual.pulseHz * TAU);
			for (const s of spinners) s(t);
			breath.forEach((m, i) => (m.emissiveIntensity = base[i] * b));
			if (stage.animate) {
				stage.animate(t);
			} else {
				stage.particles.rotation.y = t * 0.02;
			}
			renderer.render(scene, camera);
			projectLabels(host.clientWidth, host.clientHeight);
			raf = requestAnimationFrame(tick);
		};
		tick();

		// pointer parallax — the loadout is an object in space, not a flat image. kept gentle so
		// the labels stay readable.
		const onMove = (e: PointerEvent) => {
			const r = host.getBoundingClientRect();
			const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
			const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
			rig.rotation.y = nx * 0.18;
			rig.rotation.x = ny * 0.12;
		};
		host.addEventListener('pointermove', onMove);

		const resize = () => {
			const { clientWidth: w, clientHeight: h } = host;
			renderer.setSize(w, h);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			fit(camera.aspect);
		};
		const ro = new ResizeObserver(resize);
		ro.observe(host);
		resize();

		return () => {
			cancelAnimationFrame(raf);
			host.removeEventListener('pointermove', onMove);
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
