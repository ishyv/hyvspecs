<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="frame">
	<main class="error-container">
		<header>
			<span class="prefix">system.err</span>
			<span class="status">/{page.status}</span>
		</header>

		<div class="body">
			<div class="terminal">
				<p class="prompt">&gt; check_signal</p>
				<p class="response">{page.error?.message ?? 'unknown signal interruption'}</p>
			</div>

			<a href="/" class="home-link">return_to_base</a>
		</div>
	</main>
</div>

<style>
	.frame {
		position: fixed;
		inset: 0;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		z-index: 1000;
	}
	.error-container {
		width: 320px;
		background: var(--bg-raised);
		border: 1px solid var(--line);
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
		border-bottom: 1px solid var(--line-soft);
		padding-bottom: 0.75rem;
	}
	.prefix {
		font-size: 1.1rem;
		color: var(--accent);
		font-weight: 500;
	}
	.status {
		font-size: 0.9rem;
		color: var(--n-600);
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
		color: var(--dim);
		font-size: 0.85rem;
	}
	.response {
		color: var(--text-bright);
		font-size: 0.95rem;
		line-height: 1.4;
	}
	.home-link {
		display: inline-block;
		text-align: center;
		border: 1px solid var(--line);
		background: var(--n-900);
		padding: 0.6rem;
		color: var(--signal);
		text-decoration: none;
		font-size: 0.85rem;
		letter-spacing: 0.05em;
		transition: all 0.2s var(--ease);
	}
	.home-link:hover {
		border-color: var(--signal);
		background: #142223;
	}
</style>
