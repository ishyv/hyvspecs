<script lang="ts">
	import Card3D from './Card3D.svelte';
	import type { Envelope } from './envelope';
	import { scoreEnvelope } from './score';

	let { envelope }: { envelope: Envelope } = $props();
	const profile = $derived(scoreEnvelope(envelope));

	// mb → the shortest human unit. specs text is the quietest layer of the card, so it stays
	// terse: "2 tb", "32 gb".
	function cap(mb: number): string {
		if (mb >= 1024 * 1024) return +(mb / 1048576).toFixed(1) + ' tb';
		if (mb >= 1024) return Math.round(mb / 1024) + ' gb';
		return mb + ' mb';
	}

	const s = $derived(envelope.specs);
	const gpu = $derived(s.gpus[0]?.model ?? 'no gpu');
	const moreGpu = $derived(s.gpus.length > 1 ? ` +${s.gpus.length - 1}` : '');
	// the readout mirrors the rig's parts, in the same left-to-right order as the scene.
	const readout = $derived([
		{ k: 'cpu', v: s.cpu.model },
		{ k: 'gpu', v: gpu + moreGpu },
		{ k: 'ram', v: cap(s.ram.total_mb) },
		{ k: 'disk', v: cap(envelope.derived.total_storage_mb) },
		{ k: 'os', v: s.machine.os }
	]);
	const accent = $derived(profile.visual.heat > 0.5 ? '#d6a85a' : '#2f9e8f');
</script>

<div class="card">
	<Card3D {envelope} />

	<header>
		<div class="who">
			<span class="handle">{envelope.handle ?? 'anon'}{#if envelope.verified}<span class="check">✓</span>{/if}</span>
			<span class="id">{envelope.card_id}</span>
		</div>
		<div class="power" style="color: {accent}">
			<span class="tier">{profile.tier.name}</span>
			<span class="score">{profile.overall}</span>
		</div>
	</header>

	{#if envelope.label}
		<div class="label">{envelope.label}</div>
	{/if}

	<dl class="readout">
		{#each readout as r (r.k)}
			<div><dt>{r.k}</dt><dd>{r.v}</dd></div>
		{/each}
	</dl>
</div>

<style>
	.card {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: #08080a;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		color: #c7ccd1;
	}
	header,
	.label,
	.readout {
		position: absolute;
		z-index: 2;
		pointer-events: none;
	}
	header {
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1.4rem 1.7rem;
	}
	.who {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.handle {
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		color: #c7ccd1;
	}
	.check {
		color: #2f9e8f;
		margin-left: 0.3rem;
	}
	.id {
		font-size: 0.72rem;
		letter-spacing: 0.22em;
		color: #6a7178;
	}
	.power {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
	}
	.tier {
		text-transform: uppercase;
		letter-spacing: 0.2em;
		font-size: 0.7rem;
	}
	.score {
		font-size: 1.7rem;
		line-height: 1;
		font-weight: 500;
	}
	.label {
		top: 3.6rem;
		left: 1.7rem;
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		color: #8a9097;
		text-transform: lowercase;
	}
	.readout {
		bottom: 1.5rem;
		left: 1.7rem;
		right: 1.7rem;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.6rem;
		font-size: 0.72rem;
	}
	.readout div {
		display: flex;
		gap: 0.55rem;
		align-items: baseline;
	}
	.readout dt {
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: #6a7178;
	}
	.readout dd {
		margin: 0;
		color: #c7ccd1;
		letter-spacing: 0.02em;
	}
</style>
