import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace, type Color } from 'three';
import { range, type Rng } from './rng';

// all textures are generated procedurally on a canvas — no asset files — and seeded so a
// card's wear is its own and deterministic. this is what breaks the "everything is a flat
// box" look: worn painted metal (color + grunge + spray + scratches) plus a matching bump so
// light catches real surface relief. corrosion (0 clean → 1 beaten) drives how rough it gets.

function canvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
	const c = document.createElement('canvas');
	c.width = c.height = size;
	return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, srgb: boolean): CanvasTexture {
	const t = new CanvasTexture(c);
	t.wrapS = t.wrapT = RepeatWrapping;
	t.minFilter = LinearFilter;
	if (srgb) t.colorSpace = SRGBColorSpace;
	return t;
}

export interface WornMaps {
	map: CanvasTexture; // colour: base metal, spray patches, scratches, pitting
	bump: CanvasTexture; // matching relief so the wear catches light
}

// worn painted metal. base = the tier's metal, spray = a decorative accent dusted on (kept
// subtle so it reads as paint, not as a performance signal — colour=performance still lives
// in the emissive glow, not here).
export function wornMetal(rng: Rng, base: Color, spray: Color, corrosion: number): WornMaps {
	const S = 256;
	const [col, cx] = canvas(S);
	const [bmp, bx] = canvas(S);

	cx.fillStyle = `#${base.getHexString()}`;
	cx.fillRect(0, 0, S, S);
	bx.fillStyle = '#7a7a7a';
	bx.fillRect(0, 0, S, S);

	// brushed grain: faint horizontal streaks so the metal isn't dead flat.
	for (let i = 0; i < 220; i++) {
		const y = range(rng, 0, S);
		const a = range(rng, 0.02, 0.06);
		cx.strokeStyle = rng() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
		cx.beginPath();
		cx.moveTo(0, y);
		cx.lineTo(S, y + range(rng, -2, 2));
		cx.stroke();
	}

	// spray-paint patches: a few soft accent blooms for colour interest.
	const spr = `#${spray.getHexString()}`;
	const patches = 2 + Math.floor(rng() * 3);
	for (let i = 0; i < patches; i++) {
		const x = range(rng, 0, S);
		const y = range(rng, 0, S);
		const r = range(rng, 30, 80);
		const g = cx.createRadialGradient(x, y, 0, x, y, r);
		g.addColorStop(0, hexA(spr, range(rng, 0.12, 0.26)));
		g.addColorStop(1, hexA(spr, 0));
		cx.fillStyle = g;
		cx.fillRect(x - r, y - r, r * 2, r * 2);
	}

	// pitting + speckle, scaling with corrosion — the "beaten up" channel, in colour and bump.
	const specks = Math.floor(400 + corrosion * 2600);
	for (let i = 0; i < specks; i++) {
		const x = range(rng, 0, S);
		const y = range(rng, 0, S);
		const r = range(rng, 0.4, 1.6 + corrosion * 2);
		const dark = rng() > 0.35;
		cx.fillStyle = dark ? `rgba(0,0,0,${range(rng, 0.05, 0.22)})` : `rgba(255,255,255,${range(rng, 0.03, 0.1)})`;
		cx.beginPath();
		cx.arc(x, y, r, 0, 6.283);
		cx.fill();
		bx.fillStyle = dark ? `rgba(0,0,0,${range(rng, 0.1, 0.4)})` : `rgba(255,255,255,${range(rng, 0.1, 0.3)})`;
		bx.beginPath();
		bx.arc(x, y, r, 0, 6.283);
		bx.fill();
	}

	// scratches: more and deeper as it corrodes.
	const scratches = Math.floor(corrosion * 40);
	for (let i = 0; i < scratches; i++) {
		const x = range(rng, 0, S);
		const y = range(rng, 0, S);
		const len = range(rng, 8, 50);
		const ang = range(rng, 0, 6.283);
		const x2 = x + Math.cos(ang) * len;
		const y2 = y + Math.sin(ang) * len;
		cx.strokeStyle = `rgba(0,0,0,${range(rng, 0.1, 0.3)})`;
		cx.lineWidth = range(rng, 0.5, 1.5);
		line(cx, x, y, x2, y2);
		bx.strokeStyle = `rgba(0,0,0,${range(rng, 0.2, 0.5)})`;
		bx.lineWidth = cx.lineWidth;
		line(bx, x, y, x2, y2);
	}

	return { map: tex(col, true), bump: tex(bmp, false) };
}

// a printed sticker: light label with dark text — goes on a drive face for real-drive fidelity
// (and doubles as a second, in-world readout of the capacity).
export function sticker(rng: Rng, title: string, sub: string): CanvasTexture {
	const W = 256;
	const H = 160;
	const c = document.createElement('canvas');
	c.width = W;
	c.height = H;
	const x = c.getContext('2d')!;
	x.fillStyle = '#cdc8bd';
	x.fillRect(0, 0, W, H);
	// print grain
	for (let i = 0; i < 600; i++) {
		x.fillStyle = `rgba(0,0,0,${range(rng, 0.02, 0.06)})`;
		x.fillRect(range(rng, 0, W), range(rng, 0, H), 1, 1);
	}
	x.fillStyle = '#1b1b1d';
	x.fillRect(10, 10, W - 20, 30);
	x.fillStyle = '#cdc8bd';
	x.font = 'bold 22px monospace';
	x.fillText(title.toUpperCase().slice(0, 14), 18, 32);
	x.fillStyle = '#1b1b1d';
	x.font = 'bold 40px monospace';
	x.fillText(sub.toUpperCase(), 16, 92);
	x.font = '16px monospace';
	x.fillText('SOLID • STATE • DRIVE', 16, 130);
	// barcode
	for (let bx = 16; bx < W - 16; bx += range(rng, 3, 7)) {
		x.fillStyle = rng() > 0.5 ? '#1b1b1d' : '#cdc8bd';
		x.fillRect(bx, 138, range(rng, 1, 3), 14);
	}
	return tex(c, true);
}

// a circuit-board backdrop: traces, pads and vias in the tier glow on a dark board, so the
// loadout reads as sitting on a real motherboard rather than floating in a void. seeded, so
// the board is the card's own.
export function pcbTexture(rng: Rng, glow: Color): CanvasTexture {
	const S = 512;
	const [c, x] = canvas(S);
	x.fillStyle = '#080b0a';
	x.fillRect(0, 0, S, S);
	const g = `#${glow.getHexString()}`;

	// right-angled copper traces.
	x.lineWidth = 1.5;
	for (let i = 0; i < 70; i++) {
		let px = range(rng, 0, S);
		let py = range(rng, 0, S);
		x.strokeStyle = hexA(g, range(rng, 0.15, 0.45));
		x.beginPath();
		x.moveTo(px, py);
		const steps = 2 + Math.floor(rng() * 4);
		for (let s = 0; s < steps; s++) {
			if (rng() > 0.5) px += range(rng, -70, 70);
			else py += range(rng, -70, 70);
			x.lineTo(px, py);
		}
		x.stroke();
	}
	// pads / vias.
	for (let i = 0; i < 140; i++) {
		x.fillStyle = hexA(g, range(rng, 0.2, 0.6));
		x.beginPath();
		x.arc(range(rng, 0, S), range(rng, 0, S), range(rng, 1.2, 3), 0, 6.283);
		x.fill();
	}
	return tex(c, true);
}

function hexA(hex: string, a: number): string {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function line(x: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
	x.beginPath();
	x.moveTo(x1, y1);
	x.lineTo(x2, y2);
	x.stroke();
}
