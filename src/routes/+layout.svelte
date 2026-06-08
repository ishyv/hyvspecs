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
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
	<link href="https://fonts.googleapis.com/css2?family=VT323&family=IBM+Plex+Mono:wght@400;500;700&family=Orbitron:wght@500;700;900&family=Syncopate:wght@700&family=Russo+One&display=swap" rel="stylesheet">
</svelte:head>
{@render children()}
