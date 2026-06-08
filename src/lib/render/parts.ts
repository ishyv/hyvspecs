import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	Object3D,
	type Color
} from 'three';
import type { Theme } from './themes';
import { surface } from './material';
import { range, type Rng } from './rng';

// recognizable hardware, not abstract solids (VISUAL_SYSTEM.md, the legibility law). each
// builder makes the *thing it is* from primitives — a chip, a graphics card, sticks, drives
// — and wears the world's finish via surface(). the tier decides how it's forged and lit;
// it never decides what it is. every part exposes an `anchor` (an empty Object3D at its top)
// that the card pins a text label to, so name + value follow the part through parallax.

export interface Part {
	object: Group;
	materials: MeshStandardMaterial[]; // surfaces the idle breath pulses
	anchor: Object3D; // label attach point, in the part's local space
	spin?: (t: number) => void; // optional idle motion (fans)
}

// an empty marker at height y inside the group — where the label leader will point.
function anchor(group: Group, y: number): Object3D {
	const a = new Object3D();
	a.position.set(0, y, 0);
	group.add(a);
	return a;
}

// CPU — a processor seen top-down: square substrate + raised heat-spreader. faces the camera
// so it reads as the familiar chip square. core count lightly engraves the spreader.
export function cpuChip(theme: Theme, magnitude: number, glow: Color, rng: Rng): Part {
	const g = new Group();
	const mat = surface(theme, glow, magnitude);
	const ihsMat = surface(theme, glow, magnitude);
	ihsMat.metalness = Math.min(1, ihsMat.metalness + 0.06); // spreader is the shinier face

	const span = 1.1 + magnitude * 0.25;
	g.add(new Mesh(new BoxGeometry(span, span, 0.12), mat)); // substrate
	const ihs = new Mesh(new BoxGeometry(span * 0.72, span * 0.72, 0.16), ihsMat);
	ihs.position.z = 0.13;
	g.add(ihs);

	// a few contact pads in one corner — small detail that says "chip", seeded for variety.
	const padMat = surface(theme, glow, magnitude);
	for (let i = 0; i < 3; i++) {
		const pad = new Mesh(new BoxGeometry(0.07, 0.07, 0.04), padMat);
		pad.position.set(span * 0.4 - i * 0.1, -span * 0.42 + range(rng, -0.02, 0.02), 0.08);
		g.add(pad);
	}

	return { object: g, materials: [mat, ihsMat, padMat], anchor: anchor(g, span * 0.6 + 0.2) };
}

// one cooling fan: a recessed disc with a spinning hub + blades, facing the camera.
function fan(radius: number, body: MeshStandardMaterial, hubMat: MeshStandardMaterial): { group: Group; spin: (t: number) => void } {
	const group = new Group();
	const disc = new Mesh(new CylinderGeometry(radius, radius, 0.08, 20), body);
	disc.rotation.x = Math.PI / 2; // circular face toward camera
	group.add(disc);

	const spinner = new Group();
	const hub = new Mesh(new CylinderGeometry(radius * 0.2, radius * 0.2, 0.12, 12), hubMat);
	hub.rotation.x = Math.PI / 2;
	hub.position.z = 0.06;
	spinner.add(hub);
	const blades = 7;
	for (let i = 0; i < blades; i++) {
		const a = (i / blades) * Math.PI * 2;
		const blade = new Mesh(new BoxGeometry(radius * 0.8, radius * 0.18, 0.03), body);
		blade.position.set(Math.cos(a) * radius * 0.45, Math.sin(a) * radius * 0.45, 0.05);
		blade.rotation.z = a;
		spinner.add(blade);
	}
	group.add(spinner);
	return { group, spin: (t) => (spinner.rotation.z = t * 1.6) };
}

