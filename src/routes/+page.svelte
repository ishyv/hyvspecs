<script lang="ts">
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let copied = $state(false);

	function copyCommand() {
		navigator.clipboard.writeText('hyvspecs showcase');
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		let animationId = 0;
		
		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};
		window.addEventListener('resize', resize);
		resize();

		// Star particles
		const count = 75;
		const stars: Array<{
			x: number;
			y: number;
			size: number;
			speed: number;
			alpha: number;
			fadeSpeed: number;
			growing: boolean;
		}> = [];

		for (let i = 0; i < count; i++) {
			stars.push({
				x: Math.random() * canvas.width,
				y: Math.random() * canvas.height,
				size: 0.4 + Math.random() * 1.2,
				speed: 0.02 + Math.random() * 0.06,
				alpha: 0.1 + Math.random() * 0.8,
				fadeSpeed: 0.003 + Math.random() * 0.006,
				growing: Math.random() > 0.5
			});
		}

		const tick = () => {
			ctx.fillStyle = '#08080a';
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// Draw motherboard grid lines in the background
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.012)';
			ctx.lineWidth = 1;
			const gridSize = 80;
			for (let x = 0; x < canvas.width; x += gridSize) {
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, canvas.height);
				ctx.stroke();
			}
			for (let y = 0; y < canvas.height; y += gridSize) {
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.lineTo(canvas.width, y);
				ctx.stroke();
			}

			// Render and update stars
			for (let i = 0; i < stars.length; i++) {
				const s = stars[i];
				
				// Twinkle
				if (s.growing) {
					s.alpha += s.fadeSpeed;
					if (s.alpha >= 0.95) s.growing = false;
				} else {
					s.alpha -= s.fadeSpeed;
					if (s.alpha <= 0.08) s.growing = true;
				}

				// Drift left
				s.x -= s.speed;
				if (s.x < -10) {
					s.x = canvas.width + 10;
					s.y = Math.random() * canvas.height;
				}

				ctx.fillStyle = `rgba(200, 205, 215, ${s.alpha})`;
				ctx.beginPath();
				ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
				ctx.fill();

				// Soft glow behind larger stars
				if (s.size > 1.0) {
					ctx.fillStyle = `rgba(200, 205, 215, ${s.alpha * 0.2})`;
					ctx.beginPath();
					ctx.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
					ctx.fill();
				}
			}

			animationId = requestAnimationFrame(tick);
		};
		tick();

		return () => {
			cancelAnimationFrame(animationId);
			window.removeEventListener('resize', resize);
		};
	});
</script>

<svelte:head>
	<title>hyv-specs — share your hardware in 3D</title>
	<meta name="description" content="Turn your system specs into a gorgeous, interactive 3D card. Run one command, get a link. Built for hardware enthusiasts." />
	<meta property="og:title" content="hyv-specs — share your hardware in 3D" />
	<meta property="og:description" content="Turn your system specs into a gorgeous, interactive 3D card. Run one command, get a link. Built for hardware enthusiasts." />
	<meta property="og:url" content="https://specs.hyvnt.dev" />
	<meta name="twitter:title" content="hyv-specs — share your hardware in 3D" />
	<meta name="twitter:description" content="Turn your system specs into a gorgeous, interactive 3D card. Run one command, get a link." />
</svelte:head>

<div class="landing">
	<canvas bind:this={canvas}></canvas>
	
	<main class="content">
		<header class="hero">
			<div class="logo">hyv-specs</div>
			<div class="tagline">3D HARDWARE SHOWCASE</div>
			<p class="description">
				Share your system specifications in gorgeous, interactive 3D cards. A minimal, high-fidelity playground built for hardware enthusiasts.
			</p>
		</header>

		<section class="setup">
			<h2>HOW TO GENERATE YOUR CARD</h2>
			<div class="steps">
				<div class="step">
					<span class="step-num">01</span>
					<div class="step-body">
						<h3>Download the CLI</h3>
						<p>Get the lightweight system diagnostics tool compiled for Windows, Linux, or macOS.</p>
					</div>
				</div>
				<div class="step">
					<span class="step-num">02</span>
					<div class="step-body">
						<h3>Run the Showcase Command</h3>
						<p>Open your terminal and execute the query. It collects hardware specs and generates your custom URL.</p>
					</div>
				</div>
			</div>

			<div class="terminal" role="button" tabindex="0" onclick={copyCommand} onkeydown={(e) => e.key === 'Enter' && copyCommand()}>
				<div class="term-header">
					<span class="term-dot red"></span>
					<span class="term-dot yellow"></span>
					<span class="term-dot green"></span>
					<span class="term-title">terminal — command</span>
					<span class="term-action">{copied ? 'COPIED!' : 'CLICK TO COPY'}</span>
				</div>
				<div class="term-body">
					<div class="line">
						<span class="prompt">$</span>
						<span class="cmd">hyvspecs showcase</span>
					</div>
					<div class="line output">Gathering hardware specifications...</div>
					<div class="line output">Found: CPU 16-Core · GPU NVIDIA RTX 4070 · RAM 32GB</div>
					<div class="line output success">✓ Card generated: <span class="url">https://hyv-specs.vercel.app/dev</span></div>
				</div>
			</div>
		</section>

		<footer class="actions">
			<a href="https://github.com/ishyv/hyvspecs/releases" target="_blank" class="btn primary">
				<span>DOWNLOAD CLI</span>
				<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M5 20h14v-2H5m14-9h-4V3H9v6H5l7 7z"/></svg>
			</a>
			<a href="https://github.com/ishyv/hyvspecs" target="_blank" class="btn secondary">
				<span>GITHUB CODE</span>
				<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
			</a>
		</footer>
	</main>
