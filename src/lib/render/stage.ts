import {
	BufferGeometry,
	Float32BufferAttribute,
	Fog,
	GridHelper,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	PointLight,
	Points,
	PointsMaterial,
	TorusGeometry,
	type Color,
	type Scene
} from 'three';
import { range, type Rng } from './rng';
import { pcbTexture } from './texture';

// the environment the rig lives in: a receding ground grid, fog that dissolves its edges
// into the near-black, and a faint drift of sparks whose count rises with power. turns the
// floating cores into a scene. cheap — no postprocessing — but it's most of the "not a
// webpage" feeling.

export interface Stage {
	particles: Points; // returned so the idle loop can drift it
	animate?: (t: number) => void;
}

export function buildStage(
	scene: Scene,
	glow: Color,
	energy: number,
	density: number,
	rng: Rng,
	themeName: string,
	keyLight: PointLight,
	rimLight: PointLight
): Stage {
	// fog hides where the grid ends, so the floor reads as endless rather than a flat tile.
	scene.fog = new Fog(0x08080a, 8, 24);

	// a motherboard the loadout sits on — the backdrop now *represents the rig*, traces glowing
	// in the tier colour, brighter with power, and denser with the score's `density`. fog sinks
	// its edges into the dark.
	const pcb = pcbTexture(rng, glow, density);
	pcb.repeat.set(3, 2);
	const board = new Mesh(
		new PlaneGeometry(40, 24),
		new MeshStandardMaterial({
			map: pcb,
			emissive: glow,
			emissiveMap: pcb,
			emissiveIntensity: 0.25 + energy * 0.5,
			roughness: 0.9,
			metalness: 0.2
		})
	);
	board.position.set(0, 0, -5);
	scene.add(board);

	const grid = new GridHelper(40, 40, glow.getHex(), 0x1a1c22);
	grid.position.y = -3.2;
	(grid.material as { opacity: number; transparent: boolean }).opacity = 0.2;
	(grid.material as { transparent: boolean }).transparent = true;
	scene.add(grid);

	// Sparks: particles count scales with energy
	const count = Math.round(15 + energy * 185);
	const pos: number[] = [];
	for (let i = 0; i < count; i++) {
		pos.push(range(rng, -9, 9), range(rng, -4, 5), range(rng, -6, 3));
	}
	const geo = new BufferGeometry();
	geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
	const particles = new Points(
		geo,
		new PointsMaterial({ color: glow, size: 0.03, transparent: true, opacity: 0.2 + energy * 0.6 })
	);
	scene.add(particles);

	const bgStyle = Math.floor(range(rng, 0, 3));
	let animate: ((t: number) => void) | undefined;

	if (bgStyle === 0) {
		// Style 0: Matrix Starfield (sparks drift & rotation speed scale with energy)
		animate = (t) => {
			const rotSpeed = energy * 0.12;
			particles.rotation.y = t * rotSpeed;
			particles.rotation.x = t * (rotSpeed * 0.3);

			const positions = particles.geometry.attributes.position.array as Float32Array;
			const fallSpeed = energy * 0.015;
			if (fallSpeed > 0.001) {
				for (let i = 1; i < positions.length; i += 3) {
					positions[i] -= fallSpeed;
					if (positions[i] < -4) positions[i] = 5;
				}
				particles.geometry.attributes.position.needsUpdate = true;
			}

			// flickering keyLight intensity representing unstable power delivery (stronger on low spec/rust)
			const baseKey = 45 + energy * 35;
			keyLight.intensity = baseKey * (1.0 + Math.sin(t * (4 + energy * 10)) * (0.02 + (1 - energy) * 0.06));
		};
	} else if (bgStyle === 1) {
		// Style 1: Laser Horizon (sweeping horizontal laser lines count & speed scale with energy)
		const lineCount = Math.max(1, Math.round(energy * 4));
		const lasers: Mesh[] = [];
		const laserMat = new MeshStandardMaterial({
			color: glow,
			emissive: glow,
			emissiveIntensity: 1.5 + energy * 2.0,
			transparent: true,
			opacity: 0.3 + energy * 0.5
		});
		
		for (let i = 0; i < lineCount; i++) {
			const laser = new Mesh(new PlaneGeometry(18, 0.03), laserMat);
			laser.position.set(0, -3.18, -4.8);
			scene.add(laser);
			lasers.push(laser);
		}

		animate = (t) => {
			// slow background drift
			particles.rotation.y = t * (0.01 + energy * 0.03);

			// sweep laser scan lines
			const sweepSpeed = 0.5 + energy * 2.0;
			lasers.forEach((laser, idx) => {
				const offset = idx * (Math.PI / 2);
				laser.position.y = -0.5 + Math.sin(t * sweepSpeed + offset) * (1.5 + energy * 1.5);
				laser.position.x = Math.cos(t * (sweepSpeed * 0.5) + offset) * (0.5 * energy);
			});

			const baseKey = 45 + energy * 35;
			keyLight.intensity = baseKey * (1.0 + Math.sin(t * 2.5) * (energy * 0.04));
		};
	} else {
		// Style 2: Concentric Halos (rotating wireframe energy rings scale with energy)
		const ringCount = Math.max(1, Math.round(energy * 3));
		const rings: Mesh[] = [];
		const ringMat = new MeshStandardMaterial({
			color: glow,
			emissive: glow,
			emissiveIntensity: 1.5 + energy * 2.0,
			wireframe: true,
			transparent: true,
			opacity: 0.15 + energy * 0.65
		});

		for (let i = 0; i < ringCount; i++) {
			const radius = 2.5 + i * 1.3;
			const ringMesh = new Mesh(new TorusGeometry(radius, 0.03 + energy * 0.03, 8, 32), ringMat);
			ringMesh.position.set(0, 0, -4.5);
			scene.add(ringMesh);
			rings.push(ringMesh);
		}

		animate = (t) => {
			// slow background drift
			particles.rotation.y = t * (0.01 + energy * 0.04);

			// rotate nested rings
			const rotBase = 0.05 + energy * 0.4;
			rings.forEach((ring, idx) => {
				const dir = idx % 2 === 0 ? 1 : -1;
				ring.rotation.z = t * rotBase * dir;
				ring.rotation.x = Math.sin(t * 0.3 + idx) * (0.02 + energy * 0.1);
				ring.rotation.y = Math.cos(t * 0.2 + idx) * (0.02 + energy * 0.1);

				const breathe = 1.0 + Math.sin(t * (1.5 + energy * 2.5) + idx) * (0.01 + energy * 0.06);
				ring.scale.setScalar(breathe);
			});

			// harmonic breathing light intensities
			const baseKey = 45 + energy * 35;
			const baseRim = 25 + energy * 45;
			keyLight.intensity = baseKey * (1.0 + Math.sin(t * 2.0) * (energy * 0.08));
			rimLight.intensity = baseRim * (1.0 + Math.sin(t * 2.0 + Math.PI) * (energy * 0.1));
		};
	}

	return { particles, animate };
}
