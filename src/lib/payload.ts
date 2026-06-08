import * as v from 'valibot';

// the web-side mirror of the rust `v:1` payload (see hyv-specs/docs/ARCHITECTURE.md).
// strictObject is deliberate: it rejects any key we don't name, which is also how we
// enforce the privacy rule on the server. an injected `hostname`/`user`/etc. makes the
// whole payload fail validation rather than needing a hand-written blocklist.

const Vendor = v.picklist(['amd', 'intel', 'nvidia', 'apple', 'arm', 'other']);
const DriveKind = v.picklist(['nvme', 'ssd', 'hdd', 'unknown']);

// non-negative integer. used for every count/size/clock so bad numbers are rejected
// once, in one place, instead of re-checked at each use site.
const Count = v.pipe(v.number(), v.integer(), v.minValue(0));

export const PayloadSchema = v.strictObject({
	v: v.literal(1),
	machine: v.strictObject({
		os: v.pipe(v.string(), v.maxLength(100)),
		label: v.nullable(v.pipe(v.string(), v.maxLength(100)))
	}),
	cpu: v.strictObject({
		model: v.pipe(v.string(), v.maxLength(150)),
		vendor: Vendor,
		cores_physical: v.nullable(Count),
		cores_logical: Count,
		clock_max_mhz: v.nullable(Count)
	}),
	gpus: v.pipe(
		v.array(
			v.strictObject({
				model: v.pipe(v.string(), v.maxLength(150)),
				vendor: Vendor,
				vram_mb: v.nullable(Count)
			})
		),
		v.maxLength(8)
	),
	ram: v.strictObject({
		total_mb: Count,
		modules: v.pipe(
			v.array(
				v.strictObject({
					size_mb: Count,
					speed_mhz: v.nullable(Count),
					kind: v.nullable(v.pipe(v.string(), v.maxLength(50)))
				})
			),
			v.maxLength(16)
		)
	}),
	drives: v.pipe(
		v.array(
			v.strictObject({
				size_mb: Count,
				kind: DriveKind,
				read_mbps: v.nullable(Count)
			})
		),
		v.maxLength(32)
	)
});

export type Payload = v.InferOutput<typeof PayloadSchema>;
