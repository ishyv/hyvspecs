<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#08080a" />
	<meta property="og:site_name" content="hyv-specs" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
</svelte:head>
{@render children()}
