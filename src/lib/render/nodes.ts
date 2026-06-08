import {
	BufferGeometry,
	BoxGeometry,
	CylinderGeometry,
	Float32BufferAttribute,
	Group,
	Line,
	LineBasicMaterial,
	Mesh,
	MeshStandardMaterial,
	TorusGeometry,
	Vector3,
	type Color
} from 'three';
import type { Theme } from './themes';
import { range, type Rng } from './rng';
import { surface } from './material';

// the supporting cast: ram / storage / os. not heroes, so a quieter vocabulary — slabs,
// bars, a ring — but the same contract: each reads the world + its own magnitude + the
// seed, never a tier. payload-agnostic on purpose (caller passes plain numbers), so the
// render layer never depends on the spec schema.

export interface NodeBuild {
	object: Group;
	materials: MeshStandardMaterial[]; // surfaces the idle breath pulses
}

export interface DriveBit {
	sizeMb: number;
	kind: 'nvme' | 'ssd' | 'hdd' | 'unknown';
}

// RAM — an honest stack of slabs, one per module (mixed sizes read as an uneven stack, not
// normalized, per PHILOSOPHY). height per slab from its share; whole stack glows by part.
export function ramNode(theme: Theme, magnitude: number, moduleMb: number[], glow: Color, rng: Rng): NodeBuild {
	const group = new Group();
	const mat = surface(theme, glow, magnitude);
	const mods = moduleMb.length ? moduleMb : [1]; // linux gives no per-module → one slab
	const max = Math.max(...mods);

	let y = 0;
	for (const mb of mods) {
		const h = 0.12 + (mb / max) * 0.16; // taller slab = bigger stick
		const slab = new Mesh(new BoxGeometry(0.7, h, 0.5), mat);
		slab.position.y = y + h / 2;
		group.add(slab);
		y += h + 0.05; // gap between sticks
	}
	group.position.y = -y / 2; // center the stack on its own origin
	return { object: group, materials: [mat] };
}

// nvme reads hottest/cleanest, hdd coldest/roughest — texture and glow shift with the kind.
const KIND: Record<DriveBit['kind'], { emit: number; rough: number }> = {
	nvme: { emit: 1.0, rough: -0.15 },
	ssd: { emit: 0.7, rough: 0 },
	hdd: { emit: 0.4, rough: 0.2 },
	unknown: { emit: 0.55, rough: 0.05 }
};

// STORAGE — one bar per drive in a row, mass (height) from capacity, kind shifts the feel.
export function storageNode(theme: Theme, magnitude: number, drives: DriveBit[], glow: Color, rng: Rng): NodeBuild {
	const group = new Group();
	const materials: MeshStandardMaterial[] = [];
	const list = drives.length ? drives : [{ sizeMb: 1, kind: 'unknown' as const }];
	const maxGb = Math.max(...list.map((d) => d.sizeMb)) / 1024;

	const gap = 0.34;
	list.forEach((d, i) => {
		const k = KIND[d.kind];
		const mat = surface(theme, glow, magnitude);
		mat.emissiveIntensity *= k.emit; // per-drive kind tint on top of the part glow
		mat.roughness = Math.min(1, Math.max(0, mat.roughness + k.rough));
		materials.push(mat);

		const h = 0.4 + Math.sqrt(d.sizeMb / 1024 / maxGb) * 1.1; // capacity → height, curved
		const bar = new Mesh(new BoxGeometry(0.26, h, 0.26), mat);
		bar.position.set((i - (list.length - 1) / 2) * gap, h / 2, 0);
		group.add(bar);
	});
	return { object: group, materials };
}

// OS — a quiet ring. lowest billing; it orients the rig without competing.
export function osNode(theme: Theme, glow: Color, rng: Rng): NodeBuild {
	const group = new Group();
	const mat = surface(theme, glow, 0.3);
	const ring = new Mesh(new TorusGeometry(0.34, 0.07, 6, 16), mat);
	ring.rotation.x = range(rng, -0.3, 0.3);
	const hub = new Mesh(new CylinderGeometry(0.1, 0.1, 0.1, 6), mat);
	hub.rotation.x = Math.PI / 2;
	group.add(ring, hub);
	return { object: group, materials: [mat] };
}

// a circuit trace: a thin glowing line between two world points. the connective tissue that
// makes the parts read as one powered figure rather than scattered objects.
export function trace(a: Vector3, b: Vector3, glow: Color, density: number): Line {
	const geo = new BufferGeometry();
	geo.setAttribute('position', new Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z], 3));
	const mat = new LineBasicMaterial({ color: glow, transparent: true, opacity: 0.12 + density * 0.3 });
	return new Line(geo, mat);
}
