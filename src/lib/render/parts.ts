import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	Object3D,
	TorusGeometry,
	type Color
} from 'three';
import type { Theme } from './themes';
import { surface } from './material';
import { range, type Rng } from './rng';

// recognizable hardware, not abstract solids (VISUAL_SYSTEM.md, the legibility law). each
// builder makes the *thing it is* from primitives — a chip, a graphics card, sticks, drives
// — and wears the world's finish via surface(). the tier decides how it's forged and lit
// (and now how it's *detailed*: rust is damaged + askew, mid gets premium plating, divine
// gets glowing ornament), but never what it is. every part exposes an `anchor` (an empty
// Object3D at its top) that the card pins a text label to.

export interface Part {
	object: Group;
	materials: MeshStandardMaterial[]; // surfaces the idle breath pulses
	anchor: Object3D; // label attach point, in the part's local space
	spin?: (t: number) => void; // optional idle motion (fans)
}

function anchor(group: Group, y: number): Object3D {
	const a = new Object3D();
	a.position.set(0, y, 0);
	group.add(a);
	return a;
}

// a brighter version of the world surface, for vents/contacts/ornament that catch the glow.
function accent(theme: Theme, glow: Color, magnitude: number, boost = 1.6): MeshStandardMaterial {
	const m = surface(theme, glow, magnitude);
	m.emissiveIntensity *= boost;
	return m;
}

// the three tier moods derived from the world's corrosion. one place so every part agrees on
// what "rusty" vs "premium" vs "divine" means.
function moods(theme: Theme) {
	return {
		damaged: theme.corrosion > 0.6, // rust: worn, chipped, sitting askew
		premium: theme.corrosion < 0.5, // mid+: heatspreaders, plating
		ornate: theme.corrosion < 0.12 // divine: glowing trim + halo
	};
}

// rust sits a touch askew, like loose/worn gear; clean tiers sit square.
function askew(group: Group, rng: Rng, on: boolean) {
	if (!on) return;
	group.rotation.z = range(rng, -0.06, 0.06);
	group.rotation.x = range(rng, -0.05, 0.05);
}

// a small dark chipped/worn patch stuck on a face — rust damage cue.
function chip(group: Group, rng: Rng, span: number) {
	const m = new MeshStandardMaterial({ color: 0x16110c, roughness: 1, metalness: 0.1 });
	const c = new Mesh(new BoxGeometry(range(rng, 0.08, 0.18), range(rng, 0.08, 0.16), 0.02), m);
	c.position.set(range(rng, -span / 2, span / 2), range(rng, -span / 2, span / 2), 0.07);
	group.add(c);
}

// CPU — a processor seen top-down: substrate + raised heat-spreader with engraved cross +
// an orientation notch. divine gets a glowing border; rust gets chipped + askew.
export function cpuChip(theme: Theme, magnitude: number, glow: Color, rng: Rng): Part {
	const g = new Group();
	const m = moods(theme);
	const mat = surface(theme, glow, magnitude);
	const ihsMat = surface(theme, glow, magnitude);
	ihsMat.metalness = Math.min(1, ihsMat.metalness + 0.06);
	const mats = [mat, ihsMat];

	const span = 1.1 + magnitude * 0.25;
	g.add(new Mesh(new BoxGeometry(span, span, 0.12), mat)); // substrate

	const ihs = new Mesh(new BoxGeometry(span * 0.72, span * 0.72, 0.16), ihsMat); // heat spreader
	ihs.position.z = 0.13;
	g.add(ihs);

	// engraved cross on the spreader (two recessed dark lines).
	const grooveMat = new MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9, metalness: 0.3 });
	const gh = new Mesh(new BoxGeometry(span * 0.72, 0.03, 0.02), grooveMat);
	gh.position.z = 0.22;
	const gv = new Mesh(new BoxGeometry(0.03, span * 0.72, 0.02), grooveMat);
	gv.position.z = 0.22;
	g.add(gh, gv);

	// orientation notch marker + corner contact pads — the little "this is a chip" tells.
	const padMat = accent(theme, glow, magnitude, 1.3);
	mats.push(padMat);
	const notch = new Mesh(new BoxGeometry(0.08, 0.08, 0.03), padMat);
	notch.position.set(-span * 0.4, -span * 0.4, 0.08);
	g.add(notch);
	for (let i = 0; i < 3; i++) {
		const pad = new Mesh(new BoxGeometry(0.06, 0.06, 0.04), padMat);
		pad.position.set(span * 0.4 - i * 0.1, -span * 0.42, 0.08);
		g.add(pad);
	}

	if (m.ornate) {
		const borderMat = accent(theme, glow, magnitude, 2.2);
		mats.push(borderMat);
		const border = new Mesh(new TorusGeometry(span * 0.62, 0.025, 4, 4), borderMat); // square halo
		border.rotation.z = Math.PI / 4;
		border.position.z = 0.14;
		g.add(border);
	}
	if (m.damaged) chip(g, rng, span * 0.8);
	askew(g, rng, m.damaged);

	return { object: g, materials: mats, anchor: anchor(g, span / 2 + 0.12) };
}

