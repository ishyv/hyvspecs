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
	rng: Rng,
	themeName: string,
	keyLight: PointLight,
	rimLight: PointLight
): Stage {
	// fog hides where the grid ends, so the floor reads as endless rather than a flat tile.
	scene.fog = new Fog(0x08080a, 8, 24);

	// a motherboard the loadout sits on — the backdrop now *represents the rig*, traces glowing
	// in the tier colour, brighter with power. fog sinks its edges into the dark.
	const pcb = pcbTexture(rng, glow);
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

	// sparks: more power → a busier field. seeded so a card's motes are its own.
	const count = Math.round(40 + energy * 160);
	const pos: number[] = [];
	for (let i = 0; i < count; i++) {
		pos.push(range(rng, -9, 9), range(rng, -4, 5), range(rng, -6, 3));
	}
	const geo = new BufferGeometry();
	geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
	const particles = new Points(
		geo,
		new PointsMaterial({ color: glow, size: 0.03, transparent: true, opacity: 0.35 + energy * 0.35 })
	);
	scene.add(particles);

	let animate: ((t: number) => void) | undefined;

	if (themeName === 'rust') {
		// Rust: soot falling down + wobbly flickering lights
		animate = (t) => {
			const positions = particles.geometry.attributes.position.array as Float32Array;
			for (let i = 1; i < positions.length; i += 3) {
				positions[i] -= 0.005;
				if (positions[i] < -4) positions[i] = 5;
			}
			particles.geometry.attributes.position.needsUpdate = true;
			particles.rotation.y = t * 0.01;

			// flickering keyLight representing unstable, low-power delivery
			const baseKey = 45 + energy * 35;
			keyLight.intensity = baseKey * (0.95 + Math.sin(t * 18) * 0.04 + (Math.sin(t * 3.5) > 0.97 ? -0.35 : 0));
		};
	} else if (themeName === 'iron') {
		// Iron: vertical industrial scanning laser + mechanical dust drift
		const laserMat = new MeshStandardMaterial({
			color: glow,
			emissive: glow,
			emissiveIntensity: 2.2,
			transparent: true,
			opacity: 0.8
		});
		const laser = new Mesh(new PlaneGeometry(18, 0.04), laserMat);
		laser.position.set(0, -3.18, -4.8);
		scene.add(laser);

		animate = (t) => {
			particles.rotation.y = t * 0.012;
			particles.rotation.x = Math.sin(t * 0.25) * 0.02;

			// sweep laser scan line vertically
			laser.position.y = -0.5 + Math.sin(t * 1.4) * 2.4;
		};
	} else if (themeName === 'overcharge') {
		// Overcharge: vertically rising heat particles + pulsing grid lines
		animate = (t) => {
			const positions = particles.geometry.attributes.position.array as Float32Array;
			for (let i = 1; i < positions.length; i += 3) {
				positions[i] += 0.008;
				if (positions[i] > 5) positions[i] = -4;
			}
			particles.geometry.attributes.position.needsUpdate = true;
			particles.rotation.y = t * 0.02;

			if (grid.material) {
				(grid.material as { opacity: number }).opacity = 0.12 + Math.sin(t * 4.5) * 0.06;
			}
		};
	} else if (themeName === 'alloy') {
		// Alloy: orbiting spotlights casting dynamic specular highlights + swirling dust
		animate = (t) => {
			particles.rotation.y = t * 0.06;
			particles.rotation.z = t * 0.015;

			// orbiting lights
			keyLight.position.x = 3 + Math.cos(t * 1.2) * 2.5;
			keyLight.position.y = 4 + Math.sin(t * 1.2) * 2.5;
			
			rimLight.position.x = -4 + Math.cos(t * 0.9) * 2.0;
			rimLight.position.y = -2 + Math.sin(t * 0.9) * 2.0;
		};
	} else if (themeName === 'divine') {
		// Divine: floating background celestial ring + fast cosmic orbital dust + breathing lights
		const ringMat = new MeshStandardMaterial({
			color: glow,
			emissive: glow,
			emissiveIntensity: 2.5,
			wireframe: true
		});
		const aura = new Mesh(new TorusGeometry(4.2, 0.08, 8, 32), ringMat);
		aura.position.set(0, 0, -4.5);
		scene.add(aura);

		animate = (t) => {
			particles.rotation.y = t * 0.18;
			particles.rotation.x = t * 0.04;

			aura.rotation.z = t * 0.2;
			aura.rotation.x = Math.sin(t * 0.3) * 0.12;

			// harmonic breathing light intensities
			const baseKey = 45 + energy * 35;
			const baseRim = 25 + energy * 45;
			keyLight.intensity = baseKey * (1.0 + Math.sin(t * 2.5) * 0.06);
			rimLight.intensity = baseRim * (1.0 + Math.sin(t * 2.5 + Math.PI) * 0.08);
		};
	}

	return { particles, animate };
}
