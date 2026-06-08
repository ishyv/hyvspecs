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
	SRGBColorSpace,
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

	const cpuStyle = Math.floor(range(rng, 0, 3));
	let spin: ((t: number) => void) | undefined;

	if (cpuStyle === 0) {
		// Classic / Tabbed IHS
		const ihs = new Mesh(new BoxGeometry(span * 0.74, span * 0.74, 0.16), ihsMat);
		ihs.position.z = 0.13;
		g.add(ihs);

		// Side tabs / ears representing mounting points
		const earMat = surface(theme, glow, magnitude);
		mats.push(earMat);
		const earL = new Mesh(new BoxGeometry(span * 0.12, span * 0.25, 0.06), earMat);
		earL.position.set(-span * 0.43, 0, 0.08);
		const earR = new Mesh(new BoxGeometry(span * 0.12, span * 0.25, 0.06), earMat);
		earR.position.set(span * 0.43, 0, 0.08);
		g.add(earL, earR);

		// Center groove lines (cross lines)
		const groove = DARK();
		const grooveV = new Mesh(new BoxGeometry(0.02, span * 0.5, 0.02), groove);
		grooveV.position.set(0, 0, 0.21);
		const grooveH = new Mesh(new BoxGeometry(span * 0.5, 0.02, 0.02), groove);
		grooveH.position.set(0, 0, 0.21);
		g.add(grooveV, grooveH);

		// chiplet grid recessed into the spreader
		const n = magnitude > 0.66 ? 3 : magnitude > 0.33 ? 2 : 1;
		const cell = (span * 0.62) / n;
		for (let r = 0; r < n; r++) {
			for (let c = 0; c < n; c++) {
				const die = new Mesh(new BoxGeometry(cell * 0.5, cell * 0.5, 0.02), groove);
				die.position.set((c - (n - 1) / 2) * cell, (r - (n - 1) / 2) * cell, 0.22);
				g.add(die);
			}
		}
	} else if (cpuStyle === 1) {
		// Exposed Direct-Die (no metal IHS cover)
		const dieMat = new MeshStandardMaterial({
			color: theme.name === 'divine' ? 0xd8bd82 : 0x1b2030,
			roughness: 0.12,
			metalness: 0.95,
			emissive: glow,
			emissiveIntensity: theme.emissive * 0.2
		});
		mats.push(dieMat);

		// Central I/O Die (larger)
		const iod = new Mesh(new BoxGeometry(span * 0.3, span * 0.2, 0.06), dieMat);
		iod.position.set(0, -span * 0.1, 0.09);
		g.add(iod);

		// CCD Core Dies (smaller, 1 or 2 depending on performance)
		const ccdCount = magnitude > 0.5 ? 2 : 1;
		const ccdSize = span * 0.18;
		for (let i = 0; i < ccdCount; i++) {
			const ccd = new Mesh(new BoxGeometry(ccdSize * 1.2, ccdSize, 0.06), dieMat);
			const cx = ccdCount === 1 ? 0 : (i === 0 ? -span * 0.18 : span * 0.18);
			ccd.position.set(cx, span * 0.18, 0.09);
			g.add(ccd);
		}

		// SMD Capacitors (tiny silver/grey blocks)
		const capMat = new MeshStandardMaterial({ color: 0x8a9097, roughness: 0.5, metalness: 0.8 });
		mats.push(capMat);
		const capPositions = [
			[-span * 0.25, -span * 0.22],
			[span * 0.25, -span * 0.22],
			[-span * 0.28, 0],
			[span * 0.28, 0],
			[-span * 0.08, span * 0.32],
			[span * 0.08, span * 0.32]
		];
		capPositions.forEach(([cx, cy]) => {
			const smd = new Mesh(new BoxGeometry(0.04, 0.04, 0.05), capMat);
			smd.position.set(cx, cy, 0.085);
			g.add(smd);
		});
	} else {
		// Liquid Loop Pump Block / AIO Waterblock
		const block = new Mesh(new BoxGeometry(span * 0.7, span * 0.7, 0.22), ihsMat);
		block.position.z = 0.16;
		g.add(block);

		// Circular center window/cap
		const centerMat = new MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.4, metalness: 0.7 });
		mats.push(centerMat);
		const cap = new Mesh(new CylinderGeometry(span * 0.22, span * 0.22, 0.04, 16), centerMat);
		cap.rotation.x = Math.PI / 2;
		cap.position.set(0, 0, 0.28);
		g.add(cap);

		// Glowing logo or line inside the cap
		const glowRingMat = accent(theme, glow, magnitude, 2.0);
		mats.push(glowRingMat);
		const glowRing = new Mesh(new TorusGeometry(span * 0.14, 0.02, 6, 16), glowRingMat);
		glowRing.position.set(0, 0, 0.31);
		g.add(glowRing);

		// Two coolant fittings (cylinders) pointing upwards/outwards
		const fittingMat = new MeshStandardMaterial({ color: 0x2e3035, roughness: 0.5, metalness: 0.8 });
		mats.push(fittingMat);
		for (let i = 0; i < 2; i++) {
			const fitX = (i === 0 ? -1 : 1) * span * 0.22;
			const fitY = span * 0.22;
			
			// Fitting base
			const fBase = new Mesh(new CylinderGeometry(0.05, 0.05, 0.08, 8), fittingMat);
			fBase.rotation.x = Math.PI / 2;
			fBase.position.set(fitX, fitY, 0.24);
			g.add(fBase);

			// Fitting collar
			const fCol = new Mesh(new CylinderGeometry(0.04, 0.04, 0.12, 8), fittingMat);
			fCol.rotation.x = Math.PI / 2;
			fCol.position.set(fitX, fitY, 0.3);
			g.add(fCol);
		}
	}

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
			crystal.position.z = (cpuStyle === 2 ? 0.46 : 0.35) + Math.sin(t * 3.5) * 0.08;
			border.rotation.z = Math.PI / 4 - t * 0.4;
		};
	} else if (m.alloy) {
		// Alloy (Enthusiast): CPU spreader topped with rotating energy torus core
		const ringMat = accent(theme, glow, magnitude, 2.2);
		mats.push(ringMat);
		const energyRing = new Mesh(new TorusGeometry(span * 0.28, 0.04, 8, 24), ringMat);
		energyRing.position.set(0, 0, cpuStyle === 2 ? 0.35 : cpuStyle === 1 ? 0.18 : 0.23);
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
			let fHeight = 0.25;
			let fZ = 0.18;
			if (cpuStyle === 1) {
				if (i > 1 && i < 4) continue; // skip center fins to expose dies
				fHeight = 0.14;
				fZ = 0.14;
			} else if (cpuStyle === 2) {
				fHeight = 0.12;
				fZ = 0.3;
			}
			const finMesh = new Mesh(new BoxGeometry(0.025, span * 0.74, fHeight), copperMat);
			finMesh.position.set(x, 0, fZ);
			g.add(finMesh);
		}
	} else {
		if (m.damaged) {
			// Potato: Hand-wrapped copper wire loop coils wrapped around the CPU
			const wireMat = new MeshStandardMaterial({ color: 0xb87333, roughness: 0.8, metalness: 0.6 });
			mats.push(wireMat);
			const wire1 = new Mesh(new TorusGeometry(span * 0.22, 0.032, 4, 12, Math.PI), wireMat);
			wire1.rotation.y = Math.PI / 2;
			wire1.position.set(-span * 0.2, 0, cpuStyle === 2 ? 0.22 : 0.1);
			const wire2 = new Mesh(new TorusGeometry(span * 0.18, 0.032, 4, 12, Math.PI), wireMat);
			wire2.rotation.y = -Math.PI / 2;
			wire2.position.set(span * 0.2, span * 0.08, cpuStyle === 2 ? 0.22 : 0.1);
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

	const gpuStyle = Math.floor(range(rng, 0, 3));

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
		if (gpuStyle === 2) {
			// Waterblock cover
			const shroud = new Mesh(new BoxGeometry(w * 0.96, 0.82, 0.24), body);
			shroud.position.z = 0.17;
			g.add(shroud);

			// Acrylic Window
			const windowMat = new MeshStandardMaterial({ color: 0x0a151b, roughness: 0.15, metalness: 0.8 });
			mats.push(windowMat);
			const windowMesh = new Mesh(new BoxGeometry(w * 0.5, 0.48, 0.04), windowMat);
			windowMesh.position.set(0, 0, 0.28);
			g.add(windowMesh);

			// Coolant tube paths
			const tubeMat = accent(theme, glow, magnitude, 2.2);
			mats.push(tubeMat);
			const path1 = new Mesh(new BoxGeometry(w * 0.44, 0.04, 0.02), tubeMat);
			path1.position.set(0, 0.12, 0.3);
			const path2 = new Mesh(new BoxGeometry(w * 0.44, 0.04, 0.02), tubeMat);
			path2.position.set(0, -0.12, 0.3);
			const conn = new Mesh(new BoxGeometry(0.04, 0.24, 0.02), tubeMat);
			conn.position.set(-w * 0.2, 0, 0.3);
			g.add(path1, path2, conn);

			// Coolant fittings
			const fitMat = new MeshStandardMaterial({ color: 0x6a7178, roughness: 0.4, metalness: 0.85 });
			mats.push(fitMat);
			for (let i = 0; i < 2; i++) {
				const fx = -w * 0.15 + i * 0.25;
				const fy = 0.44;
				const fz = 0.17;
				const baseFit = new Mesh(new CylinderGeometry(0.045, 0.045, 0.08, 8), fitMat);
				baseFit.rotation.x = Math.PI / 2;
				baseFit.position.set(fx, fy, fz);
				g.add(baseFit);
			}
		} else {
			// Shroud for Axial / Blower
			const shroud = new Mesh(new BoxGeometry(w * 0.96, 0.82, 0.42), body);
			shroud.position.z = 0.26;
			g.add(shroud);
		}
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
	if (m.iron || gpuStyle === 1) {
		// Iron / Blower: Left vents on shroud
		for (let i = 0; i < 4; i++) {
			const v = new Mesh(new BoxGeometry(0.06, 0.45, 0.02), vent);
			v.position.set(-w * 0.22 + i * 0.12, 0, 0.48);
			g.add(v);
		}
	} else if (!m.ornate && gpuStyle === 0) {
		// Standard axial card vents
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

	// Fan Setup
	const spins: Array<(t: number) => void> = [];
	
	if (gpuStyle === 2 && !m.ornate) {
		// Liquid-Cooled spinning indicator wheel
		const propGroup = new Group();
		propGroup.position.set(w * 0.12, 0, 0.32);
		
		const fitMat = new MeshStandardMaterial({ color: 0x6a7178, roughness: 0.4, metalness: 0.85 });
		mats.push(fitMat);
		const propHub = new Mesh(new CylinderGeometry(0.025, 0.025, 0.04, 8), fitMat);
		propHub.rotation.x = Math.PI / 2;
		propGroup.add(propHub);

		// Blades / spokes of the indicator wheel
		const bladeMat = accent(theme, glow, magnitude, 1.8);
		mats.push(bladeMat);
		const propBlade1 = new Mesh(new BoxGeometry(0.1, 0.02, 0.02), bladeMat);
		const propBlade2 = new Mesh(new BoxGeometry(0.02, 0.1, 0.02), bladeMat);
		propGroup.add(propBlade1, propBlade2);
		g.add(propGroup);

		spins.push((t) => {
			propGroup.rotation.z = t * 4.0;
		});
	} else {
		// Standard Fans (axial / blower)
		let count = magnitude > 0.6 ? 3 : 2;
		if (m.damaged) count = 1;
		if (m.iron || gpuStyle === 1) count = 1;
		if (m.ornate) count = 2; // Dual neon rings

		const r = (w * 0.96) / count / 2.25;
		for (let i = 0; i < count; i++) {
			const f = fan(r, body, acc, m.damaged, m.ornate, m.iron || gpuStyle === 1);
			let fx = (i - (count - 1) / 2) * ((w * 0.96) / count);
			let fy = 0;
			let fz = m.ornate ? 0.2 : 0.48;
			if (m.iron || gpuStyle === 1) {
				fx = w * 0.22;
				fz = 0.36;
			}
			f.group.position.set(fx, fy, fz);
			g.add(f.group);
			spins.push(f.spin);
		}
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

	const ramStyle = Math.floor(range(rng, 0, 3));

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

				if (ramStyle === 0) {
					// Style 0: Sleek RGB Lightbar
					for (let f = 0; f < 2; f++) {
						const ridge = new Mesh(new BoxGeometry(0.27, 0.02, 0.11), fin);
						ridge.position.set(0, h * 0.2 - f * 0.12, 0);
						stickGroup.add(ridge);
					}

					const crown = new Mesh(new BoxGeometry(0.27, 0.08, 0.12), bar);
					crown.position.set(0, h / 2 - 0.03, 0);
					stickGroup.add(crown);
				} else if (ramStyle === 1) {
					// Style 1: Tactical/Segmented Armor
					const armorPlate = new Mesh(new BoxGeometry(0.28, h * 0.35, 0.11), fin);
					armorPlate.position.set(0, -h * 0.1, 0);
					stickGroup.add(armorPlate);

					// 3 small glowing segments
					for (let s = 0; s < 3; s++) {
						const segment = new Mesh(new BoxGeometry(0.06, 0.06, 0.12), bar);
						segment.position.set(-0.09 + s * 0.09, h / 2 - 0.02, 0);
						stickGroup.add(segment);
					}
				} else {
					// Style 2: Ribbed Comb Heatsink
					const combMat = currentSpreaderMat;
					for (let c = 0; c < 5; c++) {
						const combFin = new Mesh(new BoxGeometry(0.02, 0.12, 0.11), combMat);
						combFin.position.set(-0.1 + c * 0.05, h / 2 + 0.04, 0);
						stickGroup.add(combFin);
					}

					const sideGlow = new Mesh(new BoxGeometry(0.22, 0.05, 0.115), bar);
					sideGlow.position.set(0, h * 0.1, 0);
					stickGroup.add(sideGlow);
				}

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

	const driveStyle = Math.floor(range(rng, 0, 3));

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
	} else if (kind === 'hdd') {
		if (driveStyle === 1 || md.iron) {
			// Style 1 (or Iron theme): Open-platter magnetic drive
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
		} else if (driveStyle === 2) {
			// Style 2: Rugged Corner-Bumper HDD
			g.add(new Mesh(new BoxGeometry(w, h, d), body));

			const label = new Mesh(
				new PlaneGeometry(w * 0.82, h * 0.66),
				new MeshStandardMaterial({ map: sticker(rng, kind, labelText), roughness: 0.85, metalness: 0, emissive: glow, emissiveIntensity: 0.12 })
			);
			label.position.z = d / 2 + 0.001;
			g.add(label);
			mats.push(label.material as MeshStandardMaterial);

			// Add rubber bumper edges
			const bumperMat = DARK();
			const bL = new Mesh(new BoxGeometry(w * 0.08, h * 1.04, d * 1.08), bumperMat);
			bL.position.set(-w * 0.47, 0, 0);
			const bR = new Mesh(new BoxGeometry(w * 0.08, h * 1.04, d * 1.08), bumperMat);
			bR.position.set(w * 0.47, 0, 0);
			const bT = new Mesh(new BoxGeometry(w * 1.02, h * 0.08, d * 1.08), bumperMat);
			bT.position.set(0, h * 0.47, 0);
			const bB = new Mesh(new BoxGeometry(w * 1.02, h * 0.08, d * 1.08), bumperMat);
			bB.position.set(0, -h * 0.47, 0);
			g.add(bL, bR, bT, bB);

			const screw = DARK();
			[-1, 1].forEach((sx) =>
				[-1, 1].forEach((sy) => {
					const s = new Mesh(new CylinderGeometry(0.02, 0.02, 0.02, 6), screw);
					s.rotation.x = Math.PI / 2;
					s.position.set(sx * w * 0.4, sy * h * 0.35, d / 2);
					g.add(s);
				})
			);
			topY = h / 2 + 0.06;
		} else {
			// Style 0: Standard Sealed HDD
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
			topY = h / 2 + 0.06;
		}
	} else if (kind === 'nvme') {
		body.emissiveIntensity *= 1.2;
		const nw = 1.0;
		g.add(new Mesh(new BoxGeometry(nw, 0.26, 0.05), body));

		const fingers = accent(theme, glow, magnitude, 1.3);
		mats.push(fingers);
		const edge = new Mesh(new BoxGeometry(0.1, 0.2, 0.07), fingers);
		edge.position.set(0.46, 0, 0);
		g.add(edge);

		if (driveStyle === 0) {
			// Style 0: Bare PCB / Exposed Chips
			const nand = DARK();
			const chips = Math.max(1, Math.min(4, Math.round(capacityGb / 512)));
			for (let i = 0; i < chips; i++) {
				const pkg = new Mesh(new BoxGeometry(0.18, 0.18, 0.07), nand);
				pkg.position.set(0.34 - i * 0.22, 0, 0.05);
				g.add(pkg);
			}
		} else if (driveStyle === 1) {
			// Style 1: Finned Heatsink
			const heatsink = new Mesh(new BoxGeometry(nw * 0.74, 0.22, 0.06), body);
			heatsink.position.set(-0.06, 0, 0.05);
			g.add(heatsink);

			const finMat = DARK();
			for (let f = 0; f < 3; f++) {
				const ridge = new Mesh(new BoxGeometry(nw * 0.7, 0.03, 0.08), finMat);
				ridge.position.set(-0.06, 0.07 - f * 0.07, 0.06);
				g.add(ridge);
			}

			const lineMat = accent(theme, glow, magnitude, 2.0);
			mats.push(lineMat);
			const stripe = new Mesh(new BoxGeometry(nw * 0.65, 0.015, 0.09), lineMat);
			stripe.position.set(-0.06, 0, 0.06);
			g.add(stripe);
		} else {
			// Style 2: Armored with Copper Heatpipe
			const armor = new Mesh(new BoxGeometry(nw * 0.76, 0.24, 0.05), DARK());
			armor.position.set(-0.06, 0, 0.05);
			g.add(armor);

			const pipeMat = new MeshStandardMaterial({ color: 0xb87333, roughness: 0.35, metalness: 0.9 });
			mats.push(pipeMat);
			const pipe = new Mesh(new CylinderGeometry(0.015, 0.015, nw * 0.6), pipeMat);
			pipe.rotation.z = Math.PI / 2;
			pipe.position.set(-0.06, 0.04, 0.08);
			g.add(pipe);

			const clip = new Mesh(new BoxGeometry(0.08, 0.24, 0.06), body);
			clip.position.set(-0.06, 0, 0.08);
			g.add(clip);
		}

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
		// SATA SSD / Unknown
		g.add(new Mesh(new BoxGeometry(w, h, d), body));

		if (driveStyle === 1) {
			// Style 1: Hex Grille / Slotted SSD
			// Glowing plate underneath
			const backGlow = new Mesh(new BoxGeometry(w * 0.6, h * 0.6, 0.02), accent(theme, glow, magnitude, 1.8));
			backGlow.position.z = d / 2 - 0.01;
			g.add(backGlow);
			mats.push(backGlow.material as MeshStandardMaterial);

			// Face plate with slot cutouts
			const facePlate = new Mesh(new BoxGeometry(w, h, 0.02), body);
			facePlate.position.z = d / 2 + 0.01;
			g.add(facePlate);

			const ventHole = DARK();
			for (let i = 0; i < 3; i++) {
				const slot = new Mesh(new BoxGeometry(0.06, h * 0.5, 0.025), ventHole);
				slot.position.set(-w * 0.15 + i * 0.15, 0, d / 2 + 0.011);
				g.add(slot);
			}
		} else if (driveStyle === 2) {
			// Style 2: Ribbed Armor SSD
			const ribMat = DARK();
			for (let i = 0; i < 4; i++) {
				const rib = new Mesh(new BoxGeometry(0.03, h * 0.82, 0.02), ribMat);
				rib.position.set(-w * 0.3 + i * 0.2, 0, d / 2 + 0.01);
				g.add(rib);
			}

			// Metallic logo badge
			const badgeMat = accent(theme, glow, magnitude, 2.0);
			mats.push(badgeMat);
			const badge = new Mesh(new BoxGeometry(0.12, 0.12, 0.03), badgeMat);
			badge.position.set(0, h * 0.2, d / 2 + 0.01);
			g.add(badge);
		} else {
			// Style 0: Standard SSD with Label
			const label = new Mesh(
				new PlaneGeometry(w * 0.82, h * 0.66),
				new MeshStandardMaterial({ map: sticker(rng, kind, labelText), roughness: 0.85, metalness: 0, emissive: glow, emissiveIntensity: 0.12 })
			);
			label.position.z = d / 2 + 0.001;
			g.add(label);
			mats.push(label.material as MeshStandardMaterial);
		}

		const screw = DARK();
		[-1, 1].forEach((sx) =>
			[-1, 1].forEach((sy) => {
				const s = new Mesh(new CylinderGeometry(0.02, 0.02, 0.02, 6), screw);
				s.rotation.x = Math.PI / 2;
				s.position.set(sx * w * 0.42, sy * h * 0.38, d / 2 + 0.005);
				g.add(s);
			})
		);

		if (md.damaged) {
			const tapeMat = new MeshStandardMaterial({ color: 0x8a9097, roughness: 0.9, metalness: 0.1 });
			mats.push(tapeMat);
			const tape = new Mesh(new BoxGeometry(w * 0.3, h * 1.04, d * 1.08), tapeMat);
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

// OS — a small badge plate with a glowing inset tile and a custom hand-drawn logo.
export function osBadge(theme: Theme, os: string, glow: Color, rng: Rng): Part {
	const g = new Group();
	const mat = texturedSurface(theme, glow, 0.3, rng);
	const inset = accent(theme, glow, 0.5, 1.8);
	
	const osStyle = Math.floor(range(rng, 0, 3));

	if (osStyle === 1) {
		// Round Shield Badge
		const backing = new Mesh(new CylinderGeometry(0.28, 0.28, 0.08, 24), mat);
		backing.rotation.x = Math.PI / 2;
		g.add(backing);

		const tile = new Mesh(new CylinderGeometry(0.16, 0.16, 0.1, 24), inset);
		tile.rotation.x = Math.PI / 2;
		tile.position.z = 0.04;
		g.add(tile);
	} else if (osStyle === 2) {
		// Hexagonal Plate Badge
		const backing = new Mesh(new CylinderGeometry(0.29, 0.29, 0.08, 6), mat);
		backing.rotation.x = Math.PI / 2;
		backing.rotation.y = Math.PI / 6;
		g.add(backing);

		const tile = new Mesh(new CylinderGeometry(0.17, 0.17, 0.1, 6), inset);
		tile.rotation.x = Math.PI / 2;
		tile.rotation.y = Math.PI / 6;
		tile.position.z = 0.04;
		g.add(tile);
	} else {
		// Square Badge (default)
		g.add(new Mesh(new BoxGeometry(0.5, 0.5, 0.08), mat));
		
		const tile = new Mesh(new BoxGeometry(0.28, 0.28, 0.1), inset);
		tile.position.z = 0.04;
		g.add(tile);
	}

	// Generate and apply the hand-drawn kid-crayon logo texture
	const logoTexture = createOsLogoTexture(os);
	const logoMat = new MeshStandardMaterial({
		map: logoTexture,
		transparent: true,
		roughness: 0.8,
		metalness: 0.1
	});
	
	// Overlay a flat plane for the logo on top of the front face of the tile
	const logoMesh = new Mesh(new PlaneGeometry(0.22, 0.22), logoMat);
	logoMesh.position.set(0, 0, 0.091);
	g.add(logoMesh);

	askew(g, rng, moods(theme).damaged);
	return { object: g, materials: [mat, inset, logoMat], anchor: anchor(g, 0.32) };
}

// Draw a grainy crayon line by rendering tiny overlapping dots
function drawCrayonLine(
	ctx: CanvasRenderingContext2D,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	color: string,
	width: number
) {
	ctx.save();
	ctx.fillStyle = color;

	const dx = x2 - x1;
	const dy = y2 - y1;
	const distance = Math.hypot(dx, dy);
	const steps = Math.max(12, Math.floor(distance / 1.5));

	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const cx = x1 + dx * t;
		const cy = y1 + dy * t;

		const dotCount = Math.max(3, Math.floor(width));
		for (let p = 0; p < dotCount; p++) {
			const angle = Math.random() * Math.PI * 2;
			const radius = Math.random() * (width / 2);
			const px = cx + Math.cos(angle) * radius;
			const py = cy + Math.sin(angle) * radius;
			ctx.beginPath();
			ctx.arc(px, py, 0.5 + Math.random() * 0.8, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.restore();
}

// Draw a filled shape with wobbly child-like borders and a crayon outline
function drawCrayonPolygon(
	ctx: CanvasRenderingContext2D,
	points: Array<[number, number]>,
	fillColor: string,
	strokeColor: string,
	strokeWidth: number
) {
	ctx.save();
	ctx.fillStyle = fillColor;
	ctx.beginPath();
	
	for (let i = 0; i < points.length; i++) {
		const [x, y] = points[i];
		const next = points[(i + 1) % points.length];
		const steps = 6;
		if (i === 0) {
			ctx.moveTo(x, y);
		}
		for (let s = 1; s <= steps; s++) {
			const t = s / steps;
			const jx = x + (next[0] - x) * t + (Math.random() - 0.5) * 1.6;
			const jy = y + (next[1] - y) * t + (Math.random() - 0.5) * 1.6;
			ctx.lineTo(jx, jy);
		}
	}
	ctx.fill();
	ctx.restore();

	for (let i = 0; i < points.length; i++) {
		const p1 = points[i];
		const p2 = points[(i + 1) % points.length];
		drawCrayonLine(ctx, p1[0], p1[1], p2[0], p2[1], strokeColor, strokeWidth);
	}
}

// Create a wobbly, kid-styled OS logo on an HTML5 canvas texture
function createOsLogoTexture(os: string): CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 256;
	canvas.height = 256;
	const ctx = canvas.getContext('2d');
	if (!ctx) return new CanvasTexture(canvas);

	const osLower = os.toLowerCase();

	if (osLower.includes('windows')) {
		// Windows: classic 4-pane flag style window drawn with crayon
		const strokeColor = '#1f65ad';
		const fillColor = 'rgba(125, 195, 244, 0.7)';
		
		drawCrayonPolygon(ctx, [
			[45, 65], [115, 55], [115, 115], [45, 115]
		], fillColor, strokeColor, 3);
		
		drawCrayonPolygon(ctx, [
			[125, 54], [205, 42], [205, 115], [125, 115]
		], fillColor, strokeColor, 3);
		
		drawCrayonPolygon(ctx, [
			[45, 125], [115, 125], [115, 185], [45, 175]
		], fillColor, strokeColor, 3);
		
		drawCrayonPolygon(ctx, [
			[125, 125], [205, 125], [205, 195], [125, 185]
		], fillColor, strokeColor, 3);

	} else if (osLower.includes('mac') || osLower.includes('darwin') || osLower.includes('os x') || osLower.includes('ios')) {
		// macOS: retro rainbow Apple logo filled with crayon stripes
		ctx.save();
		const applePoints: Array<[number, number]> = [
			[128, 70], [158, 65], [178, 85], [172, 108], [162, 122], [174, 137],
			[184, 148], [158, 178], [128, 171], [98, 178], [72, 148], [68, 122],
			[72, 96], [98, 65]
		];

		ctx.beginPath();
		ctx.moveTo(applePoints[0][0], applePoints[0][1]);
		for (let i = 1; i < applePoints.length; i++) {
			ctx.lineTo(applePoints[i][0], applePoints[i][1]);
		}
		ctx.closePath();
		ctx.clip();

		const stripes = [
			{ y1: 50, y2: 83, color: 'rgba(96, 176, 68, 0.75)' },
			{ y1: 83, y2: 102, color: 'rgba(243, 200, 68, 0.75)' },
			{ y1: 102, y2: 121, color: 'rgba(243, 156, 18, 0.75)' },
			{ y1: 121, y2: 140, color: 'rgba(231, 76, 60, 0.75)' },
			{ y1: 140, y2: 159, color: 'rgba(155, 89, 182, 0.75)' },
			{ y1: 159, y2: 195, color: 'rgba(52, 152, 219, 0.75)' }
		];

		for (const s of stripes) {
			ctx.fillStyle = s.color;
			for (let y = s.y1; y <= s.y2; y += 2) {
				ctx.fillRect(50, y, 160, 2);
			}
		}
		ctx.restore();

		drawCrayonPolygon(ctx, [
			[128, 62], [145, 38], [158, 48], [128, 68]
		], 'rgba(96, 176, 68, 0.75)', '#427c28', 2);

		const strokeColor = '#3a3a3a';
		for (let i = 0; i < applePoints.length; i++) {
			const p1 = applePoints[i];
			const p2 = applePoints[(i + 1) % applePoints.length];
			drawCrayonLine(ctx, p1[0], p1[1], p2[0], p2[1], strokeColor, 3);
		}

	} else if (osLower.includes('linux')) {
		// Linux: extremely cute wobbly Tux penguin
		const strokeColor = '#222222';
		
		drawCrayonPolygon(ctx, [
			[80, 185], [105, 185], [95, 208], [75, 203]
		], 'rgba(243, 156, 18, 0.8)', '#d35400', 2.5);
		drawCrayonPolygon(ctx, [
			[151, 185], [176, 185], [181, 203], [161, 208]
		], 'rgba(243, 156, 18, 0.8)', '#d35400', 2.5);

		drawCrayonPolygon(ctx, [
			[128, 50], [158, 70], [172, 105], [178, 165], [158, 190], [98, 190], [78, 165], [84, 105], [98, 70]
		], 'rgba(64, 64, 64, 0.85)', strokeColor, 3);

		drawCrayonPolygon(ctx, [
			[128, 105], [150, 125], [155, 160], [128, 183], [101, 160], [106, 125]
		], 'rgba(252, 248, 242, 0.9)', '#888888', 2);

		drawCrayonPolygon(ctx, [
			[115, 92], [141, 92], [128, 107]
		], 'rgba(243, 156, 18, 0.9)', '#d35400', 2);

		drawCrayonPolygon(ctx, [
			[110, 75], [120, 75], [120, 85], [110, 85]
		], '#ffffff', '#222222', 1.5);
		drawCrayonLine(ctx, 115, 80, 115, 80, '#222222', 3);

		drawCrayonPolygon(ctx, [
			[136, 75], [146, 75], [146, 85], [136, 85]
		], '#ffffff', '#222222', 1.5);
		drawCrayonLine(ctx, 141, 80, 141, 80, '#222222', 3);

	} else {
		// Fallback: cute wobbly computer monitor with a smiley face
		const strokeColor = '#444444';
		
		drawCrayonPolygon(ctx, [
			[110, 160], [146, 160], [156, 195], [100, 195]
		], 'rgba(120, 120, 120, 0.8)', strokeColor, 2.5);

		drawCrayonPolygon(ctx, [
			[55, 55], [201, 55], [201, 160], [55, 160]
		], 'rgba(200, 200, 200, 0.8)', strokeColor, 3);

		drawCrayonPolygon(ctx, [
			[68, 68], [188, 68], [188, 147], [68, 147]
		], 'rgba(160, 224, 224, 0.85)', '#317373', 2.5);

		drawCrayonLine(ctx, 100, 95, 100, 95, '#333333', 5);
		drawCrayonLine(ctx, 156, 95, 156, 95, '#333333', 5);
		drawCrayonLine(ctx, 105, 118, 116, 128, '#333333', 2.5);
		drawCrayonLine(ctx, 116, 128, 140, 128, '#333333', 2.5);
		drawCrayonLine(ctx, 140, 128, 151, 118, '#333333', 2.5);
	}

	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.needsUpdate = true;
	return texture;
}
