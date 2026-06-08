<script lang="ts">
	import Card from '$lib/Card.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

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
