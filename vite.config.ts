import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// the postprocessing add-ons (EffectComposer et al.) import bare `three`; without deduping
	// Vite can hand them a second copy, and cross-instance `instanceof` checks then fail. keep
	// three (and its examples) collapsed onto one instance.
	resolve: { dedupe: ['three'] },
	optimizeDeps: { include: ['three'] }
});