// one cooling fan: recessed disc + spinning hub & blades + a housing ring, facing the camera.
function fan(radius: number, body: MeshStandardMaterial, hub: MeshStandardMaterial): { group: Group; spin: (t: number) => void } {
	const group = new Group();
	const disc = new Mesh(new CylinderGeometry(radius, radius, 0.08, 20), body);
	disc.rotation.x = Math.PI / 2;
	const ring = new Mesh(new TorusGeometry(radius * 1.02, 0.04, 6, 22), hub); // housing rim
	ring.position.z = 0.05;
	group.add(disc, ring);

	const spinner = new Group();
	const cap = new Mesh(new CylinderGeometry(radius * 0.2, radius * 0.2, 0.12, 12), hub);
	cap.rotation.x = Math.PI / 2;
	cap.position.z = 0.06;
	spinner.add(cap);
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

// GPU — a graphics card: pcb with pcie fingers, cooler shroud with fans + vents, a backplate,
// and an i/o bracket. the most iconic silhouette, so it leads. divine adds a glowing top rail.
export function gpuCard(theme: Theme, magnitude: number, glow: Color, rng: Rng): Part {
	const g = new Group();
	const m = moods(theme);
	const body = surface(theme, glow, magnitude);
	const acc = accent(theme, glow, magnitude, 1.4);
	const mats = [body, acc];

	const w = 2.3 + magnitude * 0.9;
	g.add(new Mesh(new BoxGeometry(w, 0.95, 0.1), body)); // pcb
	g.add(((p) => ((p.position.z = -0.08), p))(new Mesh(new BoxGeometry(w * 0.98, 0.9, 0.04), body))); // backplate

	const shroud = new Mesh(new BoxGeometry(w * 0.96, 0.82, 0.42), body);
	shroud.position.z = 0.26;
	g.add(shroud);

	// pcie gold fingers along the bottom edge.
	const fingerMat = accent(theme, glow, magnitude, 1.3);
	mats.push(fingerMat);
	for (let i = 0; i < 10; i++) {
		const f = new Mesh(new BoxGeometry(0.05, 0.12, 0.11), fingerMat);
		f.position.set(-w * 0.32 + i * 0.07, -0.52, 0);
		g.add(f);
	}
	// i/o bracket on the left end.
	const bracket = new Mesh(new BoxGeometry(0.08, 1.05, 0.5), body);
	bracket.position.set(-w / 2 - 0.02, 0, 0.2);
	g.add(bracket);

	// vent slots on the shroud top.
	const ventMat = new MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.95, metalness: 0.2 });
	for (let i = 0; i < 6; i++) {
		const v = new Mesh(new BoxGeometry(0.04, 0.5, 0.02), ventMat);
		v.position.set(-w * 0.3 + i * (w * 0.6 / 5), 0, 0.48);
		g.add(v);
	}

	const count = magnitude > 0.6 ? 3 : 2;
	const r = (w * 0.96) / count / 2.25;
	const spins: Array<(t: number) => void> = [];
	for (let i = 0; i < count; i++) {
		const f = fan(r, body, acc);
		f.group.position.set((i - (count - 1) / 2) * ((w * 0.96) / count), 0, 0.48);
		g.add(f.group);
		spins.push(f.spin);
	}

	if (m.ornate) {
		const rail = new Mesh(new BoxGeometry(w * 0.9, 0.05, 0.05), accent(theme, glow, magnitude, 2.4));
		rail.position.set(0, 0.42, 0.48);
		g.add(rail);
		mats.push(rail.material as MeshStandardMaterial);
	}
	if (m.damaged) chip(g, rng, w * 0.7);
	askew(g, rng, m.damaged);

	return { object: g, materials: mats, anchor: anchor(g, 0.6), spin: (t) => spins.forEach((s) => s(t)) };
}