</div>

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		background: #08080a;
		overflow-x: hidden;
	}
	.landing {
		position: relative;
		min-height: 100vh;
		width: 100vw;
		color: #e8ebee;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		display: flex;
		justify-content: center;
		align-items: center;
	}
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
		pointer-events: none;
	}
	.content {
		position: relative;
		z-index: 1;
		width: 90%;
		max-width: 600px;
		margin: 3rem auto;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
		padding: 1.5rem;
	}
	
	.hero {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.8rem;
	}
	.logo {
		font-size: 2.8rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: lowercase;
		color: #f1f2f4;
		text-shadow: 0 0 20px rgba(255, 255, 255, 0.12);
		line-height: 1;
	}
	.tagline {
		font-size: 0.75rem;
		letter-spacing: 0.32em;
		color: #8a9097;
		text-transform: uppercase;
		margin-bottom: 0.5rem;
	}
	.description {
		font-size: 0.88rem;
		line-height: 1.6;
		color: #8a9097;
		max-width: 480px;
		margin: 0;
	}

	.setup {
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
		background: rgba(12, 12, 14, 0.6);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid #1c1d24;
		padding: 1.8rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}
	h2 {
		font-size: 0.72rem;
		letter-spacing: 0.18em;
		color: #d6a85a;
		margin: 0 0 0.5rem 0;
		text-transform: uppercase;
	}
	.steps {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.step {
		display: flex;
		gap: 1.2rem;
		align-items: flex-start;
	}
	.step-num {
		font-size: 1.1rem;
		font-weight: bold;
		color: #3b3c45;
		line-height: 1.2;
	}
	.step-body h3 {
		font-size: 0.82rem;
		font-weight: bold;
		color: #e8ebee;
		margin: 0 0 0.2rem 0;
		letter-spacing: 0.04em;
	}
	.step-body p {
		font-size: 0.76rem;
		color: #8a9097;
		margin: 0;
		line-height: 1.4;
	}

	.terminal {
		background: #040406;
		border: 1px solid #26282e;
		margin-top: 0.5rem;
		cursor: pointer;
		outline: none;
	}
	.terminal:focus-visible {
		border-color: #d6a85a;
	}
	.term-header {
		background: #0d0d11;
		border-bottom: 1px solid #1c1d24;
		display: flex;
		align-items: center;
		padding: 0.4rem 0.8rem;
		gap: 0.35rem;
	}
	.term-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}
	.term-dot.red { background: #e55c5c; }
	.term-dot.yellow { background: #e5c15c; }
	.term-dot.green { background: #5ce588; }
	.term-title {
		font-size: 0.62rem;
		color: #4b4d56;
		margin-left: 0.5rem;
		flex-grow: 1;
		letter-spacing: 0.05em;
	}
	.term-action {
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		color: #8a9097;
		font-weight: bold;
	}
	.term-body {
		padding: 0.9rem 1.2rem;
		font-size: 0.76rem;
		line-height: 1.5;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.line {
		display: flex;
		gap: 0.6rem;
	}
	.prompt {
		color: #3b3c45;
		user-select: none;
	}
	.cmd {
		color: #e8ebee;
	}
	.line.output {
		color: #6a7178;
		padding-left: 1.1rem;
	}
	.line.success {
		color: #5ce588;
		padding-left: 1.1rem;
	}
	.url {
		text-decoration: underline;
		color: #8ae8e2;
	}

	.actions {
		display: flex;
		justify-content: center;
		gap: 1rem;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 0.72rem 1.4rem;
		font-size: 0.76rem;
		font-weight: bold;
		letter-spacing: 0.1em;
		text-decoration: none;
		border-radius: 0;
		transition: all 0.2s ease;
		font-family: inherit;
	}
	.btn.primary {
		background: #e8ebee;
		color: #08080a;
	}
	.btn.primary:hover {
		background: #ffffff;
		box-shadow: 0 0 16px rgba(255, 255, 255, 0.2);
	}
	.btn.secondary {
		border: 1px solid #26282e;
		color: #8a9097;
		background: rgba(8, 8, 10, 0.5);
	}
	.btn.secondary:hover {
		border-color: #8a9097;
		color: #e8ebee;
	}

	@media (max-width: 480px) {
		.logo {
			font-size: 2.2rem;
		}
		.btn {
			padding: 0.62rem 1rem;
			font-size: 0.7rem;
		}
	}
</style>
