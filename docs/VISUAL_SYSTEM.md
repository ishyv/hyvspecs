# hyvspecs — visual system

how the card decides what it looks like. this sits under [PHILOSOPHY.md](PHILOSOPHY.md)
and above the renderer: philosophy says *why*, this says *what the rules are*, the
three.js code says *how*.

## one number drives everything

every visual decision flows from the **power score** (`src/lib/score.ts`). it is not a
benchmark and not a leaderboard — it's an honest, tunable heuristic that distils the
specs into:

- `e` — overall power, `0..1`.
- `parts.{cpu,gpu,ram,storage}` — each subsystem's own magnitude, `0..1`.
- `tier` — which bracket `e` falls in (the *world*, see below).
- `visual.{heat,energy,density,pulseHz,overdrive}` — ready-to-use aesthetic mappings.

the renderer **consumes** these. it never computes power itself. if the feel is wrong,
the fix is one constant in `score.ts`, never a change in the geometry.

## two axes, never one

the mistake would be to build ten fixed presets and snap each rig into one. that reads
dead. instead every card is positioned on **two independent axes** at once:

1. **the bracket — a material *world* (discrete-ish, themed).** the overall score `e`
   places the rig in one of the brackets below. the bracket decides the *vocabulary*:
   what the metal is made of, how it's lit, what state of repair it's in. rust at the
   bottom, divine at the top.
2. **per-component adaptation (continuous).** inside that world, **each component reads
   its own `parts.*` magnitude** and renders its own texture, color heat, and intensity.
   the cpu core, gpu core, and every node is an independent building block: one
   definition that looks crude when its part is weak and radiant when its part is strong.

the bracket sets the world; the part-score sets each block's life inside it; the seed
makes it unique. final look = `theme(e) × intensity(parts.x) × jitter(seed)`.

### the consequence we *want*: unbalanced rigs look unbalanced

because each block reads its **own** part-score, a machine with a monster gpu and a
weak cpu lives in a mid-tier world but its gpu core blazes while its cpu core sits dull
and overclocked. the imbalance is visible at a glance. this is a feature. a perfectly
balanced rig reads uniform and calm; a lopsided one reads tense and characterful. we
get this for free from data we already compute — do not flatten it.

## brackets are zones, not buckets

`e` is continuous and the seed perturbs everything, so:

- a bracket is a **zone on the gradient**, not a bin. two "charged" rigs are not the
  same card.
- near a boundary, materials **cross-fade**. a rig at `e = 0.64` is mostly charged with
  a breath of the next world bleeding in. there is no hard snap anywhere on the scale.
- the seed jitters corrosion amount, glow phase, facet offset, hue balance within the
  band — so even identical hardware on two different slugs diverges.

## the brackets (five now, room for ten)

a forge ascending. each is a **material identity + a state of repair + a light
behaviour**, not a fixed model. we ship five; the gaps between them are where a future
ten subdivide.

| # | tier (`score.ts`) | material world | state | light |
|---|---|---|---|---|
| 0 | `dormant` | **rust** — corroded iron, oxidized, flaking | cold, near-dead, barely powered | dim embers, slow, mostly dark |
| 1 | `humming` | **iron** — raw forged metal, scuffed, honest | alive, working, unremarkable | low steady glow, the odd spark |
| 2 | `charged` | **overcharge** — old tech jury-rigged past its limits, exposed wiring, brass + copper | scrappy, straining, pulling every watt it has | hot seams, flicker, visible effort |
| 3 | `surging` | **alloy** — refined modern alloy, titanium, clean energy | confident, cohesive, advanced | strong even plasma, gold↔teal |
| 4 | `overdrive` | **divine** — radiant ascended parts, light-emitting, haloed | otherworldly, effortless, overbuilt | blooming gold-white, arcing, heat shimmer |

note the arc is not "dim → bright." it's a *story*: the bottom is **decay**, the middle
is **defiant salvage** (the most characterful zone — old but overcharged, the underdog),
the top is **ascension**. magnitude and beauty rise together but the *flavour* changes
qualitatively between worlds, not just the brightness.

going to ten later = inserting a world between each pair (rust→iron gets a "tarnished"
step, etc.). the score already exposes a continuous `e`, so adding brackets is a table
change, never a logic change.

## every block obeys the same contract

so the scene composes from independent parts, each block — cpu core, gpu core, ram
node, storage node, the connective current — is authored as a pure function:

```
block(world: TierTheme, magnitude: number /*0..1, its own part*/, seed) -> appearance
```

- it takes the **world** (materials/palette/light from the bracket),
- its **own magnitude** (not the overall — its part-score),
- and the **seed** (for jitter + deterministic uniqueness).

no block hard-codes a tier. add a world to the table and every block adapts to it for
free. this is what keeps the system alive instead of presetted, and it's what lets us
reach ten brackets without rewriting a single component.

## relationship to the rest

- **color = performance, still.** the bracket's palette is chosen by power, never by
  brand. vendor stays iconography only. (PHILOSOPHY.md holds.)
- **single-viewport law still rules.** richer materials never earn a scrollbar. fit
  first, then beauty.
- **the score is private-by-shape.** it ranks *power*, not people. no leaderboard, no
  comparison ui — the number exists to choose materials and energy, nothing more.
