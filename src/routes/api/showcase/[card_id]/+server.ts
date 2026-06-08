import { json, error } from '@sveltejs/kit';

import { claimCard, deleteCard, findByToken, updateLabel, type OwnedCard } from '$lib/server/db';
import { resolveHandle } from '$lib/server/github';
import { hashToken } from '$lib/server/ids';
import type { RequestHandler } from './$types';

// the edit token authorizes every mutation and also identifies the exact row, so a
// caller can only ever touch a card they created.
async function authorize(cardId: string, body: unknown): Promise<OwnedCard> {
	const token = (body as { edit_token?: unknown } | null)?.edit_token;
	if (typeof token !== 'string') throw error(401, 'edit token required');
	const owned = await findByToken(cardId, hashToken(token));
	if (!owned) throw error(403, 'edit token rejected');
	return owned;
}

// PATCH carries the non-destructive mutations: rename, and claim (move an anonymous
// card into a verified github namespace).
export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const owned = await authorize(params.card_id, body);

	if (body?.claim) {
		const auth = request.headers.get('authorization');
		if (!auth?.startsWith('Bearer ')) throw error(401, 'github token required to claim');
		const user = await resolveHandle(auth.slice('Bearer '.length));
		if (!user) throw error(401, 'github token rejected');
		const { cardId } = await claimCard(owned, user.login, user.id);
		return json({ handle: user.login, card_id: cardId });
	}

	if (typeof body?.label === 'string') {
		const trimmed = body.label.trim();
		await updateLabel(owned.handle, owned.cardId, trimmed ? trimmed.slice(0, 60) : null);
	}
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	const body = await request.json().catch(() => null);
	const owned = await authorize(params.card_id, body);
	await deleteCard(owned.handle, owned.cardId);
	return json({ ok: true });
};
