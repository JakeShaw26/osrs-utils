# Handoff — 2026-07-28

Snapshot for picking this up cold. **Living context is [`CLAUDE.md`](./CLAUDE.md)** —
read that first; this file covers what just happened and what to do next.

This replaces the 2026-07-27 evening handoff, which ended at "nothing compares
the six slices visually". That is now closed — see below.

> ## ✅ Resume point: the direction is chosen — the redesign is buildable
>
> A **design-system project now exists** on claude.ai/design with the current UI
> inventoried and four redesign directions explored. **Zero repo changes were
> made** — the code on `main` is untouched by any of it.
>
> **Decided 2026-07-31 by the repository owner: direction B · Nero Marquina,
> with light mode first-class** (not a fallback). Recorded in
> [ADR-0020](./docs/adr/0020-nero-marquina-visual-direction.md); the reasoning
> and the rejected directions are below and in the ADR's alternatives table.
>
> Nothing is blocked. The build sequence is in [Next steps](#next-steps) —
> start with the Layer 1 re-point, which is the cheapest point to reject.
>
> Phase B's own menu is unchanged and unblocked, and one of its items —
> **de-duplicating the numeric field** — is now worth doing _before_ the re-skin.
>
> Start Postgres before doing anything database-shaped: `npm run db:up`.

---

## Executive summary

**A redesign workstream opened, explored four directions, and B was chosen.**
The exploration session did three things:

1. **Inventoried the current UI** into a design-system project — 48 components
   and the full token system, rendered light and dark side by side from real
   markup and real token values, not sketches.
2. **Explored four complete redesign directions** — marble-based palettes mixed
   with OSRS theming, each a full token set in both themes, each applied to the
   same page fragment so they are compared like for like rather than admired
   in isolation.
3. **Built an OSRS-grammar pixel icon set** to replace the generic line icons
   the first pass produced.

**No code was written.** The exploration lives in the design project and can be
thrown away at no cost if the direction turns out wrong. That was deliberate: a
redesign that touches tokens touches all 27 routes, and it is much cheaper to
reject a palette in a preview than in a diff. The only repository changes are
this file and [ADR-0020](./docs/adr/0020-nero-marquina-visual-direction.md).

---

## The design-system project

**Project:** `OSRS Clan Toolkit — Design System`
**ID:** `83afccbd-460f-4655-863e-264658472345`
**14 files** — 10 inventory cards, 4 exploration cards.

There were **no design-system projects at all** before this session; this one
was created for it. Note that the `/design-sync` skill is **not installed** in
this environment — the `DesignSync` tool was driven directly. If you install the
skill later it will expect a locally-generated bundle; this project was
hand-authored, which is why its cards are explicitly registered _and_ carry
`@dsCard` markers.

### Inventory — what the app looks like today

| Card                          | Contents                                                        |
| ----------------------------- | --------------------------------------------------------------- |
| `foundations/colors`          | Every semantic group, both themes, with the two-layer rationale |
| `foundations/typography`      | The scale, plus the same table with and without `.tabular`      |
| `foundations/shape-elevation` | Radii, shadows, spacing rhythm, focus ring                      |
| `components/button`           | 3 variants × default / hover / focus / disabled                 |
| `components/form-controls`    | Input + Select, carrying the ⚠️ 3× duplicate-field warning      |
| `components/stat-badge`       | All 6 tones                                                     |
| `components/price`            | PriceTag formatting ladder + PriceChangeIndicator               |
| `components/table`            | Data, hover row, empty state                                    |
| `components/feature-card`     | Grid + states, including the `aria-disabled` coming-soon case   |
| `templates/calculator-layout` | Full shell + all 3 content widths                               |

The `.tabular` card is the one worth looking at first. It puts the same GP
column side by side with and without `font-variant-numeric: tabular-nums`, and
the jitter is much more obvious than the convention's one-line description in
`CLAUDE.md` makes it sound.

### Explorations — the four directions

| Card                          | Contents                                                            |
| ----------------------------- | ------------------------------------------------------------------- |
| `explorations/palettes`       | Four complete token sets, light + dark                              |
| `explorations/applied`        | The same page fragment in all 4 × both themes — the comparison card |
| `explorations/icons`          | OSRS pixel sprites + tintable UI glyphs                             |
| `explorations/marble-texture` | The `feTurbulence` vein filter, plus an ALLOWED / BANNED pair       |

**`applied` is the card to judge from.** The palette card shows swatches, which
always flatter; `applied` shows a banner, two icon-led cards, a price table and
an action row in each direction, which is where a palette actually fails.

---

## The four directions

All four keep the two-layer token structure and all existing semantic names, so
the change is a re-point of Layer 1, not a re-architecture. All four share the
same brand gold.

|       | Direction                  | Ground                               | Character                                                         | Risk                                                    |
| ----- | -------------------------- | ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------- |
| **A** | **Carrara & Gold**         | Warm off-white `#f4f2ee` / `#171613` | Closest to classic marble. Warm, soft, quite gentle               | Warm greys make the amber `warning` token muddy         |
| **B** | **Nero Marquina**          | Cool neutral `#eeeff0` / `#0b0b0c`   | Black marble with white veining. High contrast, gold pops hardest | The most conservative — least "OSRS" of the four        |
| **C** | **Verde Antico**           | Green-grey `#eef1ec` / `#0d120f`     | The most distinctive. Reads as stone _and_ as RuneScape           | ⚠️ Green ground weakens the green `profit` signal       |
| **D** | **Travertine & Parchment** | Warm sand `#f2ece0` / `#14100a`      | Most OSRS-native — quest-scroll parchment                         | Lowest contrast headroom; the warm ground eats `border` |

**Chosen: B · Nero Marquina** (owner, 2026-07-31 — [ADR-0020](./docs/adr/0020-nero-marquina-visual-direction.md)).
Not because it is the prettiest — C is —
but because this app is fundamentally **dense numeric tables**, and B is the only
direction whose ground is chromatically neutral. Every other direction tints the
surface, and a tinted surface competes with the `profit` / `loss` / `success` /
`danger` tokens that carry the app's actual meaning. B spends its whole colour
budget on the data and the gold, which is where a tool's colour should go.

C's problem is concrete and worth stating plainly: on a green surface, a green
"profit" figure is a smaller perceptual step than a red "loss" figure, so gains
read quieter than losses. That is a semantic bug dressed as a palette choice. It
is fixable — push `profit` to a brighter emerald, which the card does — but it
is fixing something the other three never break.

### The gold fix, which applies to whichever direction wins

Today's light-mode `--primary` is `#b47c17`, and it reads brown rather than gold.
The cause is not taste: it has to be that dark to carry **white** `primary-content`
at 4.5:1. Dark mode already dodges this — it pairs a bright gold with near-black
text and gets a much better gold for free.

All four directions apply the same fix in light mode: **true gold `#c9a227` with
near-black `primary-content`**, which clears 7:1 rather than scraping 4.5:1. The
button gets brighter _and_ more accessible at once. This is the single change
with the best ratio of visual payoff to risk in the whole exploration, and it is
independent of which direction wins.

---

## Icons — OSRS pixel sprites

The first pass produced generic thin-stroke line icons. That was wrong for this
app and has been replaced.

**⚠️ What we cannot do, and why.** OSRS item and interface sprites are Jagex
copyright. The Wiki hosts them under fair dealing, **not** a redistribution
licence. So we can neither vendor the PNGs — that is **hard rule #9 / ADR-0007**,
"never copy third-party source into this repo" — nor hotlink the Wiki's CDN,
which breaches [`docs/api-terms.md`](./docs/api-terms.md) on self-limiting and
honest identification. If literal sprites are ever wanted, that is a licensing
conversation with Jagex, not a build step.

**What was built instead:** original art drawn to OSRS's _icon grammar_ — the
32×32 item-sprite grid, a 1px `#1b1206` outline, flat fills with one highlight
and one shade, light from the top-left, no anti-aliasing, ≤6 colours per sprite.
Seven feature sprites (coins, scimitar, anvil, clue scroll, quest point star,
shield, hourglass) and twelve UI glyphs. Same visual language; ours to ship.

### Three findings that change the design system, not just the art

- **This is a two-tier icon system, and the tiers cannot mix.** Feature sprites
  are **illustrations**: multi-colour, fixed palette, byte-identical in light and
  dark, and therefore **not tintable**. They can never carry state (disabled,
  active, danger) through colour — state has to live on the container. UI chrome
  stays **glyphs**: single-path `fill: currentColor`, still following the
  `content` tokens. Put a tinted glyph beside a fixed-palette sprite at the same
  size and it looks like a rendering bug.
- **Dark mode breaks the sprites, and the fix is authentic.** The 1px outline is
  `#1b1206`; on a `#171613` surface that is roughly 1.1:1, so the silhouette
  dissolves and the sprite frays into loose colour. OSRS never hits this because
  its own UI sits on lit brown stone, never near-black. The fix is to float the
  sprite in an **inventory slot** — a lighter inset tile — which is both the
  contrast fix and the game's own device, so it reads as intent rather than as a
  patch. The exploration card demonstrates the failure and the fix side by side.
- **Integer scale only.** A 32-grid sprite is crisp at 16 / 32 / 48 / 64. At 20,
  24 or 26 the grid lands on fractional device pixels and the staircase goes soft.
  **24 is the one that will get reached for by habit**, so the size prop should
  refuse it rather than rely on discipline. This is a real difference from the
  old line icons, which were fine at any size.

---

## Marble texture — the rules it needs

`explorations/marble-texture` implements the veining with an SVG `feTurbulence`
filter: anisotropic `baseFrequency` (≈0.006 horizontal against 0.021 vertical)
stretches the turbulence into directional veins, `feColorMatrix` maps the red
channel to alpha with a threshold, and `feFlood` + `feComposite operator="in"`
colours them. Eight filter variants exist, one per direction per theme.

Two caveats, both flagged before anything is built on it:

- **⚠️ Texture never goes behind data.** Veining behind a dense numeric table
  makes contrast vary **per glyph**, which is not something WCAG can measure and
  therefore not something an audit will catch. It needs a rule, not a check:
  texture on `surface` and chrome only, **never** behind `surface-raised` where
  the numbers live. The card shows an ALLOWED and a BANNED example.
- **`feTurbulence` is CPU-rasterised**, costly over large areas, and
  **re-rasterises on resize**. Mitigation is a fixed-size element or baking it to
  a static asset at build time. Do not paint it across a full-page background and
  expect it to be free.

---

## What the previous handoff left open, now closed

The 2026-07-27 handoff ended:

> The one still-unguarded thing: **nothing compares the six slices visually.**
> They share a token system that has been walked route by route but never seen
> side by side.

That is what the inventory cards are. And the observation held up — putting the
slices side by side is exactly what surfaced the brown-gold problem, which
walking routes one at a time never did, because `#b47c17` looks fine until it is
next to something that is actually gold.

It also fits the pattern the parallel-agent experiment kept producing: **the
thing that catches a defect reads a different source than the code it guards.**
A rendered side-by-side comparison is another such source.

---

## Next steps

### The decision — settled

Both questions are answered ([ADR-0020](./docs/adr/0020-nero-marquina-visual-direction.md)):
**B · Nero Marquina**, and **light mode is first-class**. Light being first-class
roughly doubles the surface — texture, sprite slots and contrast all get checked
twice — and it was chosen anyway because there is no auth, so no theme preference
can be remembered server-side and every visitor lands on whatever their OS says.
Dark stays the *default* (user choice → OS → dark, per ADR-0008); first-class
means light is designed, not preferred.

### The build, in this order

Sequenced by blast radius — earlier steps are cheaper to reject:

- **Re-point Layer 1 in `globals.css`.** Layer 2 semantic names do not change, so
  no component changes. This alone re-skins all 27 routes and is the checkpoint
  worth stopping at to look around.
- **Apply the gold fix** — `#c9a227` with near-black `primary-content` in light
  mode. Independent of direction; do it regardless.
- **Add the sprite sheet.** One `<defs>` in the root layout, `<use href>` at the
  call sites — seven sprites inlined into 27 routes is dead weight. Sprites need
  a `<title>`, not `aria-hidden`, unless the visible label already says the same
  word.
- **Then page-level layout and navigation.** Largest and least reversible; it
  should follow a token system that has already been seen working.

### Phase B's own menu — unchanged, still unblocked

Dependabot PRs **#11 and #12** were the top item last session and have since
landed (`bd5430f` bumps `actions/setup-node` to 7.0.0). **#13 is in**, and
**#18 and #19 are reverts** — the ESLint 10 bump broke lint on `main`, and
TypeScript is deliberately held at 5.x until the tooling supports 7. Treat major
bumps here as real upgrades, not rubber stamps; two of the last five needed
backing out.

- **Roster page.** Still the highest-value thing not yet built: `sortByRank` /
  `groupByRank` over the WOM group, surfacing `player.updatedAt` so staleness is
  visible rather than implied. One request, no fan-out.
- **`pruneRateLimitCounters()` job**, behind `CRON_SECRET`. Nothing breaks
  without it; the table just grows.
- **De-duplicate the numeric field** across combat / skilling / quests. Touches
  five slices, so it is deliberate work, not a drive-by. **Worth doing before the
  redesign, not after** — three near-identical fields means restyling the input
  three times and getting it subtly wrong twice.
- **Drop-table feature**, now that V9b is answerable.
- **Deployment.** Nothing is deployed, and the migration is applied to the local
  database only. Whatever host is chosen starts from an unmigrated database.
  Blocked on **V13** more than on code.
- **Branch protection.** The `ci` gate job exists so this is one setting, but
  nothing is protected yet: CI reports and does not block. Require `ci` on `main`.

---

## Open questions

Unchanged. **Resolved: V1, V3, V9, V9b, V11, V14.** Moot: V11a, V4.

| #   | Question                                 | Blocks            |
| --- | ---------------------------------------- | ----------------- |
| V5  | WOM stance on our anonymous read cadence | Caching design    |
| V10 | Cheap WOM group-level update endpoint?   | Scheduled refresh |
| V2  | TempleOSRS terms unread (403)            | Collection log    |
| V13 | Free-tier cron limits + hosting cost     | ADR-0006          |

**New, design-side, and not yet numbered:** if a direction is chosen and built,
it needs an ADR — it changes a settled decision ([ADR-0008](./docs/adr/0008-tailwind-v4-css-first-theming.md)
covers the _mechanism_, not the palette) and adds the two-tier icon system and
the texture rule, neither of which is derivable from the code.

---

## Gotchas

**New this session:**

- **Pixel sprites are not glyphs.** They cannot be tinted, cannot carry state
  through colour, need a lighter ground in dark mode, and only scale to integer
  multiples. Reaching for `size={24}` out of habit will quietly soften them.
- **`DesignSync finalize_plan` requires `deletes`**, even when empty. Omitting it
  fails with `finalize_plan requires: deletes.` Pass `[]`.
- **Swatch cards flatter every palette.** Judge a direction from an applied
  fragment with real data in it, or you will pick the one that photographs best.

**Carried over, still true:**

- **`drizzle-kit` does not read `.env.local`.** Nor does any plain Node process
  — it is a Next.js convention. It presents as `url: undefined`, which reads like
  a broken config file.
- **PowerShell 5.1's `Get-Content` defaults to ANSI, not UTF-8.** A
  read-modify-write over a `.tsx` file containing em-dashes silently corrupts
  every one of them. Typecheck, lint **and** Prettier all pass on the corrupted
  files. **Use the editor, not shell text substitution, on source files.**
- **PowerShell 5.1 mangles quotes passed to native commands.** `git commit -m`
  with a here-string containing `"` splits into pathspecs. Use `git commit -F`.
- **The dev server must be stopped before `next build`** — both use `.next/`.
- **`force-dynamic` is not a caching-neutral flag.** It disables the fetch data
  cache. Use `fetchCache = 'default-cache'` + `connection()`. Lint enforces this
  in pages; route handlers are exempt, and correctly so.
- **`cn()` joins classes, it does not merge them.** Passing a `max-w-*` through
  `className` ships both, and **CSS source order decides**. Prefer a named prop.
  **This will bite during the redesign** — it is the exact shape of mistake a
  restyling pass invites.
- **`getEnv()` validates the entire schema on first call** — one missing variable
  breaks every route, not the related ones.
- **`app/layout.tsx` provides no `<main>`** — every page renders its own.
  `page-conventions.test.ts` enforces it. Relevant if navigation gets restructured.
- **ESLint flat config: same-named rules replace, they do not merge.** Test a new
  lint rule by writing code that should fail it.
- **`URL.hostname` keeps the brackets on IPv6** — `[::1]`, not `::1`.
- **Never concatenate a Bucket query.** A bad query returns **HTTP 200** with an
  `error` field.
- **`roleOrders` indices are sparse**; **`gained` returns fewer rows than
  `memberCount`**.
- **Never call OSRS APIs with bare `fetch()`** — lint enforces it.

---

## State of the repo

Unchanged from 2026-07-27 evening, because this session changed no code:

- **27 routes, 1065 tests**, all six slices on `origin/main`, CI green.
- The rate-limit migration is applied to **local Postgres only**;
  `enforceRateLimit()` is verified end-to-end (20 pass, the 21st gets a 429).
- `daily_snapshots` still has no writer. `rate_limit_counters` still has no
  pruning job.
- No clan/roster feature exists; `wom-group.ts` and `ranks.ts` are tested but
  have no caller.
