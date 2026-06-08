# hyv-specs

a silly cli tool to share your system specs as gorgeous, interactive 3D cards.

run a command, get a link. share it. that's it.

**[specs.hyvnt.dev](https://specs.hyvnt.dev)**

---

```
$ hyvspecs showcase
```

```
  cpu   AMD Ryzen 9 7950X   16c/32t   5.7 GHz
  gpu   AMD Radeon RX 7800 XT   16 GB
  ram   32 GB   DDR5   6000 MT/s
  os    Windows 11

  ▸ publish these specs to specs.hyvnt.dev? [y/N]: y

  ✓ https://specs.hyvnt.dev/4CAT
```

your specs live at a short url. the card looks nice. you can name it if you want.

```
hyvspecs showcase --label "my gaming rig"
```

---

## install

download the latest binary for your platform from [**GitHub Releases**](https://github.com/ishyv/hyvspecs/releases), put it somewhere on your `PATH`, and run it.

| platform | file |
|---|---|
| Windows x64 | `hyvspecs-x86_64-pc-windows-msvc.exe` |
| macOS x64 | `hyvspecs-x86_64-apple-darwin` |
| macOS Apple Silicon | `hyvspecs-aarch64-apple-darwin` |
| Linux x64 | `hyvspecs-x86_64-unknown-linux-gnu` |

on macOS / Linux you may need to `chmod +x` the binary after downloading.

---

## how it works

1. run `hyvspecs showcase`
2. it reads your cpu, gpu, ram, drives, and os
3. shows you what it collected and asks to confirm
4. uploads it (nothing sensitive — no hostnames, no usernames, just the hardware)
5. gives you a link to your 3D card

the card at that link is yours to keep and share. delete it anytime:

```
hyvspecs delete 4CAT
```

---

## options

```
hyvspecs showcase [OPTIONS]

  -l, --label <LABEL>   attach a name to the card
  -i, --id <ID>         choose a custom url slug (1–30 chars)
  -d, --dry-run         preview specs without uploading
  -j, --json            dump raw spec json to stdout
  -y, --yes             skip the confirmation prompt
  -v, --verify          publish under your github handle (requires login)
```

### custom card ids

you can claim a short url slug with `-i`:

```
hyvspecs showcase -i rig
# → https://specs.hyvnt.dev/rig
```

if the id is available, it's yours. if you already own it, your card gets updated.

---

## privacy

the cli collects **only hardware identifiers**: cpu model, gpu model, ram capacity, drive type/size, and os name. no ip addresses, hostnames, usernames, serial numbers, or any other personally identifying information is ever transmitted. you can verify this with `--dry-run` or `--json` before uploading.

every card comes with a locally stored edit token so only you can update or delete it.

---

## stack

| layer | tech |
|---|---|
| cli | rust, [sysinfo](https://github.com/GuillaumeGomez/sysinfo), [clap](https://github.com/clap-rs/clap) |
| web | sveltekit, three.js |
| db | [turso](https://turso.tech) (libsql) |
| hosting | vercel + cloudflare dns |

---

## license

[MIT](hyvspecs-cli/LICENSE)
