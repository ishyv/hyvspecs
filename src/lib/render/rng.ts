// deterministic prng seeded from the card slug. same seed → same card, forever (the
// ownership hook from PHILOSOPHY.md). xfnv1a folds the string into a 32-bit seed, then
// mulberry32 produces the stream. tiny, fast, good enough for visual jitter — not crypto.

export type Rng = () => number; // returns [0, 1)

export function makeRng(seed: string): Rng {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	let a = h >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// convenience: a random float in [lo, hi).
export function range(rng: Rng, lo: number, hi: number): number {
	return lo + rng() * (hi - lo);
}
