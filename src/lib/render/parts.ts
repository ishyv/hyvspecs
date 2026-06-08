import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	Object3D,
	PlaneGeometry,
	TorusGeometry,
	type Color
} from 'three';
import type { Theme } from './themes';
import { surface, texturedSurface } from './material';
import { sticker } from './texture';
import { range, type Rng } from './rng';

// recognizable hardware, not abstract solids (VISUAL_SYSTEM.md, the legibility law). each
// builder makes the *thing it is* from primitives wearing procedurally-textured worn metal,
// so parts look forged and distinct instead of identical flat boxes. the tier decides the
// finish (rust = chipped + askew, mid = plated, divine = glowing ornament), never the form.
// every part exposes an `anchor` the card pins a text label to.

export interface Part {
	object: Group;
	materials: MeshStandardMaterial[]; // surfaces the idle breath pulses
	anchor: Object3D;
	spin?: (t: number) => void;
}

function anchor(group: Group, y: number): Object3D {
	const a = new Object3D();
	a.position.set(0, y, 0);
	group.add(a);
	return a;
}

function accent(theme: Theme, glow: Color, magnitude: number, boost = 1.6): MeshStandardMaterial {
	const m = surface(theme, glow, magnitude);
	m.emissiveIntensity *= boost;
	return m;
}

const DARK = () => new MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.85, metalness: 0.3 });

function moods(theme: Theme) {
	return {
		damaged: theme.corrosion > 0.6,
		premium: theme.corrosion < 0.5,
		ornate: theme.corrosion < 0.12
	};
}

function askew(group: Group, rng: Rng, on: boolean) {
	if (!on) return;
	group.rotation.z = range(rng, -0.06, 0.06);
	group.rotation.x = range(rng, -0.05, 0.05);
}

function chip(group: Group, rng: Rng, span: number) {
	const m = new MeshStandardMaterial({ color: 0x16110c, roughness: 1, metalness: 0.1 });
	const c = new Mesh(new BoxGeometry(range(rng, 0.08, 0.18), range(rng, 0.08, 0.16), 0.02), m);
	c.position.set(range(rng, -span / 2, span / 2), range(rng, -span / 2, span / 2), 0.07);
	group.add(c);
}

// CPU — top-down processor: substrate + heat-spreader engraved with a CHIPLET GRID whose
// count grows with the part (more cores → more dies), so two cpus rarely look alike. notch +
// pads sell the silhouette; divine gets a glowing border, rust gets chipped + askew.
export function cpuChip(theme: Theme, magnitude: number, glow: Color, rng: Rng): Part {
	const g = new Group();
	const m = moods(theme);
	const body = texturedSurface(theme, glow, magnitude, rng);
	const ihsMat = texturedSurface(theme, glow, magnitude, rng);
	ihsMat.metalness = Math.min(1, ihsMat.metalness + 0.06);
	const mats = [body, ihsMat];

	const span = 1.1 + magnitude * 0.25;
	g.add(new Mesh(new BoxGeometry(span, span, 0.12), body));
	const ihs = new Mesh(new BoxGeometry(span * 0.74, span * 0.74, 0.16), ihsMat);
	ihs.position.z = 0.13;
	g.add(ihs);

	// chiplet grid recessed into the spreader — variety + meaning (die count ~ power).
	const groove = DARK();
	const n = magnitude > 0.66 ? 3 : magnitude > 0.33 ? 2 : 1; // grid is n×n dies
	const cell = (span * 0.62) / n;
	for (let r = 0; r < n; r++) {
		for (let c = 0; c < n; c++) {
			const die = new Mesh(new BoxGeometry(cell * 0.78, cell * 0.78, 0.03), groove);
			die.position.set((c - (n - 1) / 2) * cell, (r - (n - 1) / 2) * cell, 0.22);
			g.add(die);
		}
	}

	const padMat = accent(theme, glow, magnitude, 1.3);
	mats.push(padMat);
	const notch = new Mesh(new BoxGeometry(0.08, 0.08, 0.03), padMat);
	notch.position.set(-span * 0.4, -span * 0.4, 0.08);
	g.add(notch);

	if (m.ornate) {
		const borderMat = accent(theme, glow, magnitude, 2.2);
		mats.push(borderMat);
		const border = new Mesh(new TorusGeometry(span * 0.62, 0.025, 4, 4), borderMat);
		border.rotation.z = Math.PI / 4;
		border.position.z = 0.14;
		g.add(border);
	}
	if (m.damaged) chip(g, rng, span * 0.8);
	askew(g, rng, m.damaged);

	return { object: g, materials: mats, anchor: anchor(g, span / 2 + 0.12) };
}

