<script lang="ts">
	import Card3D from './Card3D.svelte';
	import type { Envelope } from './envelope';
	import { scoreEnvelope } from './score';
	import { glowColorHex } from './render/themes';

	let { envelope }: { envelope: Envelope } = $props();
	const profile = $derived(scoreEnvelope(envelope));
	const accent = $derived(glowColorHex(profile.visual.heat, envelope.seed));
</script>

<div class="card">
	<Card3D {envelope} />

	<header>
		<div class="who">
			<span class="handle">{envelope.handle ?? 'anon'}{#if envelope.verified}<span class="check" style="color: {accent}">✓</span>{/if}</span>
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
	.label {
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
</style>
