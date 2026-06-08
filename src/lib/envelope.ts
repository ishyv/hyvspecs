import type { Payload } from './payload';

// the identity envelope wrapped around the spec payload — what the card renderer
// receives (see hyv-specs/docs/ARCHITECTURE.md). `derived` is computed here so the
// renderer never has to sum arrays itself.

export interface Envelope {
	card_id: string;
	handle: string | null;
	verified: boolean;
	label: string | null;
	seed: string;
	created_at: number;
	specs: Payload;
	derived: {
		total_storage_mb: number;
		total_vram_mb: number;
	};
}

type EnvelopeInput = Omit<Envelope, 'derived'>;

export function buildEnvelope(input: EnvelopeInput): Envelope {
	return {
		...input,
		derived: {
			total_storage_mb: input.specs.drives.reduce((sum, d) => sum + d.size_mb, 0),
			total_vram_mb: input.specs.gpus.reduce((sum, g) => sum + (g.vram_mb ?? 0), 0)
		}
	};
}
