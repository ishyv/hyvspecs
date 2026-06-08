<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AmbientLight,
		Group,
		HemisphereLight,
		PerspectiveCamera,
		PointLight,
		Scene,
		WebGLRenderer
	} from 'three';
	import type { Envelope } from '$lib/envelope';
	import { scoreEnvelope } from '$lib/score';
	import { resolveTheme, glowColor } from '$lib/render/themes';
	import { cpuCore, gpuCore, type Core } from '$lib/render/cores';
	import { makeRng } from '$lib/render/rng';

	let { envelope }: { envelope: Envelope } = $props();

	// host element the renderer mounts into. the scene is built once in onMount; to show a
	// different rig the parent re-keys this component (a card is a fixed object, not reactive).
	let host: HTMLDivElement;

	onMount(() => {
		const profile = scoreEnvelope(envelope);
		const theme = resolveTheme(profile.e);
		const glow = glowColor(profile.visual.heat);
		const rng = makeRng(envelope.seed);

		const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		host.appendChild(renderer.domElement);

		const scene = new Scene();
		const camera = new PerspectiveCamera(45, 1, 0.1, 100);
		camera.position.set(0, 0, 9);

		// light is the world's, not white: ambient floor + a glow-tinted rim so the metal
		// reads its tier. metalness needs *something* to reflect, hence the hemisphere fill.
		scene.add(new AmbientLight(0xffffff, theme.ambient));
		scene.add(new HemisphereLight(0xbfc6cc, 0x0a0a0c, 0.4 + profile.e * 0.4));
		const key = new PointLight(0xffffff, 30 + profile.e * 40);
		key.position.set(3, 4, 5);
		const rim = new PointLight(glow.getHex(), 20 + profile.e * 50);
		rim.position.set(-4, -2, -3);
		scene.add(key, rim);

		// the two heroes share a rig group so pointer parallax tilts them as one object.
		const rig = new Group();
		const cpu = cpuCore(theme, profile.parts.cpu, glow, rng);
		const gpu = gpuCore(theme, profile.parts.gpu, glow, rng);
		cpu.object.position.x = -2.1;
		gpu.object.position.x = 2.1;
		rig.add(cpu.object, gpu.object);
		scene.add(rig);
		const cores: Core[] = [cpu, gpu];

		// idle: slow core spin + an emissive breath whose rate/depth is the power's energy.
		const TAU = Math.PI * 2;
		const pulseAmt = 0.15 + profile.visual.energy * 0.5;
		const start = performance.now();
		let raf = 0;
		const tick = () => {
			const t = (performance.now() - start) / 1000;
			const breath = 1 + pulseAmt * Math.sin(t * profile.visual.pulseHz * TAU);
			for (const c of cores) {
				c.spin(t);
				for (const m of c.materials) m.emissiveIntensity = c.baseEmissive * breath;
			}
			renderer.render(scene, camera);
			raf = requestAnimationFrame(tick);
		};
		tick();

		// pointer parallax — the plate is an object in space, not a flat image.
		const onMove = (e: PointerEvent) => {
			const r = host.getBoundingClientRect();
			const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
			const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
			rig.rotation.y = nx * 0.35;
			rig.rotation.x = ny * 0.25;
		};
		host.addEventListener('pointermove', onMove);

		const resize = () => {
			const { clientWidth: w, clientHeight: h } = host;
			renderer.setSize(w, h);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
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

<div bind:this={host} class="stage"></div>

<style>
	.stage {
		width: 100%;
		height: 100%;
		touch-action: none;
	}
	.stage :global(canvas) {
		display: block;
	}
</style>