// RAM — upright sticks, ONE PER MODULE so the count is literal. bare pcb at rust, a
// heatspreader plate at mid+, glowing top fin at divine. taller stick = bigger module.
export function ramSticks(theme: Theme, magnitude: number, moduleMb: number[], glow: Color, rng: Rng): Part {
	const g = new Group();
	const md = moods(theme);
	const body = surface(theme, glow, magnitude);
	const contact = accent(theme, glow, magnitude, 1.5);
	const mats = [body, contact];
	const spreaderMat = md.premium ? surface(theme, glow, magnitude) : null;
	if (spreaderMat) mats.push(spreaderMat);
	const finMat = md.ornate ? accent(theme, glow, magnitude, 2.4) : null;
	if (finMat) mats.push(finMat);

	const mods = moduleMb.length ? moduleMb : [1];
	const max = Math.max(...mods);
	const gap = 0.36;
	let top = 0;
	mods.forEach((mb, i) => {
		const h = 0.85 + (mb / max) * 0.55;
		top = Math.max(top, h);
		const x = (i - (mods.length - 1) / 2) * gap;

		const stick = new Mesh(new BoxGeometry(0.2, h, 0.06), body);
		stick.position.set(x, 0, 0);
		g.add(stick);

		if (spreaderMat) {
			const plate = new Mesh(new BoxGeometry(0.24, h * 0.82, 0.09), spreaderMat);
			plate.position.set(x, 0.05, 0);
			g.add(plate);
		}
		if (finMat) {
			const fin = new Mesh(new BoxGeometry(0.24, 0.05, 0.11), finMat);
			fin.position.set(x, h / 2 - 0.02, 0);
			g.add(fin);
		}
		// contact teeth with a notch (gap) — the connector edge.
		[-0.05, 0.05].forEach((off) => {
			const teeth = new Mesh(new BoxGeometry(0.085, 0.08, 0.075), contact);
			teeth.position.set(x + off, -h / 2 + 0.04, 0);
			g.add(teeth);
		});
	});

	askew(g, rng, md.damaged);
	return { object: g, materials: mats, anchor: anchor(g, top / 2 + 0.12) };
}

// one drive unit — shape says the kind: nvme = slim m.2 with controller + label, ssd = flat
// 2.5" with inset lid, hdd = chunkier block with a platter hint. one per drive = literal count.
export function driveUnit(theme: Theme, magnitude: number, kind: 'nvme' | 'ssd' | 'hdd' | 'unknown', glow: Color, rng: Rng): Part {
	const g = new Group();
	const md = moods(theme);
	const mat = surface(theme, glow, magnitude);
	const mats = [mat];
	let topY: number;

	if (kind === 'nvme') {
		mat.emissiveIntensity *= 1.3;
		g.add(new Mesh(new BoxGeometry(1.0, 0.24, 0.06), mat)); // m.2 board
		const chipMat = surface(theme, glow, magnitude);
		mats.push(chipMat);
		const ctrl = new Mesh(new BoxGeometry(0.32, 0.18, 0.08), chipMat); // controller
		ctrl.position.set(-0.16, 0, 0.05);
		g.add(ctrl);
		const fingers = accent(theme, glow, magnitude, 1.3);
		mats.push(fingers);
		const edge = new Mesh(new BoxGeometry(0.1, 0.2, 0.07), fingers); // gold key edge
		edge.position.set(0.46, 0, 0);
		g.add(edge);
		topY = 0.2;
	} else if (kind === 'hdd') {
		mat.emissiveIntensity *= 0.6;
		g.add(new Mesh(new BoxGeometry(0.78, 0.56, 0.22), mat));
		const platterMat = surface(theme, glow, magnitude);
		mats.push(platterMat);
		const platter = new Mesh(new CylinderGeometry(0.18, 0.18, 0.04, 18), platterMat);
		platter.rotation.x = Math.PI / 2;
		platter.position.set(0.06, 0, 0.13);
		g.add(platter);
		topY = 0.34;
	} else {
		g.add(new Mesh(new BoxGeometry(0.7, 0.46, 0.12), mat)); // 2.5" case
		const lidMat = surface(theme, glow, magnitude);
		mats.push(lidMat);
		const lid = new Mesh(new BoxGeometry(0.56, 0.34, 0.04), lidMat); // recessed lid
		lid.position.z = 0.07;
		g.add(lid);
		topY = 0.29;
	}

	if (md.damaged) chip(g, rng, 0.4);
	askew(g, rng, md.damaged);
	return { object: g, materials: mats, anchor: anchor(g, topY) };
}

// OS — a small badge plate with a glowing inset tile. lowest billing; carries the os label.
export function osBadge(theme: Theme, glow: Color, rng: Rng): Part {
	const g = new Group();
	const mat = surface(theme, glow, 0.3);
	const inset = accent(theme, glow, 0.5, 1.8);
	g.add(new Mesh(new BoxGeometry(0.5, 0.5, 0.08), mat));
	const tile = new Mesh(new BoxGeometry(0.28, 0.28, 0.1), inset);
	tile.position.z = 0.04;
	g.add(tile);
	askew(g, rng, moods(theme).damaged);
	return { object: g, materials: [mat, inset], anchor: anchor(g, 0.32) };
}
