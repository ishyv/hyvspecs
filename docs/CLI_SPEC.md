# hyvspecs — cli spec

a small rust binary that reads the headline specs of the machine it runs on, uploads
them, and prints a short link. it is plumbing: dead simple to use, boring to operate,
reliable. the card is where the work shows.

**target platforms (v1): windows and linux (ubuntu, fedora) only.** macos is not a v1
target. this is not a deep or security-sensitive systems project — we gather the
headline specs the simplest reliable way and leave hard-to-read values `null`. we need
the specs because without them there is no card; that is the whole bar.

## command surface

```
hyvspecs showcase             gather specs, upload, print the link       (primary)
hyvspecs showcase --label STR attach a free-text display name to the card
hyvspecs showcase --verify    github device-flow login, publish under your handle
hyvspecs showcase --json      gather specs, print the json payload, no upload
hyvspecs showcase --dry-run   gather + build payload, show what would upload, no network
hyvspecs login                github device-flow login, cache the session for --verify
hyvspecs claim CARD_ID        move an anonymous card you created into your handle
hyvspecs delete CARD_ID       delete a card you created (uses local edit token)
hyvspecs --version
hyvspecs --help
```

`showcase` is the whole product. anonymous by default: it just works with no login.
`--verify` (or a prior `login`) upgrades the card to your github handle with a
checkmark. `claim` / `delete` operate on cards you created, authorized by the edit
token saved locally at creation. see identity & ownership in
[ARCHITECTURE.md](ARCHITECTURE.md).

## specs gathered

show-off level only. headline numbers a person would point at, not part-level detail.
maps directly to the payload in [ARCHITECTURE.md](ARCHITECTURE.md).

| field | source | notes |
| --- | --- | --- |
| os family + version | `sysinfo` / `os_info` | no build number, no hostname |
| cpu model | `sysinfo` | brand string |
| cpu / gpu vendor | inferred | from model string; for iconography only, not color |
| cpu cores (physical / logical) | `sysinfo` | `physical_core_count()` + `cpus().len()` |
| cpu max clock | wmi / `/sys` cpufreq | single nominal/max mhz; `null` when unavailable |
| gpu model(s) | platform-specific (see below) | supports multiple |
| gpu vram | platform-specific | `null` when unavailable |
| ram total | `sysinfo` | |
| ram per-module size / speed / kind | platform-specific | `modules` empty if unavailable |
| drive size | `sysinfo` disks | per physical drive |
| drive kind (nvme/ssd/hdd) | platform-specific | `unknown` when undetectable |
| drive read speed | optional, platform-specific | `null` unless cheaply known |

### gathering strategy — tiered

one `Collector` per platform behind `#[cfg(target_os = "...")]`, both emitting the same
`Payload`. a shared `sysinfo`-based module does the common 80%; thin platform modules
fill the gaps.

**tier 0 — `sysinfo` (windows + linux, the easy ~80%):**

- cpu brand `cpus()[0].brand()`, logical `cpus().len()`, physical
  `System::physical_core_count()`.
- ram total `total_memory()` (bytes).
- os `System::name()` + `System::os_version()`.
- disk capacity + `DiskKind` (ssd / hdd / unknown).
- caveats: sysinfo lists mounted partitions, not physical drives (needs dedup), does
  not distinguish nvme, and exposes only *current* cpu frequency (not max). the tier-1
  drive + clock fills below supersede it where they run.

**tier 1 — platform fills:**

