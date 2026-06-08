# hyvspecs — architecture

the system has two clients of one contract: a rust cli that produces a spec payload,
and a sveltekit web app that stores it and renders it. the payload schema is the only
hard coupling between them.

a card has two parts: the **spec payload** (the `v:1` data blob, below) and an
**identity envelope** around it (who owns it, is it verified — see [identity &
ownership](#identity--ownership)). the payload never carries identity; the envelope
never carries specs.

## the payload (single source of truth)

both the cli (`serde`) and the web (ingest validation + card renderer) use this shape.
versioned so it can evolve without silently breaking old cards.

```jsonc
{
  "v": 1,                       // schema version
  "machine": {
    "os": "windows 11",         // os family + version, no build/hostname
    "label": "string | null"    // optional user-supplied nickname, no PII auto-filled
  },
  "cpu": {
    "model": "string",          // e.g. "amd ryzen 9 7950x"
    "vendor": "amd",            // amd|intel|nvidia|apple|arm|other (inferred from model)
    "cores_physical": 16,
    "cores_logical": 32,
    "clock_max_mhz": 5700       // nominal/max clock, null if unknown
  },                            // (base-vs-boost is unreliable cross-platform; one figure)
  "gpus": [                      // 0..n, ordered as reported
    {
      "model": "string",
      "vendor": "nvidia",        // amd|intel|nvidia|apple|arm|other
      "vram_mb": 24576           // null if unknown
    }
  ],
  "ram": {
    "total_mb": 65536,
    "modules": [                 // may be empty when per-module detail is unavailable
      {
        "size_mb": 32768,
        "speed_mhz": 6000,       // null if unknown
        "kind": "ddr5"           // null if unknown
      }
    ]
  },
  "drives": [                    // 0..n
    {
      "size_mb": 2000000,
      "kind": "nvme",            // "nvme" | "ssd" | "hdd" | "unknown"
      "read_mbps": 7000          // null if unknown / not measured
    }
  ]
}
```

rules:

- every "if unknown" field is `null`, never omitted, never faked. the renderer treats
  `null` as "this dimension does not contribute", not zero.
- arrays preserve hardware order; the renderer decides visual emphasis.
- `vendor` is inferred cli-side from the model string and is for iconography/labeling
  only. card color is driven by performance/magnitude, not brand.
- no field carries *auto-collected* identity (hostname, user, serial, mac, ip).
  enforced cli-side and rejected server-side if present. note: `machine.label` is a
  user-chosen nickname for the machine, distinct from card ownership (the envelope).

## identity & ownership

the privacy rule is "never auto-collect identity", not "stay anonymous". a card may
carry a name the user *deliberately* attaches. there are two trust tiers and an
upgrade path between them.

- **anonymous tier** — no login. url is flat: `hyvspecs.app/4CAT`. optional free-text
  `label`, rendered but flagged `verified: false`. the creator receives an **edit
  token** (stored locally by the cli) and is the only one who can rename, delete, or
  later claim the card.
- **verified tier** — one-time github device-flow login in the cli. the handle *is*
  the github login, so it is globally unique and provably the user's — no handle
  reservation system needed. url is namespaced: `hyvspecs.app/hyvnt/4CAT`, rendered
  with a checkmark (`verified: true`). the server resolves the handle by asking github
  "who owns this token?" at publish time and **never stores the github token**.
- **claim / upgrade** — an anonymous card can be moved into a verified namespace later
  using its edit token + a github login.

authorship vs identity: the **edit token** proves *authorship* (you made it, you
control it) for both tiers. github verification adds *identity* (the name is really
yours) on top.

the **seed** that drives the procedural artwork is its own stored random value,
decoupled from the human-facing url so that vanity handles don't change the artwork.

### the envelope (what the renderer receives)

```jsonc
{
  "card_id": "4CAT",
  "handle": "hyvnt",            // null for anonymous cards
  "verified": true,             // false for anonymous / self-claimed
  "label": null,                // user-chosen display name (esp. for anonymous)
  "seed": "k7Qm9xR2",           // drives procedural visuals, stable per card
  "created_at": 1733600000,
  "specs": { "v": 1 /* ...the payload above... */ },
  "derived": {                  // computed server-side at ingest, not collected
    "total_storage_mb": 14000000,
    "total_vram_mb": 24576
  }
}
```

## database — turso / libsql

one table. scale is small (<100 users), so this stays trivial.

```sql
create table showcases (
  card_id         text not null,    -- short slug, unique within a namespace
  handle          text not null,    -- github login; '' (empty) = anonymous
  verified        integer not null, -- 0 / 1
  seed            text not null,    -- random, drives visuals (decoupled from card_id)
  payload         text not null,    -- json spec blob, validated against schema v
  label           text,             -- optional user-chosen display name
  edit_token_hash text not null,    -- hash of the creator's edit token
  owner_gh_id     integer,          -- github user id when verified, else null
  created_at      integer not null, -- unix epoch seconds
  primary key (handle, card_id)     -- anonymous cards keyed under the '' handle
);
```

anonymous uses `''` rather than `NULL` for the handle because sqlite treats NULLs as
distinct in a primary key, which would let two anonymous cards share a `card_id`. the
envelope still exposes anonymous as `handle: null`.

the `edit_token` itself is returned to the cli once and never stored in plaintext;
only its hash lives here.

## web app routes (sveltekit)

- `POST /api/showcase` — ingest.
  1. parse + validate body (`{ payload, label? }`) against the schema. reject unknown
     `v`, malformed shape, or auto-collected identity fields.
  2. if an `Authorization: Bearer <github-token>` header is present, resolve the
     handle via github and mark `verified`. otherwise the card is anonymous.
  3. generate a `card_id` (see below), retry on collision within the namespace, pick a
     random `seed`, mint an `edit_token`.
  4. insert the row; store only the token's hash.
  5. respond `200 { "url", "handle", "card_id", "edit_token", "verified" }`.
- `GET /[card_id]` — anonymous card. load by `(handle=null, card_id)`.
- `GET /[handle]/[card_id]` — verified card. load by `(handle, card_id)`.
  - both render the single-viewport procedural card from the envelope, seeded by
    `seed`. `404` → card-styled "signal lost" state.
- `PATCH /api/showcase/:card_id` — rename / claim. requires the matching `edit_token`;
  claim additionally requires a github bearer token to set the handle.
- `DELETE /api/showcase/:card_id` — delete. requires the matching `edit_token`.
  - the `edit_token` is both the auth and the disambiguator: a `card_id` is only unique
    within a namespace, so matching `(card_id, edit_token_hash)` pins the exact row.

later, an optional json endpoint mirroring the envelope if we want raw data shareable.
not required for v1.

## card_id generator

short, memorable, unique. like `4CAT`.

- **length**: 4 characters for v1. the keyspace is large relative to <100 users, so
  collisions are rare and cheap to resolve.
- **alphabet**: curated and unambiguous. drop visually confusable glyphs — no
  `0`/`O`, no `1`/`I`/`l`. uppercase letters plus the safe digits.
- **bias toward readable tokens**: prefer ids that look word-like or pronounceable
  over random noise, so they're easy to say and remember. a simple consonant/vowel
  pattern or a curated wordlist of 4-char tokens both work; pick one in the impl pass.
- **uniqueness**: scoped per namespace — unique within a handle (and within the
  anonymous null namespace). generate, check, regenerate on collision.
- **not the seed**: the `card_id` identifies the card; a separate random `seed` drives
  the artwork. both are minted server-side at ingest so the cli stays credential-free.

## flow, end to end

```
machine ──hyvspecs showcase──▶ cli gathers specs (sysinfo + gpu helpers)
            [--verify?]            │ serialize payload (serde)
                                   ▼  (optional github bearer token)
                  POST /api/showcase ─▶ validate ─▶ resolve handle? ─▶ make card_id
                                   │                                  + seed + token
                                   │                                        │
                                   │                                   store (turso)
                                   ◀── { url, handle, card_id, edit_token, verified }
                                   ▼
        print  hyvspecs.app/hyvnt/4CAT   (or hyvspecs.app/4CAT if anonymous)
        save   edit_token locally
                                   │
   someone opens it ──▶ GET /[handle]/[card_id] ─▶ load envelope ─▶ render(specs, seed)
```
