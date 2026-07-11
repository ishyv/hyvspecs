import { ImageResponse } from '@vercel/og';
import { html } from 'satori-html';
import { read } from '$app/server';

import regularUrl from './fonts/IBMPlexMono-Regular.woff?url';
import semiboldUrl from './fonts/IBMPlexMono-SemiBold.woff?url';

import type { Envelope } from '$lib/envelope';
import { scoreEnvelope } from '$lib/score';
import { glowColorHex } from '$lib/render/themes';
import { cap } from '$lib/format';

// the social "spec poster": a deterministic 1200x630 PNG rendered from the same envelope +
// score + palette as the live 3d card, so a shared link unfurls as something that looks like
// the product instead of plain text. it's a flat, typographic *reading* of the card — which
// also makes it the accessible spec view the site otherwise lacks.

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// read the bundled fonts once per server instance; ImageResponse needs raw font bytes.
let fontsPromise: Promise<Array<{ name: string; data: ArrayBuffer; weight: 400 | 600; style: 'normal' }>> | undefined;
function loadFonts() {
	return (fontsPromise ??= (async () => [
		{ name: 'IBM Plex Mono', data: await read(regularUrl).arrayBuffer(), weight: 400 as const, style: 'normal' as const },
		{ name: 'IBM Plex Mono', data: await read(semiboldUrl).arrayBuffer(), weight: 600 as const, style: 'normal' as const }
	])());
}

const escapeHtml = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export async function renderOgImage(envelope: Envelope, canonicalPath: string): Promise<ImageResponse> {
	const profile = scoreEnvelope(envelope);
	const accent = glowColorHex(profile.visual.heat, envelope.seed);
	const s = envelope.specs;

	const who = envelope.handle
		? `@${envelope.handle}`
		: (envelope.label ?? envelope.card_id);
	const status = envelope.verified ? 'verified' : 'anon';

	const gpu0 = s.gpus[0];
	const rows: Array<[string, string]> = [
		['os', s.machine.os],
		['cpu', s.cpu.model + (s.cpu.cores_logical ? `  ·  ${s.cpu.cores_logical}t` : '')],
		['gpu', gpu0 ? gpu0.model + (gpu0.vram_mb ? `  ·  ${cap(gpu0.vram_mb)}` : '') : 'none detected'],
		['ram', cap(s.ram.total_mb) + (s.ram.modules.length ? `  ·  ${s.ram.modules.length}×` : '')],
		[
			'disk',
			s.drives.length
				? `${cap(envelope.derived.total_storage_mb)}  ·  ${s.drives.length} ${s.drives.length > 1 ? 'drives' : 'drive'}`
				: 'none detected'
		]
	];

	const rowsHtml = rows
		.map(
			([k, v]) => `
			<div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #1a1c23; padding:16px 0;">
				<div style="display:flex; color:#6a7178; font-size:22px; letter-spacing:6px; text-transform:uppercase;">${k}</div>
				<div style="display:flex; color:#e8ebee; font-size:26px;">${escapeHtml(clip(v, 40))}</div>
			</div>`
		)
		.join('');

	const barWidth = Math.max(4, Math.min(100, profile.overall));

	// build the whole thing as one plain string, then parse it once. satori-html's tagged
	// template ESCAPES interpolated values, so injecting the pre-built rows via `${}` there
	// would render them as literal text — assembling the string first sidesteps that.
	const markupString = `
		<div style="display:flex; flex-direction:column; width:${OG_WIDTH}px; height:${OG_HEIGHT}px; background:#08080a; font-family:'IBM Plex Mono';">
			<div style="display:flex; width:${OG_WIDTH}px; height:8px; background:${accent};"></div>
			<div style="display:flex; flex-direction:column; flex:1; padding:60px 72px;">
				<div style="display:flex; align-items:center; justify-content:space-between;">
					<div style="display:flex; color:${accent}; font-size:26px; letter-spacing:4px; font-weight:600;">hyv-specs</div>
					<div style="display:flex; color:#4b4d56; font-size:22px;">${escapeHtml(clip(canonicalPath, 46))}</div>
				</div>

				<div style="display:flex; flex:1; align-items:center; justify-content:space-between;">
					<div style="display:flex; flex-direction:column; width:440px;">
						<div style="display:flex; color:#c7ccd1; font-size:36px;">${escapeHtml(clip(who, 20))}</div>
						<div style="display:flex; align-items:center; margin-top:10px;">
							<div style="display:flex; width:13px; height:13px; margin-right:10px; background:${envelope.verified ? accent : '#4b4d56'};"></div>
							<div style="display:flex; color:#6a7178; font-size:20px; letter-spacing:6px; text-transform:uppercase;">${status}</div>
						</div>
						<div style="display:flex; align-items:flex-end; margin-top:30px;">
							<div style="display:flex; color:${accent}; font-size:150px; font-weight:600; line-height:1;">${profile.overall}</div>
							<div style="display:flex; color:#4b4d56; font-size:32px; margin-left:8px; margin-bottom:20px;">/100</div>
						</div>
						<div style="display:flex; color:${accent}; font-size:28px; letter-spacing:10px; text-transform:uppercase; margin-top:10px;">${profile.tier.name}</div>
						<div style="display:flex; width:420px; height:6px; background:#1a1c23; margin-top:26px;">
							<div style="display:flex; width:${barWidth}%; height:6px; background:${accent};"></div>
						</div>
					</div>

					<div style="display:flex; flex-direction:column; width:560px;">
						${rowsHtml}
					</div>
				</div>

				<div style="display:flex; align-items:center; justify-content:space-between;">
					<div style="display:flex; color:#4b4d56; font-size:20px; letter-spacing:2px;">share your hardware in 3d</div>
					<div style="display:flex; color:#8a9097; font-size:20px;">specs.hyvnt.dev</div>
				</div>
			</div>
		</div>
	`;
	const markup = html(markupString);

	return new ImageResponse(markup, {
		width: OG_WIDTH,
		height: OG_HEIGHT,
		fonts: await loadFonts(),
		// the poster is a pure function of (specs, seed), so it caches hard at the edge.
		headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400, immutable' }
	});
}