function fan(radius: number, body: MeshStandardMaterial, hub: MeshStandardMaterial): { group: Group; spin: (t: number) => void } {
	const group = new Group();
	const disc = new Mesh(new CylinderGeometry(radius, radius, 0.08, 20), body);
	disc.rotation.x = Math.PI / 2;
	const ring = new Mesh(new TorusGeometry(radius * 1.02, 0.04, 6, 22), hub);
	ring.position.z = 0.05;
	group.add(disc, ring);

	const spinner = new Group();
	const cap = new Mesh(new CylinderGeometry(radius * 0.2, radius * 0.2, 0.12, 12), hub);
	cap.rotation.x = Math.PI / 2;
	cap.position.z = 0.06;
	spinner.add(cap);
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * Math.PI * 2;
		const blade = new Mesh(new BoxGeometry(radius * 0.8, radius * 0.18, 0.03), body);
		blade.position.set(Math.cos(a) * radius * 0.45, Math.sin(a) * radius * 0.45, 0.05);
		blade.rotation.z = a;
		spinner.add(blade);
	}
	group.add(spinner);
	return { group, spin: (t) => (spinner.rotation.z = t * 1.6) };
}

// GPU — a graphics card: textured pcb + cooler shroud with fans, vents, pcie gold fingers, an
// i/o bracket and a backplate. leads the composition. divine adds a glowing top rail.
export function gpuCard(theme: Theme, magnitude: number, glow: Color, rng: Rng): Part {
	const g = new Group();
	const m = moods(theme);
	const body = texturedSurface(theme, glow, magnitude, rng);
	const acc = accent(theme, glow, magnitude, 1.4);
	const mats = [body, acc];

	const w = 2.3 + magnitude * 0.9;
	g.add(new Mesh(new BoxGeometry(w, 0.95, 0.1), body));
	const back = new Mesh(new BoxGeometry(w * 0.98, 0.9, 0.04), body);
	back.position.z = -0.08;
	g.add(back);
	const shroud = new Mesh(new BoxGeometry(w * 0.96, 0.82, 0.42), body);
	shroud.position.z = 0.26;
	g.add(shroud);

	const fingerMat = accent(theme, glow, magnitude, 1.3);
	mats.push(fingerMat);
	for (let i = 0; i < 10; i++) {
		const f = new Mesh(new BoxGeometry(0.05, 0.12, 0.11), fingerMat);
		f.position.set(-w * 0.32 + i * 0.07, -0.52, 0);
		g.add(f);
	}
	const bracket = new Mesh(new BoxGeometry(0.08, 1.05, 0.5), body);
	bracket.position.set(-w / 2 - 0.02, 0, 0.2);
	g.add(bracket);

	const vent = DARK();
	for (let i = 0; i < 6; i++) {
		const v = new Mesh(new BoxGeometry(0.04, 0.5, 0.02), vent);
		v.position.set(-w * 0.3 + i * ((w * 0.6) / 5), 0, 0.48);
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

// RAM — upright sticks, ONE PER MODULE (count is literal). every stick wears a textured
// heat-spreader with ridged fins and a glowing top light-bar (the "impressive" rgb read),
// brighter with the tier. taller stick = bigger module.
export function ramSticks(theme: Theme, magnitude: number, moduleMb: number[], glow: Color, rng: Rng): Part {
	const g = new Group();
	const md = moods(theme);
	const pcb = texturedSurface(theme, glow, magnitude, rng);
	const spreader = texturedSurface(theme, glow, magnitude, rng);
	const bar = accent(theme, glow, magnitude, md.ornate ? 2.6 : 1.8);
	const teeth = accent(theme, glow, magnitude, 1.4);
	const fin = DARK();
	const mats = [pcb, spreader, bar, teeth];

	const mods = moduleMb.length ? moduleMb : [1];
	const max = Math.max(...mods);
	const gap = 0.4;
	let top = 0;
	mods.forEach((mb, i) => {
		const h = 1.0 + (mb / max) * 0.5;
		top = Math.max(top, h);
		const x = (i - (mods.length - 1) / 2) * gap;

		g.add(place(new Mesh(new BoxGeometry(0.22, h, 0.05), pcb), x, 0, 0));
		const plate = new Mesh(new BoxGeometry(0.26, h * 0.8, 0.1), spreader); // heat spreader
		plate.position.set(x, 0.03, 0);
		g.add(plate);
		// ridged fins across the spreader.
		for (let f = 0; f < 4; f++) {
			const ridge = new Mesh(new BoxGeometry(0.27, 0.02, 0.11), fin);
			ridge.position.set(x, h * 0.28 - f * 0.12, 0);
			g.add(ridge);
		}
		// glowing top light bar — the rgb crown.
		const crown = new Mesh(new BoxGeometry(0.27, 0.06, 0.12), bar);
		crown.position.set(x, h / 2 - 0.02, 0);
		g.add(crown);
		// contact teeth at the bottom with a notch gap.
		[-0.055, 0.055].forEach((off) => {
			const t = new Mesh(new BoxGeometry(0.09, 0.09, 0.06), teeth);
			t.position.set(x + off, -h / 2 + 0.045, 0);
			g.add(t);
		});
	});

	askew(g, rng, md.damaged);
	return { object: g, materials: mats, anchor: anchor(g, top / 2 + 0.14) };
}

// one drive — capacity made FAITHFUL: nvme shows a NAND chip per ~chunk of capacity (a 4tb
// stick is visibly denser than a 256gb one), ssd/hdd scale physically and carry a printed
// sticker with the real number. shape says the kind, one unit per drive = literal count.
export function driveUnit(
	theme: Theme,
	magnitude: number,
	kind: 'nvme' | 'ssd' | 'hdd' | 'unknown',
	capacityGb: number,
	labelText: string,
	glow: Color,
	rng: Rng
): Part {
	const g = new Group();
	const md = moods(theme);
	const body = texturedSurface(theme, glow, magnitude, rng);
	const mats = [body];
	// physical heft tracks capacity (clamped), so bigger drives read bigger.
	const heft = 0.85 + Math.min(capacityGb, 4096) / 4096 * 0.5;
	let topY: number;

	if (kind === 'nvme') {
		body.emissiveIntensity *= 1.2;
		const w = 1.0;
		g.add(new Mesh(new BoxGeometry(w, 0.26, 0.05), body)); // m.2 board
		// NAND packages: one per ~512gb, so capacity is legible as chip density.
		const nand = DARK();
		const chips = Math.max(1, Math.min(4, Math.round(capacityGb / 512)));
		for (let i = 0; i < chips; i++) {
			const pkg = new Mesh(new BoxGeometry(0.18, 0.18, 0.07), nand);
			pkg.position.set(0.34 - i * 0.22, 0, 0.05);
			g.add(pkg);
		}
		const fingers = accent(theme, glow, magnitude, 1.3);
		mats.push(fingers);
		const edge = new Mesh(new BoxGeometry(0.1, 0.2, 0.07), fingers);
		edge.position.set(0.46, 0, 0);
		g.add(edge);
		topY = 0.2;
	} else {
		// ssd (flat) / hdd (chunkier) — a real case with a printed label on the face.
		const w = (kind === 'hdd' ? 0.82 : 0.72) * heft;
		const h = (kind === 'hdd' ? 0.58 : 0.46) * heft;
		const d = kind === 'hdd' ? 0.22 : 0.12;
		if (kind === 'hdd') body.emissiveIntensity *= 0.65;
		g.add(new Mesh(new BoxGeometry(w, h, d), body));

		const label = new Mesh(
			new PlaneGeometry(w * 0.82, h * 0.66),
			new MeshStandardMaterial({ map: sticker(rng, kind, labelText), roughness: 0.85, metalness: 0, emissive: glow, emissiveIntensity: 0.12 })
		);
		label.position.z = d / 2 + 0.001;
		g.add(label);
		mats.push(label.material as MeshStandardMaterial);

		// corner screws.
		const screw = DARK();
		[-1, 1].forEach((sx) =>
			[-1, 1].forEach((sy) => {
				const s = new Mesh(new CylinderGeometry(0.02, 0.02, 0.02, 6), screw);
				s.rotation.x = Math.PI / 2;
				s.position.set(sx * w * 0.42, sy * h * 0.38, d / 2);
				g.add(s);
			})
		);
		topY = h / 2 + 0.06;
	}

	if (md.damaged) chip(g, rng, 0.4);
	askew(g, rng, md.damaged);
	return { object: g, materials: mats, anchor: anchor(g, topY) };
}

// helper: set a mesh's position and return it (keeps ram loop terse).
function place<T extends Object3D>(o: T, x: number, y: number, z: number): T {
	o.position.set(x, y, z);
	return o;
}

// OS — a small badge plate with a glowing inset tile. lowest billing; carries the os label.
export function osBadge(theme: Theme, glow: Color, rng: Rng): Part {
	const g = new Group();
	const mat = texturedSurface(theme, glow, 0.3, rng);
	const inset = accent(theme, glow, 0.5, 1.8);
	g.add(new Mesh(new BoxGeometry(0.5, 0.5, 0.08), mat));
	const tile = new Mesh(new BoxGeometry(0.28, 0.28, 0.1), inset);
	tile.position.z = 0.04;
	g.add(tile);
	askew(g, rng, moods(theme).damaged);
	return { object: g, materials: [mat, inset], anchor: anchor(g, 0.32) };
}
