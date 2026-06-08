<script lang="ts">
	import Card from '$lib/Card.svelte';
	import { buildEnvelope, type Envelope } from '$lib/envelope';
	import { scoreEnvelope } from '$lib/score';
	import type { Payload } from '$lib/payload';

	// Reactive controls using Svelte 5 state runes
	let seed = $state('potatoseed');
	let cpuCores = $state(4);
	let cpuClock = $state(2.5);
	let gpuPreset = $state('integrated');
	let gpuVramGb = $state(2);
	let ramTotalGb = $state(8);
	let ramModules = $state(1);
	let driveTotalGb = $state(512);
	let driveCount = $state(1);
	let driveKind = $state('ssd' as 'nvme' | 'ssd' | 'hdd' | 'unknown');

	// Map GPU presets to name and simulated VRAM
	const gpuPresets = {
		integrated: { name: 'Intel HD Graphics', vram: 0 },
		entry: { name: 'NVIDIA GeForce GTX 1050', vram: 2 },
		mid: { name: 'AMD Radeon RX 6600', vram: 8 },
		high: { name: 'NVIDIA GeForce RTX 4070', vram: 12 },
		divine: { name: 'NVIDIA GeForce RTX 4090', vram: 24 }
	};

	// Derive the envelope reactively
	const env = $derived.by(() => {
		const gpuInfo = gpuPresets[gpuPreset as keyof typeof gpuPresets] || gpuPresets.integrated;
		
		const payload: Payload = {
			v: 1,
			machine: {
				os: 'Windows 11',
				label: 'Dev Rig'
			},
			cpu: {
				model: cpuCores >= 32 ? `AMD Threadripper ${cpuCores}-Core` : `Intel Core i${cpuCores === 4 ? 3 : cpuCores === 8 ? 7 : 9}`,
				vendor: cpuCores >= 32 ? 'amd' : 'intel',
				cores_physical: Math.max(1, Math.round(cpuCores / 2)),
				cores_logical: cpuCores,
				clock_max_mhz: Math.round(cpuClock * 1000)
			},
			gpus: [
				{
					model: gpuInfo.name,
					vendor: gpuInfo.name.toLowerCase().includes('nvidia') ? 'nvidia' : gpuInfo.name.toLowerCase().includes('amd') ? 'amd' : 'intel',
					vram_mb: gpuInfo.vram > 0 ? gpuInfo.vram * 1024 : null
				}
			],
			ram: {
				total_mb: ramTotalGb * 1024,
				modules: Array.from({ length: ramModules }, () => ({
					size_mb: Math.round((ramTotalGb * 1024) / ramModules),
					speed_mhz: 3200,
					kind: 'ddr4'
				}))
			},
			drives: Array.from({ length: driveCount }, (_, i) => ({
				size_mb: Math.round((driveTotalGb * 1024) / driveCount),
				kind: driveKind,
				read_mbps: null
			}))
		};

		return buildEnvelope({
			card_id: 'DEV1',
			handle: null,
			verified: false,
			label: 'Dev Harness',
			seed,
			created_at: Date.now(),
			specs: payload
		});
	});

	const profile = $derived(scoreEnvelope(env));
</script>

