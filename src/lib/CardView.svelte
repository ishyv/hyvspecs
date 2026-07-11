<script lang="ts">
	import Card from '$lib/Card.svelte';
	import { cap } from '$lib/format';
	import type { Envelope } from '$lib/envelope';

	// the shared body of both card routes (anonymous `/id` and verified `/handle/id`). they
	// differ only in who the card belongs to and its canonical url, so everything else — the
	// social meta and the single-viewport frame — lives here once.
	let {
		envelope,
		canonicalUrl,
		who,
		ogImageUrl
	}: { envelope: Envelope; canonicalUrl: string; who: string; ogImageUrl: string } = $props();

	const s = $derived(envelope.specs);
	// strip vendor parentheticals ("(R)", "(TM)", codenames) so the share text stays clean.
	const cpu = $derived(s.cpu.model.replace(/\(.*?\)/g, '').trim());
	const gpu = $derived(s.gpus[0]?.model.replace(/\(.*?\)/g, '').trim() ?? null);

	const title = $derived(`${who}'s specs — ${cpu}${gpu ? ` · ${gpu}` : ''} — hyv-specs`);
	const description = $derived(
		`${cpu}${gpu ? `, ${gpu}` : ''}, ${cap(s.ram.total_mb)} ram · check out ${who}'s full hardware card on hyv-specs.`
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={ogImageUrl} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImageUrl} />
</svelte:head>

<div class="frame">
	{#key envelope}
		<Card {envelope} />
	{/key}
</div>

<style>
	.frame {
		position: fixed;
		inset: 0;
		overflow: hidden;
		background: var(--bg);
	}
</style>
