import { error } from '@sveltejs/kit';

import { loadEnvelope } from '$lib/server/db';
import { renderOgImage } from '$lib/server/ogImage';
import type { RequestHandler } from './$types';

// social preview for an anonymous card. `og.png` is a static segment, so it out-ranks the
// `[handle]/[card_id]` route for a two-segment `/id/og.png` request.
export const GET: RequestHandler = async ({ params }) => {
	const envelope = await loadEnvelope(null, params.card_id);
	if (!envelope) throw error(404, 'signal lost');
	return renderOgImage(envelope, `/${params.card_id}`);
};
