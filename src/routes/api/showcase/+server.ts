import { json, error } from '@sveltejs/kit';
import * as v from 'valibot';

import { insertShowcase, getCardAuth, updateShowcase } from '$lib/server/db';
import { resolveHandle } from '$lib/server/github';
import { hashToken, mintEditToken } from '$lib/server/ids';
import { PayloadSchema } from '$lib/payload';
import type { RequestHandler } from './$types';

const BodySchema = v.object({
	payload: PayloadSchema,
	label: v.optional(v.nullable(v.string())),
	card_id: v.optional(v.nullable(v.string())),
	edit_token: v.optional(v.nullable(v.string()))
});

export const POST: RequestHandler = async ({ request, url }) => {
	const raw = await request.json().catch(() => null);
	const parsed = v.safeParse(BodySchema, raw);
	if (!parsed.success) throw error(400, 'invalid payload');
	const { payload, label, card_id, edit_token } = parsed.output;

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

	let finalCardId = '';
	let finalEditToken = '';

	if (card_id) {
		const sanitizedCardId = card_id.trim();
		// restrict custom card IDs to 1-30 characters of safe URL-safe symbols: alphanumeric, dash, underscore
		const idRegex = /^[a-zA-Z0-9_-]{1,30}$/;
		if (!idRegex.test(sanitizedCardId)) {
			throw error(400, 'invalid card ID format: must be 1-30 alphanumeric characters, dashes, or underscores');
		}

		const existing = await getCardAuth(handle, sanitizedCardId);
		if (existing) {
			// check if the request is authorized: either edit_token matches or GitHub owner matches
			const isAuthorized =
				(edit_token && hashToken(edit_token) === existing.editTokenHash) ||
				(verified && ownerGhId !== null && ownerGhId === existing.ownerGhId);

			if (!isAuthorized) {
				throw error(403, 'this card ID has already been claimed by another user');
			}

			// authorized update of the existing showcase
			await updateShowcase(handle, sanitizedCardId, payload, cleanLabel(label));
			finalCardId = sanitizedCardId;
			finalEditToken = edit_token || '';
		} else {
			// attempt to claim/insert as a new custom card ID
			const newEditToken = mintEditToken();
			const result = await insertShowcase({
				payload,
				label: cleanLabel(label),
				handle,
				verified,
				ownerGhId,
				editTokenHash: hashToken(newEditToken)
			}, sanitizedCardId);

			if (!result) {
				throw error(409, 'this card ID is already taken');
			}

			finalCardId = result.cardId;
			finalEditToken = newEditToken;
		}
	} else {
		// standard fallback: generate a random card ID
		const newEditToken = mintEditToken();
		const result = await insertShowcase({
			payload,
			label: cleanLabel(label),
			handle,
			verified,
			ownerGhId,
			editTokenHash: hashToken(newEditToken)
		});

		if (!result) {
			throw error(500, 'could not allocate a unique card ID');
		}

		finalCardId = result.cardId;
		finalEditToken = newEditToken;
	}

	const path = handle ? `/${handle}/${finalCardId}` : `/${finalCardId}`;
	return json({
		url: `${url.origin}${path}`,
		handle: handle || null,
		card_id: finalCardId,
		edit_token: finalEditToken,
		verified
	});
};

function cleanLabel(label: string | null | undefined): string | null {
	const trimmed = label?.trim();
	return trimmed ? trimmed.slice(0, 60) : null;
}
