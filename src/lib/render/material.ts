import { MeshPhysicalMaterial, MeshStandardMaterial, type Color } from 'three';
import type { Theme } from './themes';
import { proceduralMetal } from './texture';
import { range, type Rng } from './rng';

// the top worlds wear a lacquer: a second specular layer over the metal, which is what sells
// "wet gold" instead of "yellow paint". only MeshPhysicalMaterial can express it, and it costs
// more, so the lower (rust/iron) worlds — which want to look dry and dead anyway — stay on the
// cheaper standard material. physical extends standard, so callers stay typed the same.
function build(
	opts: ConstructorParameters<typeof MeshStandardMaterial>[0],
	clearcoat: number
): MeshStandardMaterial {
	return clearcoat > 0.02
		? new MeshPhysicalMaterial({ ...opts, clearcoat, clearcoatRoughness: 0.18 })
		: new MeshStandardMaterial(opts);
}

// the flat surface, for small accent bits (vents, teeth, ornament) where a texture would be
// wasted. world decides the metal; the block's magnitude decides how hard it self-illuminates.
export function surface(theme: Theme, glow: Color, magnitude: number): MeshStandardMaterial {
	return build(
		{
			color: theme.metal,
			roughness: theme.roughness,
			metalness: theme.metalness,
			flatShading: true,
			emissive: glow,
			emissiveIntensity: theme.emissive * (0.4 + magnitude)
		},
		theme.clearcoat
	);
}

// the textured surface every PART BODY wears: procedural worn-painted metal + matching bump,
// seeded per card. this is what makes parts look forged and distinct instead of identical
// flat boxes. spray defaults to the glow but can be a decorative accent.
export function texturedSurface(theme: Theme, glow: Color, magnitude: number, rng: Rng, spray: Color = glow): MeshStandardMaterial {
	const texStyle = Math.floor(range(rng, 0, 4));
	const { map, bump } = proceduralMetal(rng, texStyle, theme.metal, spray, theme.corrosion);
	return build(
		{
			map, // carries colour, so the base stays white
			bumpMap: bump,
			bumpScale: 0.4 + theme.corrosion * 0.8,
			color: 0xffffff,
			roughness: theme.roughness,
			metalness: theme.metalness,
			emissive: glow,
			emissiveIntensity: theme.emissive * (0.4 + magnitude)
		},
		theme.clearcoat
	);
}
