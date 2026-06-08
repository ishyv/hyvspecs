import { error } from '@sveltejs/kit';

import { loadEnvelope } from '$lib/server/db';
import type { PageServerLoad } from './$types';

// two-segment route = a verified card under a github handle.
export const load: PageServerLoad = async ({ params }) => {
	const envelope = await loadEnvelope(params.handle.toLowerCase(), params.card_id);
	if (!envelope) throw error(404, 'signal lost');
	return { envelope };
};
