<script lang="ts">
	import Card3D from './Card3D.svelte';
	import type { Envelope } from './envelope';
	import { scoreEnvelope } from './score';
	import { glowColorHex } from './render/themes';

	let { envelope }: { envelope: Envelope } = $props();
	const profile = $derived(scoreEnvelope(envelope));
	const accent = $derived(glowColorHex(profile.visual.heat, envelope.seed));
	const tierIndex = $derived(profile.tier.index);
</script>

<div class="card">
	<Card3D {envelope} />

	<header>
		<div class="who">
			<span class="handle">{envelope.handle ?? 'anon'}{#if envelope.verified}<span class="check" style="color: {accent}">✓</span>{/if}</span>
			<span class="id">{envelope.card_id}</span>
		</div>
		<div class="power" data-tier={tierIndex} style="--glow-color: {accent}; color: {accent};">
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

	/* --- Dynamic Tier Typography & Glow Effects --- */

	/* Tier 0: Dormant (CRT Terminal / Retro Vibe) */
	.power[data-tier="0"] {
		font-family: 'VT323', monospace;
		animation: crt-flicker 0.2s infinite ease-in-out;
	}
	.power[data-tier="0"] .tier {
		font-size: 1.35rem;
		letter-spacing: 0.02em;
		text-transform: lowercase;
		font-weight: 400;
		opacity: 0.7;
	}
	.power[data-tier="0"] .score {
		font-size: 2.7rem;
		line-height: 0.8;
		font-weight: 400;
	}

	/* Tier 1: Humming (Clean Monospace Tech Vibe) */
	.power[data-tier="1"] {
		font-family: 'IBM Plex Mono', monospace;
	}
	.power[data-tier="1"] .tier {
		font-size: 0.72rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		font-weight: 500;
		opacity: 0.85;
	}
	.power[data-tier="1"] .score {
		font-size: 1.7rem;
		line-height: 1.0;
		font-weight: 500;
	}

	/* Tier 2: Charged (Cyberpunk / Modern Vibe) */
	.power[data-tier="2"] {
		font-family: 'Orbitron', sans-serif;
	}
	.power[data-tier="2"] .tier {
		font-size: 0.65rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		font-weight: 700;
		text-shadow: 0 0 6px var(--glow-color);
	}
	.power[data-tier="2"] .score {
		font-size: 1.9rem;
		line-height: 0.95;
		font-weight: 900;
		text-shadow: 0 0 4px var(--glow-color);
	}

	/* Tier 3: Surging (Premium Minimalist Vibe) */
	.power[data-tier="3"] {
		font-family: 'Syncopate', sans-serif;
	}
	.power[data-tier="3"] .tier {
		font-size: 0.54rem;
		letter-spacing: 0.35em;
		text-transform: uppercase;
		font-weight: 700;
		text-shadow: 0 0 8px var(--glow-color);
		animation: pulse-glow-tier 2.5s infinite ease-in-out;
	}
	.power[data-tier="3"] .score {
		font-size: 2.1rem;
		line-height: 0.95;
		font-weight: 700;
		letter-spacing: -0.04em;
		text-shadow: 0 0 6px var(--glow-color);
	}

	/* Tier 4: Overdrive (Extreme Heavy Sci-Fi / Glitch Vibe) */
	.power[data-tier="4"] {
		font-family: 'Russo One', sans-serif;
	}
	.power[data-tier="4"] .tier {
		font-size: 0.8rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		font-weight: 400;
		font-style: italic;
		text-shadow: 0 0 8px var(--glow-color), 0 0 16px var(--glow-color);
		animation: pulse-glow-overdrive 1.5s infinite ease-in-out;
	}
	.power[data-tier="4"] .score {
		font-size: 2.5rem;
		line-height: 0.9;
		font-weight: 400;
		font-style: italic;
		text-shadow: 0 0 8px var(--glow-color), 0 0 20px var(--glow-color);
	}

	/* Animations */
	@keyframes crt-flicker {
		0%, 100% { opacity: 0.75; }
		50% { opacity: 0.65; }
		75% { opacity: 0.8; }
	}
	@keyframes pulse-glow-tier {
		0%, 100% {
			text-shadow: 0 0 4px var(--glow-color);
			opacity: 0.85;
		}
		50% {
			text-shadow: 0 0 12px var(--glow-color), 0 0 16px var(--glow-color);
			opacity: 1;
		}
	}
	@keyframes pulse-glow-overdrive {
		0%, 100% {
			text-shadow: 0 0 8px var(--glow-color), 0 0 16px var(--glow-color);
			filter: brightness(1);
		}
		50% {
			text-shadow: 0 0 14px var(--glow-color), 0 0 24px var(--glow-color), 0 0 32px var(--glow-color);
			filter: brightness(1.2);
		}
	}

	.label {
		top: 3.6rem;
		left: 1.7rem;
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		color: #8a9097;
		text-transform: lowercase;
	}

	/* Responsive scaling down to preserve viewport layout constraints on mobile */
	@media (max-width: 480px) {
		.power[data-tier="0"] .tier { font-size: 1.15rem; }
		.power[data-tier="0"] .score { font-size: 2.2rem; }
		
		.power[data-tier="1"] .tier { font-size: 0.65rem; }
		.power[data-tier="1"] .score { font-size: 1.45rem; }

		.power[data-tier="2"] .tier { font-size: 0.58rem; }
		.power[data-tier="2"] .score { font-size: 1.6rem; }

		.power[data-tier="3"] .tier { font-size: 0.48rem; }
		.power[data-tier="3"] .score { font-size: 1.75rem; }

		.power[data-tier="4"] .tier { font-size: 0.7rem; }
		.power[data-tier="4"] .score { font-size: 2.1rem; }
	}
</style>
