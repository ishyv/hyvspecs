import { createClient, LibsqlError } from '@libsql/client';
import { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } from '$env/static/private';

import { buildEnvelope, type Envelope } from '$lib/envelope';
import { generateCardId, generateSeed } from './ids';
import type { Payload } from '$lib/payload';

// one client per server instance. the http/file transport is stateless, so there is no
// pool to manage and nothing to close between requests.
const client = createClient({
	url: TURSO_DATABASE_URL,
	authToken: TURSO_AUTH_TOKEN || undefined
});

// anonymous cards are stored with an empty-string handle rather than NULL. sqlite treats
// NULLs as distinct in a primary key, so (NULL, card_id) would not be unique and two anon
// cards could share a card_id. '' sidesteps that and keeps the (handle, card_id) pk honest.
// the envelope still exposes anonymous as `handle: null`.
const ANON = '';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS showcases (
  card_id         TEXT NOT NULL,
  handle          TEXT NOT NULL,    -- '' = anonymous
  verified        INTEGER NOT NULL, -- 0 / 1
  seed            TEXT NOT NULL,
  payload         TEXT NOT NULL,    -- json, validated against schema v before insert
  label           TEXT,
  edit_token_hash TEXT NOT NULL,
  owner_gh_id     INTEGER,
  created_at      INTEGER NOT NULL, -- unix epoch seconds
  PRIMARY KEY (handle, card_id)
)`;

// run the migration once per instance; every db call awaits it first.
let schemaReady: Promise<unknown> | undefined;
function ensureSchema(): Promise<unknown> {
	return (schemaReady ??= client.execute(SCHEMA));
}

function isUniqueViolation(e: unknown): boolean {
	return e instanceof LibsqlError && e.code.startsWith('SQLITE_CONSTRAINT');
}

export interface NewShowcase {
	payload: Payload;
	label: string | null;
	handle: string; // '' for anonymous, else a github login
	verified: boolean;
	ownerGhId: number | null;
	editTokenHash: string;
}

export async function insertShowcase(s: NewShowcase): Promise<{ cardId: string; seed: string }> {
	await ensureSchema();
	const seed = generateSeed();
	const payloadJson = JSON.stringify(s.payload);
	const createdAt = Math.floor(Date.now() / 1000);

	// retry a fresh card_id on the rare collision within this namespace.
	for (let attempt = 0; attempt < 8; attempt++) {
		const cardId = generateCardId();
		try {
			await client.execute({
				sql: `INSERT INTO showcases
					(card_id, handle, verified, seed, payload, label, edit_token_hash, owner_gh_id, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					cardId,
					s.handle,
					s.verified ? 1 : 0,
					seed,
					payloadJson,
					s.label,
					s.editTokenHash,
					s.ownerGhId,
					createdAt
				]
			});
			return { cardId, seed };
		} catch (e) {
			if (isUniqueViolation(e)) continue;
			throw e;
		}
	}
	throw new Error('could not allocate a unique card id');
}

export async function loadEnvelope(handle: string | null, cardId: string): Promise<Envelope | null> {
	await ensureSchema();
	const { rows } = await client.execute({
		sql: `SELECT card_id, handle, verified, seed, payload, label, created_at
			FROM showcases WHERE handle = ? AND card_id = ?`,
		args: [handle ?? ANON, cardId]
	});
	const row = rows[0];
	if (!row) return null;

	return buildEnvelope({
		card_id: row.card_id as string,
		handle: (row.handle as string) || null,
		verified: Boolean(row.verified),
		label: (row.label as string | null) ?? null,
		seed: row.seed as string,
		created_at: Number(row.created_at),
		specs: JSON.parse(row.payload as string) as Payload
	});
}

// the edit token is both the authorization and the disambiguator: a card_id is only
// unique within its namespace, but the token is globally unique, so matching on both
// pins the exact row (and tells us its current handle).
export interface OwnedCard {
	cardId: string;
	handle: string;
}

export async function findByToken(cardId: string, tokenHash: string): Promise<OwnedCard | null> {
	await ensureSchema();
	const { rows } = await client.execute({
		sql: `SELECT card_id, handle FROM showcases WHERE card_id = ? AND edit_token_hash = ?`,
		args: [cardId, tokenHash]
	});
	const row = rows[0];
	return row ? { cardId: row.card_id as string, handle: row.handle as string } : null;
}

export async function updateLabel(handle: string, cardId: string, label: string | null): Promise<void> {
	await client.execute({
		sql: `UPDATE showcases SET label = ? WHERE handle = ? AND card_id = ?`,
		args: [label, handle, cardId]
	});
}

export async function deleteCard(handle: string, cardId: string): Promise<void> {
	await client.execute({
		sql: `DELETE FROM showcases WHERE handle = ? AND card_id = ?`,
		args: [handle, cardId]
	});
}

export async function claimCard(
	current: OwnedCard,
	newHandle: string,
	ownerGhId: number
): Promise<{ cardId: string }> {
	await ensureSchema();
	// keep the original id if it is free in the target namespace, else mint a new one.
	for (let attempt = 0; attempt < 8; attempt++) {
		const cardId = attempt === 0 ? current.cardId : generateCardId();
		try {
			await client.execute({
				sql: `UPDATE showcases
					SET handle = ?, verified = 1, owner_gh_id = ?, card_id = ?
					WHERE handle = ? AND card_id = ?`,
				args: [newHandle, ownerGhId, cardId, current.handle, current.cardId]
			});
			return { cardId };
		} catch (e) {
			if (isUniqueViolation(e)) continue;
			throw e;
		}
	}
	throw new Error('could not claim card');
}
