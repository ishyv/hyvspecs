import type { Envelope } from './envelope';
import type { Payload } from './payload';

// the power score: one number (0..100) distilled from the specs that drives the entire
// scene — color heat, idle energy, circuit density, the "overdrive" shimmer on monster
// rigs. it is NOT a benchmark (we have no perf database and don't pretend to). it's a
// deliberately rough, honest heuristic: each subsystem is normalised against a sensible
// floor/ceiling, the two heroes (cpu/gpu) are weighted heaviest, and the result is a
// "vibe" of how legendary the machine is. every tuning constant lives in TUNING below so
// the feel can be adjusted in one place without touching the logic.

const TUNING = {
	// floor/ceiling anchors. a value at or below `lo` scores ~0, at or above `hi` scores ~1.
	cpu: { clockGhz: [2.0, 5.8], threads: [4, 64] as const, stWeight: 0.45 },
	gpu: { vramGb: [1, 24] as const },
	ram: { totalGb: [4, 128] as const, speedMhz: [2133, 6400] as const, capWeight: 0.7 },
	storage: { totalGb: [128, 8192] as const, capWeight: 0.6 },

	// how much each subsystem contributes to the overall score (must sum to 1).
	weights: { cpu: 0.34, gpu: 0.38, ram: 0.16, storage: 0.12 },

	// idle energy is curved so weak machines feel genuinely *boring* (near-still) while the
	// top end ramps hard into "overdrive". exponent > 1 pushes the low end down.
	energyCurve: 1.5,
	overdriveAt: 0.83 // e >= this → the scene gets arcing/shimmer
} as const;

