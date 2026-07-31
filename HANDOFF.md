# Handoff — 2026-07-31

Snapshot for picking this up cold. **Living context is [`CLAUDE.md`](./CLAUDE.md)** —
read that first; this file covers what just happened and what to do next.

This replaces the 2026-07-28 handoff, which ended on an open design decision.
That decision is made and mostly built.

> ## ✅ Resume point: the redesign is real, and one step is left
>
> **Direction B (Nero Marquina) is chosen, built and on `main`.** Every route is
> re-skinned in both themes, the gold is fixed, and the OSRS sprites are in.
> Four PRs (#20–#23) landed today. CI green, **1125 tests**, 27 routes.
>
> **One ADR-0020 step remains: page-level layout and navigation.** It is the
> largest and least reversible piece, which is why it was sequenced last. The
> marble texture is also unbuilt and depends on it — see
> [Next steps](#next-steps).
>
> ⚠️ **Nobody has actually looked at the sprites.** Everything else this session
> was verified by something reading a different source; pixel art is the one
> thing where no guard substitutes for eyes. `npm run dev`, landing page, both
> themes. That is the first thing to do tomorrow.
>
> Start Postgres before anything database-shaped: `npm run db:up`.

---

## Executive summary

The redesign went from "a decision nobody has made" to "three of its four steps
shipped" in one session:

| PR  | What                                               |
| --- | -------------------------------------------------- |
| #20 | ADR-0020 — direction B, light mode first-class     |
| #22 | Layer 1 re-point + the gold fix + a contrast guard |
| #21 | Five labelled fields collapsed into two            |
| #23 | The sprite sheet and the two-tier icon system      |

**The most valuable thing built was not the palette — it was
`src/test/token-contrast.test.ts`.** ADR-0020 claims light mode is first-class,
and nothing in the repo could check that claim: a component only knows it asked
for `text-content-subtle`, and whether that is legible is decided two files away,
per theme. Measuring instead of looking is what turned the redesign from a
plausible change into a verified one.

---

## What the measurement found

Parsing `globals.css` and computing WCAG ratios for every rendered pair, before
and after the re-point:

- **The old light-mode gold button label was 3.60:1.** It had failed AA since
  Phase A, and the exploration card's claim that it "scrapes 4.5:1" was
  generous. It is **7.34:1** now.
- **The re-point fixed five failing pairs and quietly broke two.** The brighter
  gold dropped the light focus ring to 2.1:1 — a **keyboard-accessibility
  regression every existing test stayed green through** — and light
  `content-subtle` fell to 2.82:1 behind the `text-2xs` field labels that are
  now on every calculator.

**Three token values therefore deviate from the exploration card on purpose**
(`content-subtle` in both themes, light `warning`), plus one token the card never
had: `--focus-ring`, because the brand gold cannot carry a ring on a light
ground. All are called out in ADR-0020 and `docs/theming.md`. If the card's exact
values are ever preferred, that is a deliberate trade, not a correction.

**A concept worth keeping:** WCAG has two thresholds and the second is easy to
miss. Text needs **4.5:1**. Non-text indicators — focus rings, control
boundaries, chart strokes — fall under **1.4.11 at 3:1**. Nothing visually
announces which rule applies, which is exactly how a focus ring escapes a
text-contrast audit and then fails only for the people least likely to be in the
room when colours get picked.

**Known gap, deliberately not asserted:** `--border-strong` is 1.9:1 / 1.5:1
against raised surfaces. It predates the redesign, and raising it makes every
input read as heavily outlined. Documented in `docs/theming.md` instead — a
failing assertion nobody intends to fix trains people to ignore the suite.

---

## The guards added, and what each one reads

The pattern this project keeps rediscovering held again: **every guard that
caught something reads a different source than the code it guards.**

| Guard                                | Reads            | Catches                                     |
| ------------------------------------ | ---------------- | ------------------------------------------- |
| `token-contrast.test.ts`             | `globals.css`    | Illegible token pairs, in either theme      |
| `token-contrast.test.ts` (structure) | `globals.css`    | A hex literal smuggled into Layer 2         |
| `Sprite.test.tsx` (sheet coverage)   | The rendered DOM | A sprite named but never drawn              |
| `Sprite.test.tsx` (palette)          | `globals.css`    | A sprite fill pointed at a theme token      |
| `tools.test.ts`                      | `TOOL_GROUPS`    | A group with a missing or duplicated sprite |

Two earned their keep immediately:

- **The contrast guard caught the sprite-slot colours the next day**, on a PR
  that had nothing to do with contrast — the first draft put raw hex in Layer 2
  instead of referencing Layer 1.
- **The sprite-coverage guard catches what types cannot.** `SpriteName` accepting
  `'coins'` proves the union lists it, not that anyone _drew_ it, and a `<use>`
  pointing at a missing id renders **nothing at all**, silently.

Both were verified by making them fail on purpose before being trusted.

---

## The field de-duplication (#21)

`combat/NumberField`, `skilling/NumericField`, `quests/LevelField` and two
`SelectField`s became `molecules/NumericField` and `molecules/SelectField`. Done
**before** the re-skin on purpose: three near-identical inputs means restyling
the input three times and getting it subtly wrong twice.

The merge took the **union**, the same resolution `parse-quantity` got, so
nothing that worked stopped working — text mode keeps the deliberate refusal of
`type="number"` (players paste `1,000` and type `13m`, both of which a native
number input silently discards, handing the caller an empty string that reads as
0), and `mode="number"` keeps combat's `min`/`max`/`step` and its
null-not-`NaN` reporting.

Two side effects worth remembering:

- **`id` is now required**, which is what lets hint and error be associated with
  `aria-describedby`. Combat's hints are announced to screen readers for the
  first time — they were previously rendered with nothing pointing at them.
- **Skilling's field labels look different**: they now use the uppercase
  micro-label combat and quests already shared.

---

## Next steps

### First, tomorrow

1. **Look at the app.** `npm run dev`, landing page, both themes. Specifically:
   does the light-mode inventory slot read as intentional? In dark it is OSRS's
   own brown slot; in light it is a gold-tinted well, which was a judgement call
   made from the palette rather than something the exploration showed.

### Then, the last ADR-0020 step

2. **Page-level layout and navigation.** Largest and least reversible, so it was
   sequenced last, after a token system already seen working. Note there is
   currently **no global nav at all** — every page is reached from the landing
   page or by URL. `Icon` now exists for chrome (chevron, close, search, sort,
   filter, sun/moon), so the pieces are there.
3. **Marble texture.** Cheap, but it needs somewhere legitimate to live and the
   texture rule bans it from behind data — `surface` and chrome only, never
   behind `surface-raised` where the numbers are. Veining varies contrast **per
   glyph**, which WCAG cannot measure and an audit will not catch. Layout first
   gives it a home. The filter and the ALLOWED/BANNED pair are in the design
   project's `explorations/marble-texture` card. `feTurbulence` is CPU-rasterised
   and re-rasterises on resize, so bake it or fix its size.

### Phase B's menu — unchanged, still unblocked

- **Roster page.** Still the highest-value thing not yet built: `sortByRank` /
  `groupByRank` over the WOM group, surfacing `player.updatedAt` so staleness is
  visible rather than implied. One request, no fan-out.
- **`pruneRateLimitCounters()` job**, behind `CRON_SECRET`. Nothing breaks
  without it; the table just grows.
- **Drop-table feature**, now that V9b is answerable.
- **Deployment.** Nothing is deployed and the migration is applied to the local
  database only, so any host starts from an unmigrated database. Blocked on
  **V13** more than on code.
- **~~Branch protection~~ — blocked, not pending.** Carried across four handoffs
  as "one setting in repo settings". It is not available: the API returns
  **403, "Upgrade to GitHub Pro or make this repository public"**. On a private
  repo on the free plan there is no branch protection and no rulesets. The real
  options are to make the repo public, pay for Pro, or accept that CI reports
  rather than blocks. **Decide which, rather than re-listing it.**

---

## Open questions

Unchanged. **Resolved: V1, V3, V9, V9b, V11, V14.** Moot: V11a, V4.

| #   | Question                                 | Blocks            |
| --- | ---------------------------------------- | ----------------- |
| V5  | WOM stance on our anonymous read cadence | Caching design    |
| V10 | Cheap WOM group-level update endpoint?   | Scheduled refresh |
| V2  | TempleOSRS terms unread (403)            | Collection log    |
| V13 | Free-tier cron limits + hosting cost     | ADR-0006          |

---

## Gotchas

**New this session:**

- **`.prettierignore` hides `.claude/worktrees/`, so a Prettier check run from
  the repo root against a worktree path silently checks _nothing_** and prints
  "All matched files use Prettier code style!". CI then fails on `format:check`,
  where the same files are repo-relative. Run Prettier **with the worktree as the
  working directory**. A green result from a check that checked nothing is worse
  than a red one.
- **Layer 1 is genuinely isolated.** Renaming `--osrs-slate-*` → `--osrs-stone-*`
  touched nothing outside `globals.css`. That is ADR-0008's indirection paying
  off, and it means the next palette change is still a one-file edit.
- **Sprites cannot be tinted, ever.** They are fixed-palette illustrations, so
  they can never carry state (disabled, active, danger) through colour — state
  lives on the container. Glyphs (`Icon`) are `currentColor` and can. **Never put
  one beside the other at the same size**; it reads as a rendering bug.
- **`Sprite` refuses `size={24}`** at the type level. A 32-grid sprite lands on
  fractional device pixels there and goes soft, and 24 is the size habit reaches
  for.
- **Sprites need the inventory slot on dark.** The `#1b1206` outline is ~1.1:1 on
  a near-black surface and the silhouette dissolves without a lighter ground.
- **ADRs are point-in-time.** ADR-0008 still names `--osrs-slate-900` as its
  example. That was true when written, and it was deliberately not edited.

**Carried over, still true:**

- **`drizzle-kit` does not read `.env.local`** — a Next.js convention, not a Node
  one. Presents as `url: undefined`.
- **PowerShell 5.1's `Get-Content` defaults to ANSI**, silently corrupting
  em-dashes in `.tsx` past typecheck, lint _and_ Prettier. **Use the editor, not
  shell text substitution, on source files.** Its quote mangling also breaks
  `git commit -m`; write the message to a file and use `git commit -F`.
- **The dev server must be stopped before `next build`** — both use `.next/`.
- **`force-dynamic` is not a caching-neutral flag.** Use
  `fetchCache = 'default-cache'` + `connection()`. Lint enforces it in pages.
- **`cn()` joins classes, it does not merge them.** CSS source order decides.
- **`getEnv()` validates the entire schema on first call.**
- **`app/layout.tsx` provides no `<main>`** — every page renders its own.
- **ESLint flat config: same-named rules replace, they do not merge.**
- **`URL.hostname` keeps the brackets on IPv6.**
- **Never concatenate a Bucket query.** A bad query returns **HTTP 200** with an
  `error` field.
- **`roleOrders` indices are sparse**; **`gained` returns fewer rows than
  `memberCount`**.
- **Never call OSRS APIs with bare `fetch()`** — lint enforces it.

---

## The thing this session confirmed

The 2026-07-28 handoff closed its open item — "nothing compares the six slices
visually" — by building the design-system project. Today added the sharper
version of the same lesson:

**A rendered comparison catches what walking routes cannot, and a measurement
catches what looking cannot.** The side-by-side surfaced the brown gold. But only
arithmetic could show that the _fixed_ gold had broken the focus ring, that the
old button label had been failing AA for weeks, or that a sprite fill had been
pointed at a theme token. Every one of those renders perfectly.

Three sessions of parallel-agent work produced defects that were always an
_absence_ or an _accident_, never wrong logic. Today's were the same shape — and
the guards that caught them were, again, the ones reading a different source than
the code they guard.
