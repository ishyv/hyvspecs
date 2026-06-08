# hyvspecs — philosophy

## the idea

a spec sheet is normally a table. boring, forgettable, a wall of numbers you scroll
past. hyvspecs reimagines it as a single artifact: you run one command, and you get
a link. the link *is* the thing you share. opening it does not show a document about
your machine. it shows your machine — rendered as a sharp, metallic, viewport-filling
card you can feel the weight of.

two parts:

- a rust cli (`hyvspecs showcase`) that reads the headline specs of the machine it
  runs on, uploads them, and prints a short memorable link.
- a web app that turns that link into the card.

the cli is plumbing. the card is the point.

## feeling

rough. metallic. cutting-edge. sharp. something with mass.

the card should read like a forged plate, not a web page. hard edges, no soft
corners, no friendly rounding. surfaces feel machined. light catches facets. it is
the visual register of an instrument you'd find bolted into something expensive.

the baseline aesthetic borrows from hyvui:

- **no rounding.** corners are corners.
- **two accents only.** gold (`--accent`) and teal (`--signal`). nothing else.
- **mono labels.** all metadata, units, and ui strings in ibm plex mono.
- **dark.** the card sits on near-black. the hardware is the light source.
- **voice** for any text on or around the card: lowercase, terse, fragments are
  fine, no em-dashes, describe the condition not the cause.

we depart from hyvui where it matters: hyvui is built for articles, dashboards, and
tools — text-led layouts. our main content is not text. the core of the card is
bespoke procedural geometry. we reach into hyvui for the depth system and ambient
ornaments, and we build everything else ourselves.

## the single-viewport law

the card fits the viewport. exactly. always.

- on mobile: the usable space is the viewport. nothing more. it fits.
- on desktop: the usable space is the viewport. it fits.
- **no scrolling. ever.** not a pixel.

this is a hard constraint, not a preference. it is the reason the layout must be
procedural rather than templated. a machine with one drive and a machine with seven
drives must both resolve to a composition that fills the same fixed frame without
overflow. the renderer's first job is to *fit*; beauty comes after fit.

## representing variable hardware

this is the hard problem, stated plainly:

- a machine can have **n drives**, each a different size and type.
- a machine can have **multiple gpus**.
- a machine can have **mixed ram** — different stick sizes, speeds, types.

a fixed template breaks the moment the shape of the data changes. so the card is
*generated from the data*. its composition is procedural.

the conceptual model:

- every component is a **node**: one of `cpu` / `gpu` / `ram` / `drive`.
- each node has a **type** and a **magnitude** (cores, vram, capacity, speed).
- a node's **shape, size, and color** are derived from `type + magnitude + seed`.
- the **seed** comes from the link slug. same slug, same machine, same card, every
  time. deterministic, but unique per card.

the card is therefore a function: `render(specs, seed) -> single-viewport scene`.
two people with identical hardware still get distinct cards, because their slugs
differ. the artwork and the link are bound together.

## procedural language (first pass)

direction, not final pixels. this gives the web build a target to aim at.

- **cpu** — the core. a single dominant segmented form, one facet per core (or core
  cluster, when counts are high). clock speed drives intensity / sharpness.
- **gpu** — a large faceted mass. vram drives its scale. multiple gpus become
  multiple masses, sharing the frame, the larger one leading.
- **ram** — stacked sharp slabs. one slab per module; height from capacity, edge
  detail from speed. mixed sticks read as an uneven, honest stack — not normalized.
- **drive** — bars / blocks with mass proportional to capacity. type (`nvme` /
  `ssd` / `hdd`) shifts texture and color. speed, when known, adds edge highlight.

color: a seeded palette anchored on hyvui's gold and teal. the seed perturbs hue
and the gold↔teal balance within bounds, so every card is recognizably part of the
same family while being its own object. metal tones (steel, graphite) carry the
surfaces; gold and teal carry the signal and emphasis.

**color reflects performance/magnitude, not brand.** a more powerful node burns
hotter/brighter regardless of who made it. vendor (amd / intel / nvidia / ...) is
carried in the data for iconography and labeling only, never to pick the palette. a
budget card and a flagship from the same vendor must look clearly different; two
flagships from rival vendors at similar power must feel like peers.

depth: the card lives in 3d. start from hyvui's depth system — `DepthStage` for the
perspective context, `FloatCard` for pointer-driven tilt so the plate feels physical,
`HorizonGrid` to ground it. the nodes sit on depth layers so the composition has
real foreground and recession, not a flat illustration.

## anti-goals

- not a dashboard. no live metrics, no graphs, no gauges-as-decoration.
- not a benchmark or leaderboard. there is a power score, but it only drives the
  card's materials and energy (see [VISUAL_SYSTEM.md](VISUAL_SYSTEM.md)). no public
  ranking, no machine-vs-machine comparison ui. it scores power, never people.
- no deep detail. no serial numbers, model revisions, firmware, or part-level minutiae.
- no privacy-sensitive identifiers. no hostname, no username, no mac/serial, no ip.
  the card shows the *shape of the power*, not the identity of the owner.
- not a portfolio or an article. the content is the machine, not prose.

## the contract

the cli and the web app agree on exactly one thing: the json payload schema. it is
defined in [ARCHITECTURE.md](ARCHITECTURE.md) and consumed identically by the ingest
route and the card renderer. everything else on either side can change freely as long
as that contract holds.