// linear normalise into 0..1 against [lo, hi], clamped.
function norm(value: number, [lo, hi]: readonly [number, number]): number {
	if (hi === lo) return 0;
	return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

// log-normalise: same idea but on a log scale, so the difference between 4→8 cores counts
// for as much as 32→64. right for counts/capacities where returns diminish.
function normLog(value: number, [lo, hi]: readonly [number, number]): number {
	if (value <= 0) return 0;
	return norm(Math.log2(value), [Math.log2(lo), Math.log2(hi)]);
}

// --- gpu tiering ---------------------------------------------------------------------
// without a perf database the model string is our best signal, so a small ordered table
// of keyword→tier handles the cards people actually brag about; everything else falls
// back to a vram heuristic. first pattern to match wins.
const GPU_TIERS: ReadonlyArray<[RegExp, number]> = [
	[/rtx\s*(4090|5090)/, 1.0],
	[/rtx\s*(4080|5080|3090)/, 0.92],
	[/rtx\s*(4070|5070|3080)/, 0.8],
	[/rx\s*(7900|6950|6900)/, 0.85],
	[/rx\s*(7800|7700|6800)/, 0.74],
	[/rtx\s*(4060|3070|2080)/, 0.66],
	[/rx\s*(7600|6700|6600)/, 0.6],
	[/rtx\s*(3060|2070|2060|1660)/, 0.52],
	[/arc\s*a7/, 0.55],
	[/(gtx\s*1[06]50|rx\s*5[05]0|mx\d)/, 0.3],
	// integrated graphics — present but weak. caught last so a discrete card wins first.
	[/(iris|uhd|hd graphics|vega|radeon graphics|apple m)/, 0.18]
];

function gpuScore(gpu: Payload['gpus'][number]): number {
	const model = gpu.model.toLowerCase();
	for (const [pattern, tier] of GPU_TIERS) {
		if (pattern.test(model)) return tier;
	}
	// unknown card: lean on vram as a coarse proxy, sqrt-curved (a 16gb card isn't 16x a 1gb one).
	const vramGb = (gpu.vram_mb ?? 0) / 1024;
	return Math.sqrt(norm(vramGb, TUNING.gpu.vramGb));
}

function cpuScore(cpu: Payload['cpu']): number {
	const ghz = cpu.clock_max_mhz ? cpu.clock_max_mhz / 1000 : 3.5; // neutral if unknown
	const single = norm(ghz, TUNING.cpu.clockGhz as unknown as [number, number]);
	const multi = normLog(cpu.cores_logical, TUNING.cpu.threads);
	const { stWeight } = TUNING.cpu;
	return single * stWeight + multi * (1 - stWeight);
}

function ramScore(ram: Payload['ram']): number {
	const cap = normLog(ram.total_mb / 1024, TUNING.ram.totalGb);
	// fastest stick we know about; null speeds (common on linux) don't drag the score down.
	const fastest = ram.modules.reduce((mhz, m) => Math.max(mhz, m.speed_mhz ?? 0), 0);
	const speed = fastest > 0 ? norm(fastest, TUNING.ram.speedMhz) : cap; // mirror cap when unknown
	const { capWeight } = TUNING.ram;
	return cap * capWeight + speed * (1 - capWeight);
}

const DRIVE_KIND_BONUS: Record<Payload['drives'][number]['kind'], number> = {
	nvme: 1.0,
	ssd: 0.6,
	hdd: 0.2,
	unknown: 0.4
};

function storageScore(drives: Payload['drives']): number {
	const totalGb = drives.reduce((sum, d) => sum + d.size_mb, 0) / 1024;
	const cap = normLog(totalGb, TUNING.storage.totalGb);
	const kind = drives.reduce((best, d) => Math.max(best, DRIVE_KIND_BONUS[d.kind]), 0);
	const { capWeight } = TUNING.storage;
	return cap * capWeight + kind * (1 - capWeight);
}

// the five rarity bands — the game-loadout flavour. index also feeds discrete visual jumps.
const TIERS = [
	{ name: 'dormant', max: 0.25 },
	{ name: 'humming', max: 0.45 },
	{ name: 'charged', max: 0.65 },
	{ name: 'surging', max: 0.83 },
	{ name: 'overdrive', max: 1.01 }
] as const;

export type TierName = (typeof TIERS)[number]['name'];

export interface PowerProfile {
	overall: number; // 0..100, the shareable number
	e: number; // overall as 0..1, what the renderer actually drives off
	tier: { name: TierName; index: number };
	// per-subsystem 0..1 — drives each component's individual magnitude (core size, facet
	// count, node brightness), independent of the overall scene energy.
	parts: { cpu: number; gpu: number; ram: number; storage: number };
	// ready-to-use aesthetic mappings so the renderer consumes, never computes.
	visual: {
		heat: number; // 0 cool/teal → 1 hot/gold (color = performance, per the locked rule)
		energy: number; // 0 near-still → 1 overdriven (curved: weak rigs are genuinely calm)
		density: number; // circuit trace/node density
		pulseHz: number; // idle breathing/current speed
		overdrive: boolean; // unlock arcing + heat shimmer
	};
}

export function scoreEnvelope(envelope: Envelope): PowerProfile {
	const { specs } = envelope;
	const parts = {
		cpu: cpuScore(specs.cpu),
		// the strongest gpu is the hero; integrated-only rigs still score, just low.
		gpu: specs.gpus.reduce((best, g) => Math.max(best, gpuScore(g)), 0),
		ram: ramScore(specs.ram),
		storage: storageScore(specs.drives)
	};

	const { weights } = TUNING;
	const e =
		parts.cpu * weights.cpu +
		parts.gpu * weights.gpu +
		parts.ram * weights.ram +
		parts.storage * weights.storage;

	const tierIndex = TIERS.findIndex((t) => e < t.max);
	const energy = Math.pow(e, TUNING.energyCurve);

	return {
		overall: Math.round(e * 100),
		e,
		tier: { name: TIERS[tierIndex].name, index: tierIndex },
		parts,
		visual: {
			heat: e,
			energy,
			density: 0.25 + e * 0.75,
			pulseHz: 0.15 + energy * 1.05,
			overdrive: e >= TUNING.overdriveAt
		}
	};
}
