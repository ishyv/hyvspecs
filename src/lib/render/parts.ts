import {
	BoxGeometry,
	CanvasTexture,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	Object3D,
	OctahedronGeometry,
	PlaneGeometry,
	RepeatWrapping,
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

function canvas(size = 256): HTMLCanvasElement {
	const c = document.createElement('canvas');
	c.width = c.height = size;
	return c;
}

function hazardTexture(): CanvasTexture {
	const c = canvas(128);
	const x = c.getContext('2d')!;
	x.fillStyle = '#16161a';
	x.fillRect(0, 0, 128, 128);
	x.strokeStyle = '#d99c3b';
	x.lineWidth = 16;
	for (let i = -4; i < 12; i++) {
		x.beginPath();
		x.moveTo(i * 24 - 24, 0);
		x.lineTo(i * 24 + 24, 128);
		x.stroke();
	}
	const t = new CanvasTexture(c);
	t.wrapS = t.wrapT = RepeatWrapping;
	return t;
}

function moods(theme: Theme) {
	return {
		rust: theme.name === 'rust',
		iron: theme.name === 'iron',
		overcharge: theme.name === 'overcharge',
		alloy: theme.name === 'alloy',
		divine: theme.name === 'divine',
		damaged: theme.name === 'rust',
		premium: theme.name !== 'rust',
		ornate: theme.name === 'divine'
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

	let spin: ((t: number) => void) | undefined;

	if (m.ornate) {
		// Divine: Levitating crystal octahedron that spins and bobs in 3D space
		const crystalMat = accent(theme, glow, magnitude, 2.5);
		mats.push(crystalMat);
		const crystal = new Mesh(new OctahedronGeometry(span * 0.3, 0), crystalMat);
		crystal.position.set(0, 0, 0.35);
		g.add(crystal);
		
		const borderMat = accent(theme, glow, magnitude, 2.2);
		mats.push(borderMat);
		const border = new Mesh(new TorusGeometry(span * 0.62, 0.025, 4, 4), borderMat);
		border.rotation.z = Math.PI / 4;
		border.position.z = 0.14;
		g.add(border);

		spin = (t) => {
			crystal.rotation.y = t * 1.5;
			crystal.rotation.x = t * 0.8;
			crystal.position.z = 0.35 + Math.sin(t * 3.5) * 0.08;
			border.rotation.z = Math.PI / 4 - t * 0.4;
		};
	} else if (m.alloy) {
		// Alloy (Enthusiast): CPU spreader topped with rotating energy torus core
		const ihs = new Mesh(new BoxGeometry(span * 0.74, span * 0.74, 0.16), ihsMat);
		ihs.position.z = 0.13;
		g.add(ihs);

		const ringMat = accent(theme, glow, magnitude, 2.2);
		mats.push(ringMat);
		const energyRing = new Mesh(new TorusGeometry(span * 0.28, 0.04, 8, 24), ringMat);
		energyRing.position.set(0, 0, 0.23);
		g.add(energyRing);

		spin = (t) => {
			energyRing.rotation.z = t * 2.5;
		};
	} else if (m.iron) {
		// Iron (Industrial Heatsink): Heavy copper fins instead of standard spreader
		const copperMat = new MeshStandardMaterial({ color: 0xa55a3a, roughness: 0.52, metalness: 0.82 });
		mats.push(copperMat);
		
		const finCount = 6;
		const finSpacing = (span * 0.74) / (finCount - 1);
		for (let i = 0; i < finCount; i++) {
			const x = -span * 0.37 + i * finSpacing;
			const finMesh = new Mesh(new BoxGeometry(0.025, span * 0.74, 0.25), copperMat);
			finMesh.position.set(x, 0, 0.18);
			g.add(finMesh);
		}
	} else {
		// Standard / Potato: Industrial CPU heat spreader
		const ihs = new Mesh(new BoxGeometry(span * 0.74, span * 0.74, 0.16), ihsMat);
		ihs.position.z = 0.13;
		g.add(ihs);

		// chiplet grid recessed into the spreader
		const groove = DARK();
		const n = magnitude > 0.66 ? 3 : magnitude > 0.33 ? 2 : 1;
		const cell = (span * 0.62) / n;
		for (let r = 0; r < n; r++) {
			for (let c = 0; c < n; c++) {
				const die = new Mesh(new BoxGeometry(cell * 0.78, cell * 0.78, 0.03), groove);
				die.position.set((c - (n - 1) / 2) * cell, (r - (n - 1) / 2) * cell, 0.22);
				g.add(die);
			}
		}

		if (m.damaged) {
			// Potato: Hand-wrapped copper wire loop coils wrapped around the CPU
			const wireMat = new MeshStandardMaterial({ color: 0xb87333, roughness: 0.8, metalness: 0.6 });
			mats.push(wireMat);
			const wire1 = new Mesh(new TorusGeometry(span * 0.22, 0.032, 4, 12, Math.PI), wireMat);
			wire1.rotation.y = Math.PI / 2;
			wire1.position.set(-span * 0.2, 0, 0.1);
			const wire2 = new Mesh(new TorusGeometry(span * 0.18, 0.032, 4, 12, Math.PI), wireMat);
			wire2.rotation.y = -Math.PI / 2;
			wire2.position.set(span * 0.2, span * 0.08, 0.1);
			g.add(wire1, wire2);
		}
	}

	const padMat = accent(theme, glow, magnitude, 1.3);
	mats.push(padMat);
	const notch = new Mesh(new BoxGeometry(0.08, 0.08, 0.03), padMat);
	notch.position.set(-span * 0.4, -span * 0.4, 0.08);
	g.add(notch);

	if (m.damaged) chip(g, rng, span * 0.8);
	askew(g, rng, m.damaged);

	return { object: g, materials: mats, anchor: anchor(g, span / 2 + 0.12), spin };
}

function fan(radius: number, body: MeshStandardMaterial, hub: MeshStandardMaterial, damaged: boolean, ornate: boolean, iron?: boolean): { group: Group; spin: (t: number) => void } {
	const group = new Group();

	if (ornate) {
		// Divine: Gyroscopic concentric glowing neon rings spinning in opposite directions
		const ring1 = new Mesh(new TorusGeometry(radius * 0.85, 0.03, 8, 24), hub);
		ring1.position.z = 0.05;
		const ring2 = new Mesh(new TorusGeometry(radius * 0.52, 0.02, 8, 24), hub);
		ring2.position.z = 0.05;
		group.add(ring1, ring2);
		return {
			group,
			spin: (t) => {
				ring1.rotation.z = t * 2.2;
				ring2.rotation.z = -t * 3.2;
			}
		};
	}

	if (iron) {
		// Iron (Industrial Blower): Concentric fins inside a drum cage spinning fast
		const wheel = new Group();
		const baseDisc = new Mesh(new CylinderGeometry(radius, radius, 0.04, 16), body);
		baseDisc.rotation.x = Math.PI / 2;
		wheel.add(baseDisc);
		
		const finMat = DARK();
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * Math.PI * 2;
			const fMesh = new Mesh(new BoxGeometry(0.022, radius * 0.9, 0.2), finMat);
			fMesh.rotation.z = a;
			fMesh.position.set(Math.cos(a) * radius * 0.52, Math.sin(a) * radius * 0.52, 0.1);
			wheel.add(fMesh);
		}
		group.add(wheel);
		return {
			group,
			spin: (t) => {
				wheel.rotation.z = t * 2.8;
			}
		};
	}

	if (damaged) {
		// Potato: Wobbling axis, uneven spacing, missing blades
		group.rotation.x = 0.12;
		group.rotation.y = 0.06;

		const spinner = new Group();
		const cap = new Mesh(new CylinderGeometry(radius * 0.22, radius * 0.22, 0.12, 8), hub);
		cap.rotation.x = Math.PI / 2;
		cap.position.z = 0.06;
		spinner.add(cap);

		// Only 3 uneven/broken blades
		const angles = [0, 1.25, 3.5];
		for (const a of angles) {
			const blade = new Mesh(new BoxGeometry(radius * 0.8, radius * 0.18, 0.03), body);
			blade.position.set(Math.cos(a) * radius * 0.45, Math.sin(a) * radius * 0.45, 0.05);
			blade.rotation.z = a;
			spinner.add(blade);
		}
		group.add(spinner);
		return { group, spin: (t) => (spinner.rotation.z = t * 1.0) };
	}

	// Standard
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
	back.position.set(0, 0, -0.08);
	g.add(back);

	if (m.ornate) {
		// Divine: minimal crystal frame holding the gyroscopic neon rings
		const frameMat = accent(theme, glow, magnitude, 2.2);
		mats.push(frameMat);
		const topBar = new Mesh(new BoxGeometry(w * 0.96, 0.04, 0.1), frameMat);
		topBar.position.set(0, 0.4, 0.2);
		const bottomBar = new Mesh(new BoxGeometry(w * 0.96, 0.04, 0.1), frameMat);
		bottomBar.position.set(0, -0.4, 0.2);
		g.add(topBar, bottomBar);
	} else {
		const shroud = new Mesh(new BoxGeometry(w * 0.96, 0.82, 0.42), body);
		shroud.position.z = 0.26;
		g.add(shroud);
	}

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
	if (m.iron) {
		// Iron: Left vents on the blower style card
		for (let i = 0; i < 4; i++) {
			const v = new Mesh(new BoxGeometry(0.06, 0.45, 0.02), vent);
			v.position.set(-w * 0.22 + i * 0.12, 0, 0.48);
			g.add(v);
		}
	} else if (!m.ornate) {
		// Standard vents
		for (let i = 0; i < 6; i++) {
			const v = new Mesh(new BoxGeometry(0.04, 0.5, 0.02), vent);
			v.position.set(-w * 0.3 + i * ((w * 0.6) / 5), 0, 0.48);
			g.add(v);
		}
	}

	// Overcharge geometric cuts
	if (m.overcharge) {
		const plateMat = accent(theme, glow, magnitude, 1.8);
		mats.push(plateMat);
		const accentPlate1 = new Mesh(new BoxGeometry(0.12, 0.6, 0.03), plateMat);
		accentPlate1.position.set(-w * 0.38, 0.2, 0.48);
		accentPlate1.rotation.z = Math.PI / 4;
		const accentPlate2 = new Mesh(new BoxGeometry(0.12, 0.6, 0.03), plateMat);
		accentPlate2.position.set(w * 0.38, -0.2, 0.48);
		accentPlate2.rotation.z = Math.PI / 4;
		g.add(accentPlate1, accentPlate2);
	}

	// Alloy logo
	if (m.alloy) {
		const logoMat = accent(theme, glow, magnitude, 2.0);
		mats.push(logoMat);
		const logo = new Mesh(new BoxGeometry(w * 0.25, 0.08, 0.08), logoMat);
		logo.position.set(0, 0.42, 0.48);
		g.add(logo);
	}

	let count = magnitude > 0.6 ? 3 : 2;
	if (m.damaged) count = 1;
	if (m.iron) count = 1;
	if (m.ornate) count = 2; // Dual neon rings

	const r = (w * 0.96) / count / 2.25;
	const spins: Array<(t: number) => void> = [];
	for (let i = 0; i < count; i++) {
		const f = fan(r, body, acc, m.damaged, m.ornate, m.iron);
		let fx = (i - (count - 1) / 2) * ((w * 0.96) / count);
		let fy = 0;
		let fz = m.ornate ? 0.2 : 0.48;
		if (m.iron) {
			fx = w * 0.22;
			fz = 0.36;
		}
		f.group.position.set(fx, fy, fz);
		g.add(f.group);
		spins.push(f.spin);
	}

	if (m.ornate) {
		const rail = new Mesh(new BoxGeometry(w * 0.9, 0.05, 0.05), accent(theme, glow, magnitude, 2.4));
		rail.position.set(0, 0.42, 0.2);
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

	// Custom Spreader for Iron: hazard stripes
	let ironSpreaderMat: MeshStandardMaterial | undefined;
	if (md.iron) {
		const hazardSp = hazardTexture();
		ironSpreaderMat = new MeshStandardMaterial({
			map: hazardSp,
			roughness: theme.roughness,
			metalness: theme.metalness,
			emissive: glow,
			emissiveIntensity: theme.emissive * 0.3
		});
		mats.push(ironSpreaderMat);
	}

	const mods = moduleMb.length ? moduleMb : [1];
	const max = Math.max(...mods);
	const gap = 0.4;
	let top = 0;

	const stickGroups: Group[] = [];

	mods.forEach((mb, i) => {
		const h = 1.0 + (mb / max) * 0.5;
		top = Math.max(top, h);
		const x = (i - (mods.length - 1) / 2) * gap;

		const stickGroup = new Group();
		stickGroup.position.x = x;

		if (md.ornate) {
			// Divine: glowing crystal monolith pillars
			const crystalMat = accent(theme, glow, magnitude, 2.5);
			mats.push(crystalMat);
			const crystal = new Mesh(new BoxGeometry(0.18, h, 0.18), crystalMat);
			stickGroup.add(crystal);
		} else {
			// Standard, Iron, Alloy, Rust
			const showSpreader = !(md.damaged && i === 1 && mods.length > 1);
			stickGroup.add(place(new Mesh(new BoxGeometry(0.22, h, 0.05), pcb), 0, 0, 0));

			if (showSpreader) {
				const currentSpreaderMat = md.iron && ironSpreaderMat ? ironSpreaderMat : spreader;
				const plate = new Mesh(new BoxGeometry(0.26, h * 0.8, 0.1), currentSpreaderMat);
				plate.position.set(0, 0.03, 0);
				stickGroup.add(plate);

				for (let f = 0; f < 4; f++) {
					const ridge = new Mesh(new BoxGeometry(0.27, 0.02, 0.11), fin);
					ridge.position.set(0, h * 0.28 - f * 0.12, 0);
					stickGroup.add(ridge);
				}

				const crown = new Mesh(new BoxGeometry(0.27, 0.06, 0.12), bar);
				crown.position.set(0, h / 2 - 0.02, 0);
				stickGroup.add(crown);

				// Alloy: neon accent bars on sides of the spreader plate
				if (md.alloy) {
					const accentBarMat = accent(theme, glow, magnitude, 2.2);
					mats.push(accentBarMat);
					const neonBarL = new Mesh(new BoxGeometry(0.03, h * 0.5, 0.12), accentBarMat);
					neonBarL.position.set(-0.14, 0, 0);
					const neonBarR = new Mesh(new BoxGeometry(0.03, h * 0.5, 0.12), accentBarMat);
					neonBarR.position.set(0.14, 0, 0);
					stickGroup.add(neonBarL, neonBarR);
				}
			} else {
				// Bare chips for potato stripped RAM
				const chipMat = DARK();
				for (let c = 0; c < 3; c++) {
					const cMesh = new Mesh(new BoxGeometry(0.16, 0.16, 0.04), chipMat);
					cMesh.position.set(0, -h * 0.2 + c * 0.2, 0.04);
					stickGroup.add(cMesh);
				}
			}

			[-0.055, 0.055].forEach((off) => {
				const t = new Mesh(new BoxGeometry(0.09, 0.09, 0.06), teeth);
				t.position.set(off, -h / 2 + 0.045, 0);
				stickGroup.add(t);
			});
		}

		// Potato: Bend/tilt the stripped stick out of alignment
		if (md.damaged && i === 1 && mods.length > 1) {
			stickGroup.rotation.z = 0.14;
			stickGroup.position.x += 0.06;
			stickGroup.position.y += 0.04;
		}

		g.add(stickGroup);
		stickGroups.push(stickGroup);
	});

	let spin: ((t: number) => void) | undefined;
	if (md.ornate) {
		// Divine: Floating RAM sticks bobbing independently in 3D
		spin = (t) => {
			stickGroups.forEach((sg, i) => {
				sg.position.y = Math.sin(t * 2.8 + i * 1.4) * 0.12;
			});
		};
	}

	askew(g, rng, md.damaged);
	return { object: g, materials: mats, anchor: anchor(g, top / 2 + 0.14), spin };
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
	const heft = 0.85 + Math.min(capacityGb, 4096) / 4096 * 0.5;
	let topY: number;
	let spin: ((t: number) => void) | undefined;

	const w = (kind === 'hdd' ? 0.82 : 0.72) * heft;
	const h = (kind === 'hdd' ? 0.58 : 0.46) * heft;
	const d = kind === 'hdd' ? 0.22 : 0.12;

	if (md.ornate) {
		// Divine: Levitating crystal storage shard spinning in space
		const shardMat = accent(theme, glow, magnitude, 2.4);
		mats.push(shardMat);
		const shard = new Mesh(new OctahedronGeometry(0.35 * heft, 0), shardMat);
		shard.scale.set(0.6, 1.4, 0.6); // stretch to make a shard
		shard.position.set(0, 0, 0.35);
		g.add(shard);
		topY = 0.6 * heft;
		spin = (t) => {
			shard.rotation.y = t * 1.8;
			shard.position.z = 0.35 + Math.sin(t * 3.0) * 0.06;
		};
	} else if (kind === 'hdd' && md.iron) {
		// Iron HDD: open-platter magnetic drive
		const baseBox = new Mesh(new BoxGeometry(w, h, d * 0.6), body);
		baseBox.position.z = -d * 0.2;
		g.add(baseBox);
		
		const platterMat = new MeshStandardMaterial({ color: 0xcccccc, roughness: 0.12, metalness: 0.95 });
		mats.push(platterMat);
		const platter = new Mesh(new CylinderGeometry(w * 0.36, w * 0.36, 0.03, 24), platterMat);
		platter.rotation.x = Math.PI / 2;
		platter.position.set(0, -h * 0.1, d * 0.1);
		g.add(platter);
		
		const armMat = new MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.8 });
		mats.push(armMat);
		const arm = new Mesh(new BoxGeometry(w * 0.06, h * 0.4, 0.03), armMat);
		arm.position.set(-w * 0.28, h * 0.22, d * 0.15);
		arm.rotation.z = -Math.PI / 6;
		g.add(arm);
		
		spin = (t) => {
			platter.rotation.y = t * 6.0;
			arm.rotation.z = -Math.PI / 6 + Math.sin(t * 15) * 0.04;
		};
		topY = h / 2 + 0.06;
	} else if (kind === 'nvme') {
		body.emissiveIntensity *= 1.2;
		const nw = 1.0;
		g.add(new Mesh(new BoxGeometry(nw, 0.26, 0.05), body));
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

		// Alloy NVMe: add copper heatpipes and mini heatsink cooler
		if (md.alloy) {
			const pipeMat = new MeshStandardMaterial({ color: 0xb87333, roughness: 0.35, metalness: 0.9 });
			mats.push(pipeMat);
			const pipe1 = new Mesh(new CylinderGeometry(0.015, 0.015, nw * 0.6), pipeMat);
			pipe1.rotation.z = Math.PI / 2;
			pipe1.position.set(0, 0.07, 0.06);
			const pipe2 = new Mesh(new CylinderGeometry(0.015, 0.015, nw * 0.6), pipeMat);
			pipe2.rotation.z = Math.PI / 2;
			pipe2.position.set(0, -0.07, 0.06);
			
			const cooler = new Mesh(new BoxGeometry(nw * 0.35, 0.2, 0.08), DARK());
			cooler.position.set(0, 0, 0.08);
			g.add(pipe1, pipe2, cooler);
		}

		topY = 0.2;
	} else {
		if (kind === 'hdd') body.emissiveIntensity *= 0.65;
		g.add(new Mesh(new BoxGeometry(w, h, d), body));

		const label = new Mesh(
			new PlaneGeometry(w * 0.82, h * 0.66),
			new MeshStandardMaterial({ map: sticker(rng, kind, labelText), roughness: 0.85, metalness: 0, emissive: glow, emissiveIntensity: 0.12 })
		);
		label.position.z = d / 2 + 0.001;
		g.add(label);
		mats.push(label.material as MeshStandardMaterial);

		const screw = DARK();
		[-1, 1].forEach((sx) =>
			[-1, 1].forEach((sy) => {
				const s = new Mesh(new CylinderGeometry(0.02, 0.02, 0.02, 6), screw);
				s.rotation.x = Math.PI / 2;
				s.position.set(sx * w * 0.42, sy * h * 0.38, d / 2);
				g.add(s);
			})
		);

		if (md.damaged) {
			const tapeMat = new MeshStandardMaterial({ color: 0x8a9097, roughness: 0.9, metalness: 0.1 });
			mats.push(tapeMat);
			const tape = new Mesh(new BoxGeometry(w * 0.3, h * 1.04, d * 1.04), tapeMat);
			tape.position.set(-w * 0.1, 0, 0);
			g.add(tape);
		}

		// Alloy SSD: add copper heatpipes and mini cooler
		if (md.alloy) {
			const pipeMat = new MeshStandardMaterial({ color: 0xb87333, roughness: 0.35, metalness: 0.9 });
			mats.push(pipeMat);
			const pipe1 = new Mesh(new CylinderGeometry(0.02, 0.02, w * 0.6), pipeMat);
			pipe1.rotation.z = Math.PI / 2;
			pipe1.position.set(0, h * 0.22, d / 2 + 0.04);
			const pipe2 = new Mesh(new CylinderGeometry(0.02, 0.02, w * 0.6), pipeMat);
			pipe2.rotation.z = Math.PI / 2;
			pipe2.position.set(0, -h * 0.22, d / 2 + 0.04);
			
			const cooler = new Mesh(new BoxGeometry(w * 0.35, h * 0.35, 0.08), DARK());
			cooler.position.set(0, 0, d / 2 + 0.06);
			g.add(pipe1, pipe2, cooler);
		}

		topY = h / 2 + 0.06;
	}

	if (md.damaged) chip(g, rng, 0.4);
	askew(g, rng, md.damaged);
	return { object: g, materials: mats, anchor: anchor(g, topY), spin };
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
