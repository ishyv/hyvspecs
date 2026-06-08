<script lang="ts">
	import Card from '$lib/Card.svelte';
	import { buildEnvelope, type Envelope } from '$lib/envelope';
	import { scoreEnvelope } from '$lib/score';
	import type { Payload } from '$lib/payload';

	// local-only visual harness: a few reference rigs so we can watch the scene react across
	// the brackets without the cli/db. not a real route in spirit — just for tuning the look.
	const rig = (seed: string, specs: Payload): Envelope =>
		buildEnvelope({
			card_id: seed.slice(0, 4).toUpperCase(),
			handle: null,
			verified: false,
			label: null,
			seed,
			created_at: Date.now(),
			specs
		});

	const base = (os: string): Pick<Payload, 'v' | 'machine'> => ({
		v: 1,
		machine: { os, label: null }
	});

	const rigs: Envelope[] = [
		rig('rustpotato0', {
			...base('Windows 10'),
			cpu: { model: 'Intel Core i3-6100', vendor: 'intel', cores_physical: 2, cores_logical: 4, clock_max_mhz: 3700 },
			gpus: [{ model: 'Intel HD Graphics 530', vendor: 'intel', vram_mb: null }],
			ram: { total_mb: 4096, modules: [{ size_mb: 4096, speed_mhz: 2133, kind: 'DDR4' }] },
			drives: [{ size_mb: 500000, kind: 'hdd', read_mbps: null }]
		}),
		rig('ironlaptop1', {
			...base('Windows 11'),
			cpu: { model: 'Intel Core i5-1135G7', vendor: 'intel', cores_physical: 4, cores_logical: 8, clock_max_mhz: 4200 },
			gpus: [{ model: 'Intel Iris Xe Graphics', vendor: 'intel', vram_mb: null }],
			ram: { total_mb: 8192, modules: [{ size_mb: 8192, speed_mhz: 3200, kind: 'DDR4' }] },
			drives: [{ size_mb: 256000, kind: 'ssd', read_mbps: null }]
		}),
		rig('midtower22', {
			...base('Windows 11'),
			cpu: { model: 'AMD Ryzen 5 5600', vendor: 'amd', cores_physical: 6, cores_logical: 12, clock_max_mhz: 4600 },
			gpus: [{ model: 'NVIDIA GeForce RTX 3060', vendor: 'nvidia', vram_mb: 12288 }],
			ram: { total_mb: 16384, modules: [{ size_mb: 8192, speed_mhz: 3600, kind: 'DDR4' }] },
			drives: [{ size_mb: 1000000, kind: 'nvme', read_mbps: null }]
		}),
		rig('lopsided33', {
			...base('Windows 11'),
			cpu: { model: 'Intel Core i3-12100', vendor: 'intel', cores_physical: 4, cores_logical: 8, clock_max_mhz: 4300 },
			gpus: [{ model: 'NVIDIA GeForce RTX 4090', vendor: 'nvidia', vram_mb: 24576 }],
			ram: { total_mb: 16384, modules: [{ size_mb: 16384, speed_mhz: 3200, kind: 'DDR4' }] },
			drives: [{ size_mb: 1000000, kind: 'nvme', read_mbps: null }]
		}),
		rig('beastmode4', {
			...base('Windows 11'),
			cpu: { model: 'AMD Ryzen 9 7950X', vendor: 'amd', cores_physical: 16, cores_logical: 32, clock_max_mhz: 5700 },
			gpus: [{ model: 'NVIDIA GeForce RTX 4090', vendor: 'nvidia', vram_mb: 24576 }],
			ram: { total_mb: 65536, modules: [{ size_mb: 16384, speed_mhz: 6000, kind: 'DDR5' }] },
			drives: [
				{ size_mb: 4000000, kind: 'nvme', read_mbps: null },
				{ size_mb: 2000000, kind: 'nvme', read_mbps: null }
			]
		})
	];

	let i = $state(2);
	const env = $derived(rigs[i]);
	const profile = $derived(scoreEnvelope(env));
</script>

<div class="frame">
	{#key env}
		<Card envelope={env} />
	{/key}

	<footer>
		{#each rigs as r, n (r.card_id)}
			<button class:on={n === i} onclick={() => (i = n)}>{r.specs.cpu.model.split(' ').slice(-1)[0]}</button>
		{/each}
	</footer>

	<dl class="parts">
		{#each Object.entries(profile.parts) as [k, v] (k)}
			<div><dt>{k}</dt><dd>{Math.round(v * 100)}</dd></div>
		{/each}
	</dl>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #08080a;
	}
	.frame {
		position: fixed;
		inset: 0;
		overflow: hidden;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		color: #c7ccd1;
	}
	/* dev-only tooling, kept clear of the card's own chrome (top corners + bottom readout). */
	footer {
		position: absolute;
		top: 0.9rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 3;
		display: flex;
		gap: 0.4rem;
		justify-content: center;
	}
	button {
		background: #121317;
		border: 1px solid #26282e;
		color: #8a9097;
		font: inherit;
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		padding: 0.4rem 0.7rem;
		cursor: pointer;
	}
	button.on {
		border-color: #d6a85a;
		color: #d6a85a;
	}
	.parts {
		position: absolute;
		top: 50%;
		right: 1.6rem;
		transform: translateY(-50%);
		z-index: 3;
		margin: 0;
		display: grid;
		gap: 0.25rem;
		font-size: 0.68rem;
		color: #6a7178;
		text-align: right;
	}
	.parts div {
		display: flex;
		gap: 0.6rem;
		justify-content: flex-end;
	}
	.parts dt {
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.parts dd {
		margin: 0;
		color: #c7ccd1;
		min-width: 1.6rem;
	}
</style>
