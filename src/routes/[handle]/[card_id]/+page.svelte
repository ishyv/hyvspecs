<script lang="ts">
	import { page } from '$app/state';
	import CardView from '$lib/CardView.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// verified card: it belongs to its label, else its @handle, else its id.
	const env = $derived(data.envelope);
	const who = $derived(env.label ?? (env.handle ? `@${env.handle}` : env.card_id));
	const canonicalUrl = $derived(`${page.url.origin}/${env.handle}/${env.card_id}`);
</script>

<CardView envelope={env} {who} {canonicalUrl} ogImageUrl={`${canonicalUrl}/og.png`} />
