<script lang="ts">
	import { page } from '$app/state';

	// a missing card is the common, expected failure for a share product (expired/typo'd link),
	// so 404 gets its own on-brand "signal lost" state with a way back, distinct from a real fault.
	const is404 = $derived(page.status === 404);
	const prefix = $derived(is404 ? 'signal.lost' : 'system.err');
	const detail = $derived(
		is404
			? 'no card answers at this address. it may have been deleted, or never existed.'
			: (page.error?.message ?? 'unknown signal interruption')
	);
	const probe = $derived(is404 ? '> locate_card' : '> check_signal');
</script>

<div class="frame">
	<main class="panel">
		<header>
			<span class="prefix">{prefix}</span>
			<span class="status">/{page.status}</span>
		</header>

		<div class="body">
			<div class="terminal">
				<p class="probe">{probe}</p>
				<p class="detail">{detail}</p>
			</div>

			<a href="/" class="home-link">{is404 ? 'generate_your_own' : 'return_to_base'}</a>
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
	.panel {
		width: 360px;
		max-width: calc(100vw - 3rem);
		background: var(--bg-raised);
		border: 1px solid var(--line);
		border-top: 2px solid var(--accent);
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
		letter-spacing: 0.02em;
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
		gap: 0.6rem;
	}
	.probe {
		color: var(--dim);
		font-size: 0.85rem;
		margin: 0;
	}
	.detail {
		color: var(--text-bright);
		font-size: 0.95rem;
		line-height: 1.5;
		margin: 0;
	}
	.home-link {
		display: inline-block;
		text-align: center;
		border: 1px solid var(--line);
		background: var(--n-900);
		padding: 0.7rem;
		color: var(--signal);
		text-decoration: none;
		font-size: 0.85rem;
		letter-spacing: 0.05em;
		transition:
			border-color 0.2s var(--ease),
			background 0.2s var(--ease);
	}
	.home-link:hover,
	.home-link:focus-visible {
		border-color: var(--signal);
		background: #142223;
		outline: none;
	}
</style>
