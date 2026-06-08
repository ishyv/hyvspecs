# hyvspecs

a silly cli tool to share your system specs in an easy and aesthetically pleasing way.

run a command, get a link. share it. that's it.

---

```
hyvspecs showcase
```

```
  cpu   AMD Ryzen 9 7950X   16c/32t   5.7 GHz
  gpu   AMD Radeon RX 7800 XT   16 GB
  ram   32 GB   DDR5   6000 MT/s
  os    Windows 11

  → hyvspecs.vercel.app/4CAT
```

your specs live at a short url. the card looks nice. you can name it if you want.

```
hyvspecs showcase --label "my gaming rig"
```

---

## install

> coming soon — release binaries for windows and linux

## how it works

1. run `hyvspecs showcase`
2. it reads your cpu, gpu, ram, and drives
3. uploads them (nothing sensitive — no hostnames, no usernames, just the specs)
4. gives you a link

the card at that link is yours to keep and share. delete it anytime:

```
hyvspecs delete 4CAT
```

---

built with rust + sveltekit. specs gathered with [sysinfo](https://github.com/GuillaumeGomez/sysinfo), stored in [turso](https://turso.tech).
