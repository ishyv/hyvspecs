<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="frame">
	<main class="error-container">
		<header>
			<span class="prefix">system.err</span>
			<span class="status">/{$page.status}</span>
		</header>

		<div class="body">
			<div class="terminal">
				<p class="prompt">&gt; check_signal</p>
				<p class="response">{$page.error?.message ?? 'unknown signal interruption'}</p>
			</div>

			<a href="/" class="home-link">return_to_base</a>
		</div>
	</main>
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
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		color: #c7ccd1;
		background: #08080a;
		z-index: 1000;
	}
	.error-container {
		width: 320px;
		background: #0a0a0c;
		border: 1px solid #26282e;
		padding: 2rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		border-bottom: 1px solid #1a1c23;
		padding-bottom: 0.75rem;
	}
	.prefix {
		font-size: 1.1rem;
		color: #d6a85a;
		font-weight: 500;
	}
	.status {
		font-size: 0.9rem;
		color: #57534e;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}
	.terminal {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.prompt {
		color: #6a7178;
		font-size: 0.85rem;
	}
	.response {
		color: #e2e8f0;
		font-size: 0.95rem;
		line-height: 1.4;
	}
	.home-link {
		display: inline-block;
		text-align: center;
		border: 1px solid #26282e;
		background: #121317;
		padding: 0.6rem;
		color: #2f9e8f;
		text-decoration: none;
		font-size: 0.85rem;
		letter-spacing: 0.05em;
		transition: all 0.2s;
	}
	.home-link:hover {
		border-color: #2f9e8f;
		background: #142223;
	}
</style>
