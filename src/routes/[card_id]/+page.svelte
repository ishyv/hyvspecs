<script lang="ts">
	import CardPlaceholder from '$lib/CardPlaceholder.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<CardPlaceholder envelope={data.envelope} />
