import { Color } from 'three';

// the material worlds (VISUAL_SYSTEM.md). authored as STOPS on the 0..1 power gradient,
// not as buckets — `resolveTheme(e)` samples and cross-fades between neighbours, so a rig
// near a boundary bleeds from one world into the next and nothing ever snaps.
//
// a theme governs the SURFACE (what the metal is and what state it's in). the signal/glow
// colour is NOT fixed here — it's a continuous function of `heat` (teal→gold = cool→hot)
// so the two-accents rule from PHILOSOPHY.md holds: surfaces shift rust→divine, but
// emphasis light stays in the gold↔teal family.

export interface Theme {
	name: string;
	metal: Color; // base surface colour: oxidised brown → brass → titanium → pale gold
	roughness: number; // 1 = corroded/matte, 0 = polished/divine
	metalness: number;
	corrosion: number; // 0..1 surface noise/decay (drives vertex jitter + bump later)
	ambient: number; // scene ambient light for this world
	emissive: number; // base self-illumination floor (rust barely glows, divine emits)
}

interface Stop extends Omit<Theme, 'metal'> {
	at: number; // position on the e gradient
	metal: number; // hex (lerped as Color)
}

// positioned at the band midpoints from score.ts so each world owns its zone. ambient has a
// raised floor so even rust reads (legibility > mood); emissive top is held back since filmic
// tone mapping + accent multipliers push the highlights — keeps divine metal from going flat.
const STOPS: Stop[] = [
	{ at: 0.12, name: 'rust', metal: 0x4a3526, roughness: 0.95, metalness: 0.4, corrosion: 0.9, ambient: 0.34, emissive: 0.16 },
	{ at: 0.35, name: 'iron', metal: 0x55555e, roughness: 0.7, metalness: 0.72, corrosion: 0.5, ambient: 0.4, emissive: 0.24 },
	{ at: 0.55, name: 'overcharge', metal: 0x7a5a28, roughness: 0.48, metalness: 0.86, corrosion: 0.45, ambient: 0.44, emissive: 0.4 },
	{ at: 0.74, name: 'alloy', metal: 0x747a82, roughness: 0.28, metalness: 0.93, corrosion: 0.18, ambient: 0.5, emissive: 0.55 },
	{ at: 0.92, name: 'divine', metal: 0xd8bd82, roughness: 0.13, metalness: 1.0, corrosion: 0.0, ambient: 0.56, emissive: 0.78 }
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function resolveTheme(e: number): Theme {
	// find the bracketing stops and the local mix between them.
	if (e <= STOPS[0].at) return materialize(STOPS[0]);
	if (e >= STOPS[STOPS.length - 1].at) return materialize(STOPS[STOPS.length - 1]);

	let i = 0;
	while (e > STOPS[i + 1].at) i++;
	const lo = STOPS[i];
	const hi = STOPS[i + 1];
	const t = (e - lo.at) / (hi.at - lo.at);

	return {
		name: t < 0.5 ? lo.name : hi.name,
		metal: new Color(lo.metal).lerp(new Color(hi.metal), t),
		roughness: lerp(lo.roughness, hi.roughness, t),
		metalness: lerp(lo.metalness, hi.metalness, t),
		corrosion: lerp(lo.corrosion, hi.corrosion, t),
		ambient: lerp(lo.ambient, hi.ambient, t),
		emissive: lerp(lo.emissive, hi.emissive, t)
	};
}

function materialize(s: Stop): Theme {
	return { ...s, metal: new Color(s.metal) };
}

interface ColorPalette {
	name: string;
	cool: number;
	warm: number;
}

const PALETTES: ColorPalette[] = [
	{ name: 'cyberpunk', cool: 0x00f3ff, warm: 0xff007f },    // Neon Cyan to Neon Pink/Magenta
	{ name: 'emerald', cool: 0x00ff88, warm: 0x00bbff },      // Mint/Emerald to Ocean Cyan
	{ name: 'orange-fyre', cool: 0xffaa00, warm: 0xff3300 },  // Amber Orange to Blazing Crimson
	{ name: 'ocean-breeze', cool: 0x0055ff, warm: 0x00e1d9 }, // Cobalt Blue to Ocean Turquoise
	{ name: 'toxic-acid', cool: 0xadff2f, warm: 0xffd700 },   // Lime Green to Golden Yellow
	{ name: 'quantum-blue', cool: 0x9900ff, warm: 0x00ffff }, // Royal Purple to Electric Cyan
	{ name: 'monochrome', cool: 0x778899, warm: 0xffffff },   // Cool Slate to Radiant White
	{ name: 'copper-rust', cool: 0x8b4513, warm: 0xff4500 }   // Saddle Brown to Neon Red-Orange
];

// the signal/glow colour — continuous, decoupled from the world.
// derived from the card seed so each user gets a unique color palette (hue),
// morphing from cool to warm hues depending on performance (heat).
export function glowColor(heat: number, seed: string): Color {
	// deterministic hash from the seed string
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = seed.charCodeAt(i) + ((hash << 5) - hash);
	}
	
	const paletteIndex = Math.abs(hash) % PALETTES.length;
	const palette = PALETTES[paletteIndex];

	const coolColor = new Color(palette.cool);
	const warmColor = new Color(palette.warm);

	return coolColor.lerp(warmColor, heat);
}

export function glowColorHex(heat: number, seed: string): string {
	return '#' + glowColor(heat, seed).getHexString();
}