| field | windows | linux |
| --- | --- | --- |
| gpu name + vram | DXGI `DXGI_ADAPTER_DESC` (`windows` crate) — accurate for amd/intel/nvidia incl. >4gb | nvidia via `nvml`; amd `/sys/class/drm/card*/device/mem_info_vram_total`; names via lspci/`/sys`; intel vram often `null` |
| nvidia vram (either OS) | `nvml-wrapper` (optional, absent = skip) | `nvml-wrapper` (optional) |
| ram modules (size/speed/kind) | `wmi` `Win32_PhysicalMemory` | needs dmidecode/smbios = root → leave `modules` empty in v1 (total only) |
| physical drives + kind | `wmi` `MSFT_PhysicalDisk` (MediaType, BusType→nvme) | `/sys/block/*`: `queue/rotational` (1=hdd,0=ssd), name `nvme*`, `size`×512 |
| cpu max clock | `wmi` `Win32_Processor.MaxClockSpeed` | `/sys/.../cpu0/cpufreq/cpuinfo_max_freq` |
| drive read speed | `null` (no benchmarking in v1) | `null` |

**crates:** `sysinfo`, `serde` + `serde_json`, `reqwest` (blocking client is fine),
`clap`, `nvml-wrapper` (optional), and windows-only (`cfg`-gated) `wmi` + `windows`.
linux fills are plain std reads of `/sys` and `/proc`, plus an optional `lspci`
shell-out for gpu names — no extra crate required.

### honesty about gaps

the weak spots, stated plainly: **gpu vram on linux/intel**, **per-module ram on
linux** (root-gated), and **drive read speed everywhere**. we do not paper over them.
when a value can't be read it is `null` (or an empty `modules` array), never guessed.
the renderer treats `null` as "this dimension doesn't contribute", so even a sparse
linux payload produces a valid, good-looking card.

## privacy & identity

the cli must never *auto-collect* identity: no hostname, username, serial numbers,
mac addresses, or ip. this is a hard rule, enforced before serialization; the server
also rejects such fields.

identity is only ever *deliberately* attached by the user: `--label` sets a free-text
display name, and `--verify` attaches the github handle the user proves they own. both
are opt-in. `machine.label` (a machine nickname inside the payload) is distinct from
card ownership (the envelope). see identity & ownership in
[ARCHITECTURE.md](ARCHITECTURE.md).

## upload flow

1. gather specs into the payload struct.
2. serialize the body: `{ payload (v:1), label? }`.
3. `--json` → print payload and exit. `--dry-run` → pretty-print intended upload and exit.
4. if `--verify` (or a cached `login` session): run/resume github device flow, attach
   `Authorization: Bearer <github-token>`. otherwise publish anonymously.
5. `POST {endpoint}/api/showcase`.
6. on `200`, save the returned `edit_token` to local config keyed by `card_id`, then
   print the full link. on failure, print a terse condition ("upload failed: signal
   interrupted") and exit non-zero.

## output ux

minimal, metallic, consistent with the philosophy. lowercase, mono feel, terse.

```
  hyvspecs

  cpu    amd ryzen 9 7950x · 16c/32t
  gpu    nvidia rtx 4090 · 24 gb
  ram    64 gb
  disk   2 tb nvme · 4 tb ssd

  ▸ hyvspecs.app/hyvnt/4CAT
```

the link is the payload of the whole command. print it big, on its own line, easy to
select and copy. everything above it is confirmation, not the product. (anonymous runs
print `hyvspecs.app/4CAT` instead.)

## config

local config dir (`~/.config/hyvspecs/` on linux, `%APPDATA%\hyvspecs\` on windows):

- **edit tokens** — one per card created on this machine, keyed by `card_id`. needed
  by `claim` / `delete`. these are secrets; store with user-only file permissions.
- **github session** — cached after `login` so `--verify` doesn't re-prompt every run.

env:

- `HYVSPECS_ENDPOINT` — overrides the base url (default: production). used for local dev
  against `http://localhost:5173`.

no api key for the ingest endpoint in v1 (low volume, low stakes); revisit if abuse
appears.

## non-goals (v1)

- no real account system. github is used only to *verify a handle*; we store no github
  token and no password.
- no continuous monitoring or daemon mode. one shot, print link, exit.
- no benchmarking. read speed is reported only if cheaply available, never measured.
