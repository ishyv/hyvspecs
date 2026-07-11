import { error } from '@sveltejs/kit';

import { loadEnvelope } from '$lib/server/db';
import { renderOgImage } from '$lib/server/ogImage';
import type { RequestHandler } from './$types';

// social preview for a verified card under a github handle.
export const GET: RequestHandler = async ({ params }) => {
	const handle = params.handle.toLowerCase();
	const envelope = await loadEnvelope(handle, params.card_id);
	if (!envelope) throw error(404, 'signal lost');
	return renderOgImage(envelope, `/${handle}/${params.card_id}`);
};