<div class="frame">
	<!-- Re-keys the card to force canvas instantiation on slider change -->
	{#key env}
		<Card envelope={env} />
	{/key}

	<div class="panel">
		<h2>DEV CONTROLLER</h2>
		
		<div class="section">
			<h3>IDENTITY</h3>
			<label>
				seed (drives colors/PCBs)
				<input type="text" bind:value={seed} />
			</label>
		</div>

		<div class="section">
			<h3>CPU</h3>
			<label>
				clock speed ({cpuClock.toFixed(1)} GHz)
				<input type="range" min="1.5" max="6.0" step="0.1" bind:value={cpuClock} />
			</label>
			<label>
				cores ({cpuCores} threads)
				<input type="range" min="2" max="64" step="2" bind:value={cpuCores} />
			</label>
		</div>

		<div class="section">
			<h3>GPU</h3>
			<label>
				GPU Tier Preset
				<select bind:value={gpuPreset}>
					<option value="integrated">Integrated (Potato)</option>
					<option value="entry">Entry GTX 1050 (Low)</option>
					<option value="mid">Mid RX 6600 (Medium)</option>
					<option value="high">High RTX 4070 (High)</option>
					<option value="divine">Enthusiast RTX 4090 (Divine)</option>
				</select>
			</label>
		</div>

		<div class="section">
			<h3>RAM</h3>
			<label>
				capacity ({ramTotalGb} GB)
				<input type="range" min="4" max="128" step="4" bind:value={ramTotalGb} />
			</label>
			<label>
				sticks count ({ramModules} sticks)
				<input type="range" min="1" max="12" step="1" bind:value={ramModules} />
			</label>
		</div>

		<div class="section">
			<h3>DRIVES</h3>
			<label>
				disk type
				<select bind:value={driveKind}>
					<option value="nvme">NVMe M.2 (High)</option>
					<option value="ssd">SATA SSD (Mid)</option>
					<option value="hdd">SATA HDD (Low)</option>
				</select>
			</label>
			<label>
				capacity ({driveTotalGb} GB)
				<input type="range" min="128" max="8192" step="128" bind:value={driveTotalGb} />
			</label>
			<label>
				drives count ({driveCount} disks)
				<input type="range" min="1" max="10" step="1" bind:value={driveCount} />
			</label>
		</div>

		<div class="stats">
			<h3>CALCULATED RATINGS</h3>
			<div class="stat-row">
				<span>overall score:</span>
				<strong style="color: #e8ebee">{profile.overall}</strong>
			</div>
			<div class="stat-row">
				<span>tier:</span>
				<strong class="uppercase" style="color: #d6a85a">{profile.tier.name}</strong>
			</div>
			<div class="stat-row">
				<span>CPU score:</span>
				<span>{Math.round(profile.parts.cpu * 100)}</span>
			</div>
			<div class="stat-row">
				<span>GPU score:</span>
				<span>{Math.round(profile.parts.gpu * 100)}</span>
			</div>
			<div class="stat-row">
				<span>RAM score:</span>
				<span>{Math.round(profile.parts.ram * 100)}</span>
			</div>
			<div class="stat-row">
				<span>Storage score:</span>
				<span>{Math.round(profile.parts.storage * 100)}</span>
			</div>
		</div>
	</div>
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
	.panel {
		position: absolute;
		top: 1rem;
		right: 1rem;
		bottom: 1rem;
		width: 320px;
		background: rgba(8, 8, 10, 0.82);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid #26282e;
		padding: 1.5rem;
		z-index: 10;
		overflow-y: auto;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.75rem;
		color: #8a9097;
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		box-shadow: -8px 0 32px rgba(0, 0, 0, 0.6);
	}
	
	/* Scrollbar styling */
	.panel::-webkit-scrollbar {
		width: 4px;
	}
	.panel::-webkit-scrollbar-track {
		background: transparent;
	}
	.panel::-webkit-scrollbar-thumb {
		background: #26282e;
	}

	h2 {
		font-size: 0.95rem;
		letter-spacing: 0.15em;
		color: #e8ebee;
		margin: 0 0 0.5rem 0;
		border-bottom: 1px solid #1c1d24;
		padding-bottom: 0.5rem;
	}
	h3 {
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		color: #d6a85a;
		margin: 0 0 0.5rem 0;
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		border-bottom: 1px solid #14151b;
		padding-bottom: 0.8rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	input[type="text"], select {
		background: #121317;
		border: 1px solid #26282e;
		color: #e8ebee;
		font: inherit;
		padding: 0.35rem 0.5rem;
		outline: none;
		border-radius: 0;
	}
	select {
		cursor: pointer;
	}
	input[type="range"] {
		width: 100%;
		accent-color: #2f9e8f;
		background: #1c1d24;
		height: 3px;
		outline: none;
		border-radius: 0;
	}
	.stats {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.stat-row {
		display: flex;
		justify-content: space-between;
		line-height: 1.4;
	}
</style>
