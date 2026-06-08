import { randomBytes, createHash } from 'node:crypto';

// card ids are read aloud and typed by humans, so the alphabet drops glyphs that look
// alike: no 0/O, no 1/I/L. uppercase letters + the surviving digits.
const CARD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// the seed only feeds the procedural renderer, so it just needs to be well distributed.
const SEED_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateCardId(length = 4): string {
	return pick(CARD_ALPHABET, length);
}

export function generateSeed(length = 10): string {
	return pick(SEED_ALPHABET, length);
}

export function mintEditToken(): string {
	return randomBytes(24).toString('base64url');
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function pick(alphabet: string, length: number): string {
	// modulo bias is irrelevant here: the keyspace dwarfs <100 users and uniqueness is
	// guaranteed by a collision-retry at the insert site, not by this function.
	const bytes = randomBytes(length);
	let out = '';
	for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
	return out;
}
