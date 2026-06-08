<script lang="ts">
	import Card from '$lib/Card.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const s = data.envelope.specs;
	const cpu = s.cpu.model.replace(/\(.*?\)/g, '').trim();
	const gpu = s.gpus[0]?.model.replace(/\(.*?\)/g, '').trim() ?? null;
	const who = data.envelope.label ?? (data.envelope.handle ? `@${data.envelope.handle}` : data.envelope.card_id);

	const title = `${who}'s specs — ${cpu}${gpu ? ` · ${gpu}` : ''} — hyv-specs`;
	const description = `${cpu}${gpu ? `, ${gpu}` : ''}, ${Math.round(s.ram.total_mb / 1024)}GB RAM · Check out ${who}'s full hardware card on hyv-specs.`;
	const url = `https://specs.hyvnt.dev/${data.envelope.handle}/${data.envelope.card_id}`;
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
</svelte:head>

<div class="frame">
	{#key data.envelope}
		<Card envelope={data.envelope} />
	{/key}
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
	}
</style>
