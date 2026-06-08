<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AmbientLight,
		Box3,
		Group,
		HemisphereLight,
		MeshStandardMaterial,
		PerspectiveCamera,
		PointLight,
		Scene,
		Vector3,
		WebGLRenderer
	} from 'three';
	import type { Envelope } from '$lib/envelope';
	import { scoreEnvelope } from '$lib/score';
	import { resolveTheme, glowColor } from '$lib/render/themes';
	import { cpuCore, gpuCore, type Core } from '$lib/render/cores';
	import { ramNode, storageNode, osNode, trace } from '$lib/render/nodes';
	import { buildStage } from '$lib/render/stage';
	import { makeRng } from '$lib/render/rng';

	let { envelope }: { envelope: Envelope } = $props();

	// the scene is built once in onMount; to show a different rig the parent re-keys this
	// component (a card is a fixed object, not reactive state).
	let host: HTMLDivElement;
	const FOV = 45;
	const CAM_Z = 9;
	const DEG = Math.PI / 180;

	onMount(() => {
		const profile = scoreEnvelope(envelope);
		const theme = resolveTheme(profile.e);
		const glow = glowColor(profile.visual.heat);
		const rng = makeRng(envelope.seed);
		const specs = envelope.specs;

		const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		host.appendChild(renderer.domElement);

		const scene = new Scene();
		const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
		camera.position.set(0, 0, CAM_Z);

		// light is the world's, not white: ambient floor + a glow-tinted rim so the metal
		// reads its tier. metalness needs something to reflect, hence the hemisphere fill.
		scene.add(new AmbientLight(0xffffff, theme.ambient));
		scene.add(new HemisphereLight(0xbfc6cc, 0x0a0a0c, 0.4 + profile.e * 0.4));
		const key = new PointLight(0xffffff, 30 + profile.e * 40);
		key.position.set(3, 4, 5);
		const rim = new PointLight(glow.getHex(), 20 + profile.e * 50);
		rim.position.set(-4, -2, -3);
		scene.add(key, rim);

		const stage = buildStage(scene, glow, profile.visual.energy, rng);

		// build every block, then place it. positions are authored in a loose space and the
		// whole thing is scaled to fit afterwards, so node count never breaks the frame.
		const content = new Group();
		const cores: Core[] = [];
		const breath: MeshStandardMaterial[] = [];

		const cpu = cpuCore(theme, profile.parts.cpu, glow, rng);
		const gpu = gpuCore(theme, profile.parts.gpu, glow, rng);
		const cpuAt = new Vector3(-2.6, 0.8, 0);
		const gpuAt = new Vector3(2.6, 0.8, 0);
		cpu.object.position.copy(cpuAt);
		gpu.object.position.copy(gpuAt);
		cores.push(cpu, gpu);

		const ram = ramNode(theme, profile.parts.ram, specs.ram.modules.map((m) => m.size_mb), glow, rng);
		const storage = storageNode(
			theme,
			profile.parts.storage,
			specs.drives.map((d) => ({ sizeMb: d.size_mb, kind: d.kind })),
			glow,
			rng
		);
		const os = osNode(theme, glow, rng);
		const ramAt = new Vector3(-3.0, -1.9, 0);
		const storageAt = new Vector3(0, -2.2, 0);
		const osAt = new Vector3(3.0, -1.9, 0);
		ram.object.position.copy(ramAt);
		storage.object.position.copy(storageAt);
		os.object.position.copy(osAt);

		// the circuit: secondary nodes wired up to the heroes, and the two heroes linked. the
		// connective tissue that makes the parts read as one powered figure.
		const d = profile.visual.density;
		content.add(
			trace(cpuAt, gpuAt, glow, d),
			trace(ramAt, cpuAt, glow, d),
			trace(storageAt, cpuAt, glow, d),
			trace(storageAt, gpuAt, glow, d),
			trace(osAt, gpuAt, glow, d)
		);

		for (const b of [cpu, gpu, ram, storage, os]) {
			content.add(b.object);
			breath.push(...b.materials);
		}

		// fit pass: centre the content on the rig origin and scale it to the frustum, so the
		// single-viewport law holds for one drive or seven. recomputed on resize.
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
			rig.scale.setScalar(Math.min((halfW * 0.82) / hx, (halfH * 0.74) / hy));
		};

		// idle: core spin + an emissive breath whose rate/depth is the power's energy, plus a
		// slow particle drift.
		const TAU = Math.PI * 2;
		const pulseAmt = 0.15 + profile.visual.energy * 0.5;
		const base = breath.map((m) => m.emissiveIntensity);
		const start = performance.now();
		let raf = 0;
		const tick = () => {
			const t = (performance.now() - start) / 1000;
			const b = 1 + pulseAmt * Math.sin(t * profile.visual.pulseHz * TAU);
			for (const c of cores) c.spin(t);
			breath.forEach((m, i) => (m.emissiveIntensity = base[i] * b));
			stage.particles.rotation.y = t * 0.02;
			renderer.render(scene, camera);
			raf = requestAnimationFrame(tick);
		};
		tick();

		// pointer parallax — the plate is an object in space, not a flat image.
		const onMove = (e: PointerEvent) => {
			const r = host.getBoundingClientRect();
			const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
			const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
			rig.rotation.y = nx * 0.28;
			rig.rotation.x = ny * 0.2;
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
			renderer.dispose();
			renderer.domElement.remove();
		};
	});
</script>

<div class="card3d">
	<div bind:this={host} class="stage"></div>
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
	/* darkens the corners so the eye stays on the rig and edges fall into the near-black. */
	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(ellipse at center, transparent 45%, rgba(4, 4, 6, 0.75) 100%);
	}
</style>
