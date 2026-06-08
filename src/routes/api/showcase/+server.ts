import { json, error } from '@sveltejs/kit';
import * as v from 'valibot';

import { insertShowcase } from '$lib/server/db';
import { resolveHandle } from '$lib/server/github';
import { hashToken, mintEditToken } from '$lib/server/ids';
import { PayloadSchema } from '$lib/payload';
import type { RequestHandler } from './$types';

const BodySchema = v.object({
	payload: PayloadSchema,
	label: v.optional(v.nullable(v.string()))
});

export const POST: RequestHandler = async ({ request, url }) => {
	const raw = await request.json().catch(() => null);
	const parsed = v.safeParse(BodySchema, raw);
	if (!parsed.success) throw error(400, 'invalid payload');
	const { payload, label } = parsed.output;

	// an authorization header is the only way to publish under a verified handle. no
	// header means an anonymous card. a bad token is an explicit failure, not a silent
	// downgrade, so the user knows verification did not take.
	let handle = '';
	let verified = false;
	let ownerGhId: number | null = null;
	const auth = request.headers.get('authorization');
	if (auth?.startsWith('Bearer ')) {
		const user = await resolveHandle(auth.slice('Bearer '.length));
		if (!user) throw error(401, 'github token rejected');
		handle = user.login;
		verified = true;
		ownerGhId = user.id;
	}

	const editToken = mintEditToken();
	const { cardId } = await insertShowcase({
		payload,
		label: cleanLabel(label),
		handle,
		verified,
		ownerGhId,
		editTokenHash: hashToken(editToken)
	});

	const path = handle ? `/${handle}/${cardId}` : `/${cardId}`;
	return json({
		url: `${url.origin}${path}`,
		handle: handle || null,
		card_id: cardId,
		edit_token: editToken,
		verified
	});
};

function cleanLabel(label: string | null | undefined): string | null {
	const trimmed = label?.trim();
	return trimmed ? trimmed.slice(0, 60) : null;
}
