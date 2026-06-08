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

// positioned at the band midpoints from score.ts so each world owns its zone.
const STOPS: Stop[] = [
	{ at: 0.12, name: 'rust', metal: 0x3a2a20, roughness: 0.97, metalness: 0.35, corrosion: 0.9, ambient: 0.15, emissive: 0.1 },
	{ at: 0.35, name: 'iron', metal: 0x4a4a52, roughness: 0.72, metalness: 0.7, corrosion: 0.5, ambient: 0.25, emissive: 0.2 },
	{ at: 0.55, name: 'overcharge', metal: 0x6e5226, roughness: 0.5, metalness: 0.85, corrosion: 0.45, ambient: 0.3, emissive: 0.45 },
	{ at: 0.74, name: 'alloy', metal: 0x6a7078, roughness: 0.3, metalness: 0.92, corrosion: 0.18, ambient: 0.4, emissive: 0.65 },
	{ at: 0.92, name: 'divine', metal: 0xc9b079, roughness: 0.14, metalness: 1.0, corrosion: 0.0, ambient: 0.55, emissive: 1.0 }
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

// the signal/glow colour — continuous, decoupled from the world. cool teal at low power,
// hot gold at high. hyvui's two accents.
const TEAL = new Color(0x2f9e8f);
const GOLD = new Color(0xd6a85a);

export function glowColor(heat: number): Color {
	return TEAL.clone().lerp(GOLD, heat);
}