// GPU — a graphics card: pcb + cooler shroud + 2–3 fans. length grows with the part. the
// most iconic silhouette on the board, so it leads the composition.
export function gpuCard(theme: Theme, magnitude: number, glow: Color, rng: Rng): Part {
	const g = new Group();
	const body = surface(theme, glow, magnitude);
	const accent = surface(theme, glow, magnitude);
	accent.emissiveIntensity *= 1.4; // fan hubs / vents catch the tier glow

	const w = 2.3 + magnitude * 0.9;
	g.add(new Mesh(new BoxGeometry(w, 0.95, 0.1), body)); // pcb
	const shroud = new Mesh(new BoxGeometry(w * 0.96, 0.82, 0.42), body);
	shroud.position.z = 0.26;
	g.add(shroud);

	const count = magnitude > 0.6 ? 3 : 2; // beefier cards get a third fan
	const r = (w * 0.96) / count / 2.25;
	const spins: Array<(t: number) => void> = [];
	for (let i = 0; i < count; i++) {
		const f = fan(r, body, accent);
		f.group.position.set((i - (count - 1) / 2) * (w * 0.96 / count), 0, 0.48);
		g.add(f.group);
		spins.push(f.spin);
	}

	return {
		object: g,
		materials: [body, accent],
		anchor: anchor(g, 0.75),
		spin: (t) => spins.forEach((s) => s(t))
	};
}

// RAM — upright sticks in a row, ONE PER MODULE so the count is literal. taller stick = bigger
// module (mixed kits read honestly). gold contact strip along the bottom.
export function ramSticks(theme: Theme, magnitude: number, moduleMb: number[], glow: Color, rng: Rng): Part {
	const g = new Group();
	const body = surface(theme, glow, magnitude);
	const contact = surface(theme, glow, magnitude);
	contact.emissiveIntensity *= 1.5;

	const mods = moduleMb.length ? moduleMb : [1];
	const max = Math.max(...mods);
	const gap = 0.34;
	mods.forEach((mb, i) => {
		const h = 0.85 + (mb / max) * 0.55;
		const x = (i - (mods.length - 1) / 2) * gap;
		const stick = new Mesh(new BoxGeometry(0.2, h, 0.07), body);
		stick.position.set(x, 0, 0);
		g.add(stick);
		const pins = new Mesh(new BoxGeometry(0.2, 0.08, 0.075), contact); // contact teeth
		pins.position.set(x, -h / 2 + 0.04, 0);
		g.add(pins);
	});

	const top = 0.85 + 0.55;
	return { object: g, materials: [body, contact], anchor: anchor(g, top / 2 + 0.25) };
}

// one drive unit — shape says the kind: nvme = slim m.2 stick, ssd = flat 2.5", hdd = a
// chunkier block. nvme reads hottest. returned one-per-drive so storage count is literal.
export function driveUnit(theme: Theme, magnitude: number, kind: 'nvme' | 'ssd' | 'hdd' | 'unknown', glow: Color, rng: Rng): Part {
	const g = new Group();
	const mat = surface(theme, glow, magnitude);
	let topY: number;

	if (kind === 'nvme') {
		mat.emissiveIntensity *= 1.3;
		g.add(new Mesh(new BoxGeometry(1.0, 0.24, 0.06), mat)); // m.2 board
		const chip = new Mesh(new BoxGeometry(0.34, 0.18, 0.08), mat); // controller chip
		chip.position.set(-0.18, 0, 0.05);
		g.add(chip);
		topY = 0.2;
	} else if (kind === 'hdd') {
		mat.emissiveIntensity *= 0.6;
		g.add(new Mesh(new BoxGeometry(0.78, 0.56, 0.22), mat));
		topY = 0.32;
	} else {
		// ssd / unknown — flat 2.5" block
		g.add(new Mesh(new BoxGeometry(0.7, 0.46, 0.12), mat));
		topY = 0.27;
	}

	return { object: g, materials: [mat], anchor: anchor(g, topY) };
}

// OS — a small badge plate. lowest billing; it just carries the os-name label.
export function osBadge(theme: Theme, glow: Color, rng: Rng): Part {
	const g = new Group();
	const mat = surface(theme, glow, 0.3);
	g.add(new Mesh(new BoxGeometry(0.5, 0.5, 0.08), mat));
	const inset = surface(theme, glow, 0.5);
	inset.emissiveIntensity *= 1.6;
	const tile = new Mesh(new BoxGeometry(0.28, 0.28, 0.1), inset);
	tile.position.z = 0.04;
	g.add(tile);
	return { object: g, materials: [mat, inset], anchor: anchor(g, 0.45) };
}
