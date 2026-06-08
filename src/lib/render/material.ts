import { MeshStandardMaterial, type Color } from 'three';
import type { Theme } from './themes';

// the one surface every block wears. world decides the metal + how worn it is; the block's
// own magnitude decides how hard it self-illuminates. shared so cores and secondary nodes
// stay in the same material family (the building-block contract, VISUAL_SYSTEM.md).
export function surface(theme: Theme, glow: Color, magnitude: number): MeshStandardMaterial {
	return new MeshStandardMaterial({
		color: theme.metal,
		roughness: theme.roughness,
		metalness: theme.metalness,
		flatShading: true, // facets, not smooth blobs — the metallic/sharp law
		emissive: glow,
		emissiveIntensity: theme.emissive * (0.4 + magnitude)
	});
}
