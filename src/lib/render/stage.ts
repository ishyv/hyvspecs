import {
	BufferGeometry,
	Float32BufferAttribute,
	Fog,
	GridHelper,
	Points,
	PointsMaterial,
	type Color,
	type Scene
} from 'three';
import { range, type Rng } from './rng';

// the environment the rig lives in: a receding ground grid, fog that dissolves its edges
// into the near-black, and a faint drift of sparks whose count rises with power. turns the
// floating cores into a scene. cheap — no postprocessing — but it's most of the "not a
// webpage" feeling.

export interface Stage {
	particles: Points; // returned so the idle loop can drift it
}

export function buildStage(scene: Scene, glow: Color, energy: number, rng: Rng): Stage {
	// fog hides where the grid ends, so the floor reads as endless rather than a flat tile.
	scene.fog = new Fog(0x08080a, 8, 22);

	const grid = new GridHelper(40, 40, glow.getHex(), 0x1a1c22);
	grid.position.y = -3.2;
	(grid.material as { opacity: number; transparent: boolean }).opacity = 0.25;
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

	return { particles };
}
