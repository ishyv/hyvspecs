import {
	BufferAttribute,
	ConeGeometry,
	EdgesGeometry,
	Group,
	IcosahedronGeometry,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshStandardMaterial,
	type Color
} from 'three';
import type { Theme } from './themes';
import { range, type Rng } from './rng';
import { surface } from './material';

// the two heroes. each is a pure builder: (world, its own magnitude 0..1, glow, seed) →
// an Object3D that knows how to spin and pulse. NO core hard-codes a tier — it reads the
// `theme` for its surface and its own `magnitude` for size/complexity, so the same builder
// renders crude-and-rusty or radiant-and-divine with no branching. add a world to the
// theme table and both cores adapt for free (VISUAL_SYSTEM.md, the building-block contract).

export interface Core {
	object: Group;
	materials: MeshStandardMaterial[]; // surfaces whose emissive we pulse on the idle beat
	baseEmissive: number;
	spin: (t: number) => void; // called each frame with elapsed seconds
}

// displace every vertex outward by the world's corrosion + seed jitter, so weak/old worlds
// look pitted and unique, strong/divine worlds stay clean. mutates the geometry in place.
function weather(geo: IcosahedronGeometry, corrosion: number, rng: Rng) {
	const pos = geo.attributes.position as BufferAttribute;
	for (let i = 0; i < pos.count; i++) {
		const k = 1 + corrosion * range(rng, -0.18, 0.18);
		pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
	}
	geo.computeVertexNormals();
}

// CPU — angular crystal. logic/structure. facet density rises with the part; the seed
// pits the surface. tumbles slowly on two axes.
export function cpuCore(theme: Theme, magnitude: number, glow: Color, rng: Rng): Core {
	const radius = 0.6 + magnitude * 0.6;
	const detail = magnitude > 0.66 ? 2 : magnitude > 0.33 ? 1 : 0; // more facets = more power
	const geo = new IcosahedronGeometry(radius, detail);
	weather(geo, theme.corrosion, rng);

	const mat = surface(theme, glow, magnitude);
	const mesh = new Mesh(geo, mat);

	// glowing facet edges so light reads off every cut.
	const edges = new LineSegments(
		new EdgesGeometry(geo),
		new LineBasicMaterial({ color: glow, transparent: true, opacity: 0.4 + magnitude * 0.4 })
	);

	const group = new Group();
	group.add(mesh, edges);

	const wobble = range(rng, 0.05, 0.12);
	return {
		object: group,
		materials: [mat],
		baseEmissive: mat.emissiveIntensity,
		spin: (t) => {
			group.rotation.y = t * 0.25;
			group.rotation.x = Math.sin(t * 0.4) * wobble;
		}
	};
}

// GPU — radial bloom. parallel throughput. a glowing nucleus ringed by blades; blade count
// rises with the part. spins flat toward the viewer like a turbine.
export function gpuCore(theme: Theme, magnitude: number, glow: Color, rng: Rng): Core {
	const group = new Group();
	const materials: MeshStandardMaterial[] = [];

	const nucleus = new IcosahedronGeometry(0.45 + magnitude * 0.35, 1);
	const nucMat = surface(theme, glow, magnitude);
	group.add(new Mesh(nucleus, nucMat));
	materials.push(nucMat);

	const blades = Math.round(5 + magnitude * 11); // 5 → 16 petals
	const bladeMat = surface(theme, glow, magnitude);
	materials.push(bladeMat);
	const reach = 0.8 + magnitude * 0.9;

	for (let i = 0; i < blades; i++) {
		const a = (i / blades) * Math.PI * 2;
		const len = reach * range(rng, 0.85, 1.15); // seed jitter per blade
		const blade = new Mesh(new ConeGeometry(0.07 + magnitude * 0.06, len, 4), bladeMat);
		// point the cone outward in the xy plane, base at the nucleus.
		blade.position.set(Math.cos(a) * (0.4 + len / 2), Math.sin(a) * (0.4 + len / 2), 0);
		blade.rotation.z = a - Math.PI / 2;
		group.add(blade);
	}

	const dir = rng() > 0.5 ? 1 : -1;
	return {
		object: group,
		materials,
		baseEmissive: bladeMat.emissiveIntensity,
		spin: (t) => {
			group.rotation.z = t * 0.3 * dir;
		}
	};
}
