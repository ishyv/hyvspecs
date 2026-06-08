# hyvspecs — deployment

the app runs locally against a sqlite file with zero setup (`.env` already points at
`file:local.db`). production needs a turso database and a vercel deployment. both are
account-bound, so the steps below are run once, by you.

## 1. production database (turso)

turso's cli is linux/macos/wsl. on windows, run it inside wsl.

```sh
# install (inside wsl on windows)
curl -sSfL https://get.tur.so/install.sh | bash

# log in (opens a browser — this is the account step that can't be automated)
turso auth login

# create the database
turso db create hyvspecs

# grab the two values the app needs
turso db show hyvspecs --url          # -> libsql://hyvspecs-<org>.turso.io
turso db tokens create hyvspecs       # -> a long auth token
```

the schema is created automatically on first request (`CREATE TABLE IF NOT EXISTS` in
`src/lib/server/db.ts`), so there is no migration step.

## 2. wire the values

- **local, pointed at prod** (optional): put the url + token in `.env`.
- **vercel**: project settings → environment variables, set for production:
  - `TURSO_DATABASE_URL` = the `libsql://…` url
  - `TURSO_AUTH_TOKEN` = the token

`adapter-auto` selects the vercel adapter automatically on vercel; no config change
needed.

## 3. point the cli at production

the cli defaults to `https://hyvspecs.vercel.app`. override per-run for testing:

```sh
# powershell
$env:HYVSPECS_ENDPOINT = "https://your-deployment.vercel.app"; hyvspecs showcase
```

once the real domain is live, update `DEFAULT_ENDPOINT` in
`hyvspecs-cli/src/config.rs` so no override is needed.

## notes

- building the cli on linux needs a c compiler + cmake (reqwest's tls backend,
  aws-lc-rs, compiles from source). standard on dev machines; `apt install build-essential cmake`
  / `dnf install gcc cmake` if missing.
- the github-verify path is live server-side but the cli can't reach it until
  `hyvspecs login` (device flow) is implemented.
