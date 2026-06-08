import { error } from '@sveltejs/kit';

import { loadEnvelope } from '$lib/server/db';
import type { PageServerLoad } from './$types';

// single-segment route = an anonymous card (handle null).
export const load: PageServerLoad = async ({ params }) => {
	const envelope = await loadEnvelope(null, params.card_id);
	if (!envelope) throw error(404, 'signal lost');
	return { envelope };
};
