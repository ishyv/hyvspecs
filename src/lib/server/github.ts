// the server proves a handle by asking github who owns the supplied token, then throws
// the token away. we never store it. a github login is globally unique and provably the
// user's, which is why we can use it as a namespace without a reservation system.

export interface GithubIdentity {
	login: string;
	id: number;
}

export async function resolveHandle(bearer: string): Promise<GithubIdentity | null> {
	const res = await fetch('https://api.github.com/user', {
		headers: {
			Authorization: `Bearer ${bearer}`,
			Accept: 'application/vnd.github+json',
			'User-Agent': 'hyvspecs' // github rejects requests without one
		}
	});
	if (!res.ok) return null;

	const user = (await res.json()) as Partial<GithubIdentity>;
	if (typeof user.login !== 'string' || typeof user.id !== 'number') return null;

	// lowercased so the url namespace is case-stable.
	return { login: user.login.toLowerCase(), id: user.id };
}
