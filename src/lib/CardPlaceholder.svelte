<script lang="ts">
	import type { Envelope } from '$lib/envelope';

	// placeholder card. the real single-viewport procedural renderer is a separate pass;
	// this just proves the envelope round-trips and shows the data the renderer will use.
	let { envelope }: { envelope: Envelope } = $props();

	const specs = $derived(envelope.specs);

	function capacity(mb: number): string {
		const gb = mb / 1024;
		return gb >= 1024 ? `${(gb / 1024).toFixed(1)} tb` : `${Math.round(gb)} gb`;
	}

	function cores(physical: number | null, logical: number): string {
		return physical ? `${physical}c/${logical}t` : `${logical}t`;
	}
</script>

<main>
	<header>
		<span class="name">{envelope.handle ?? envelope.label ?? 'anonymous'}</span>
		{#if envelope.verified}<span class="mark" title="verified">✓</span>{/if}
		<span class="id">/{envelope.card_id}</span>
	</header>

	<dl>
		<dt>os</dt>
		<dd>{specs.machine.os}</dd>

		<dt>cpu</dt>
		<dd>
			{specs.cpu.model} · {cores(specs.cpu.cores_physical, specs.cpu.cores_logical)}{#if specs.cpu.clock_max_mhz}
				· {(specs.cpu.clock_max_mhz / 1000).toFixed(1)} ghz{/if}
		</dd>

		<dt>gpu</dt>
		<dd>
			{#if specs.gpus.length === 0}none detected{:else}
				{#each specs.gpus as gpu (gpu.model + gpu.vram_mb)}
					<div>{gpu.model}{#if gpu.vram_mb} · {capacity(gpu.vram_mb)}{/if}</div>
				{/each}
			{/if}
		</dd>

		<dt>ram</dt>
		<dd>{capacity(specs.ram.total_mb)}{#if specs.ram.modules.length} · {specs.ram.modules.length} modules{/if}</dd>

		<dt>disk</dt>
		<dd>
			{#each specs.drives as drive, i (i)}{i > 0 ? ' · ' : ''}{capacity(drive.size_mb)} {drive.kind}{/each}
		</dd>
	</dl>
</main>

<style>
	main {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2rem;
		padding: 2rem;
		background: #0a0a0b;
		color: #e7e5e4;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		text-transform: lowercase;
	}

	header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.name {
		font-size: 1.5rem;
		color: #d6a85a;
	}

	.mark {
		color: #2f9e8f;
	}

	.id {
		color: #57534e;
	}

	dl {
		display: grid;
		grid-template-columns: 4rem 1fr;
		gap: 0.5rem 1.5rem;
		margin: 0;
	}

	dt {
		color: #57534e;
	}

	dd {
		margin: 0;
	}
</style>
