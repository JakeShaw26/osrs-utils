# Handoff — 2026-08-01

Snapshot for picking this up cold. **Living context is [`CLAUDE.md`](./CLAUDE.md)** —
read that first; this file covers what just happened and what to do next.

This replaces the 2026-07-31 handoff, whose first instruction was "look at the
sprites". That was done, they were rejected, and replacing them is what this
session became.

> ## ⛔ Resume point: the icons exist, but only on one machine
>
> **`ItemIcon` is built and tested — real OSRS item art, addressed by item id.**
> 4,646 icons, 13 new tests, 1,138 passing, lint/typecheck/format/build clean.
>
> **`public/item-icons/` is gitignored**, on the owner's call — 4,646 binaries is
> too much repo churn. The consequence is not cosmetic: **a fresh checkout has no
> icons at all**, so CI, any deploy, and any other machine render empty cells.
>
> **Decide delivery before writing a single line of feature code.** Wiring
> `ItemIcon` into a route first means building on something that only works
> where you happen to be sitting. Options and the recommendation are in
> [ADR-0021](./docs/adr/0021-osrs-item-icons-by-id.md) → _"Delivery is
> unresolved"_.
>
> To get icons locally right now: `node scripts/generate-item-icons.mjs`
> (~10 min, incremental — a second run costs 5 requests, not 4,650).
>
> **Page-level layout and navigation is still the open ADR-0020 step.** It did
> not move today. Don't lose it.

---

## Executive summary

The hand-drawn sprites from ADR-0020 were reviewed and rejected on quality. The
replacement is Jagex's own item art, and the session's real output is
infrastructure rather than a visible change: **nothing renders an `ItemIcon`
yet**, so the landing page still shows the seven sprites you didn't like.

| Built                               | What                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `scripts/generate-item-icons.mjs`   | Hand-run, incremental, throttled ~8 req/s with widening 403/429 backoff |
| `src/lib/ui/item-icons.ts`          | `hasItemIcon` / `itemIconSrc`, over a committed **id manifest**         |
| `src/components/atoms/ItemIcon.tsx` | Fixed 36px cell, `scale={1\|2}`, empty cell for an unknown id           |
| `.item-icon` in `globals.css`       | `image-rendering: pixelated` — the raster peer of `.sprite`             |
| ADR-0021 (+ index, CLAUDE.md)       | The licensing position and the hard-rule-#9 carve-out                   |

---

## What the measurement found

Three things were checked against live endpoints rather than assumed, and each
changed the design:

- **`/mapping` already carries the icon filename.** All 4,650 items have an
  `icon` field. **294 of them (6.3%) are not derivable from the item name** —
  `Acorn` is drawn by `Acorn 5.png`, `Abyssal bracelet(5)` by
  `Abyssal bracelet.png`. Deriving would have produced 294 silent 404s. **Never
  derive this.**
- **Item icons are not on a grid.** They are trimmed to content — widths 18–36,
  heights 29–32 — so they could not simply reuse `Sprite`, whose whole size
  union rests on a fixed 32 grid. The cell is fixed instead, and the artwork
  sits inside it.
- **⚠️ The cell is 36 because that is the game's, not because a sample said so.**
  A partial sample topped out at 32×31; the full set reaches exactly **36×32**.
  Sizing from the measurement would have clipped the widest icons in the app and
  nowhere else. Where a documented invariant and a sample agree, cite the
  invariant — the sample can only ever be a lower bound.

Four of the 4,650 mapping rows name an icon file that 404s (`Crystal 2h axe`,
`Trinket of vengeance (1)`/`(2)`, and the inactive axe). The mapping is
authoritative about the **filename**, not about the file existing. Those ids are
absent from the manifest and render the empty cell — the designed path, working.

**The icons were looked at**, not just counted: 4151, 20997 and 11802 render as
abyssal whip, twisted bow and Armadyl godsword. Last session's lesson held —
"the test passes" and "the picture is right" are different claims.

---

## What was decided about licensing

The starting position — _"it's a personal project, not distribution"_ — does not
hold. This app is public and read-only (ADR-0012), so serving an image to a
visitor is distribution and public display whatever the motive.

What makes it acceptable is different and already written down: `api-terms.md`
§1's **"Tolerated ≠ licensed. We rely on Jagex's forbearance."** This extends
that bet from data to art. Two facts worth not re-deriving:

- **OSRS Wiki images are _not_ CC BY-NC-SA.** Text is; images are _"used under
  the fair use license"_ and remain Jagex's. **Fair use is a defence, not a
  licence** — it does not transfer downstream to us.
- **The npm package route (`@dava96/osrs-icons`) does not launder this.** It
  ships icons under CC BY-NC-SA 3.0 while its own README says they are Jagex's
  property. It cannot license what it does not own.

**One consequence worth keeping in view:** because the PNGs are _not_ committed,
"make the repo public" stays a cheap option for unlocking branch protection.
Committing them would have turned that into publishing a Jagex art mirror.

---

## Next steps

### First — the blocker

1. **Decide icon delivery.** ADR-0021's _"Delivery is unresolved"_ table has
   three options. The recommendation is **one packed atlas + an offset map**:
   the objection was file _count_, and an atlas is the only option that answers
   file count without moving the cost onto the wiki. It changes `ItemIcon`'s
   internals (`background-position` rather than `<img src>`) and costs a
   whole-atlas download on pages showing few icons — that is the trade to weigh.

### Then — both of these, in this order

2. **Re-point the tool groups at real item icons.** This is what actually fixes
   the original complaint. `TOOL_GROUPS` in `lib/navigation/tools.ts` carries a
   sprite _name_; it would carry an **item id** instead — coins (995) for
   Economy, a clue scroll for Clues, and so on. Small change plus its test, and
   it lets `SpriteSheet` and the seven hand-drawn sprites go entirely.
3. **Wire `ItemIcon` into economy.** `/economy/prices` and `/economy/items/[id]`
   already have item ids in hand, so it is a display change with no new data and
   no new fetch.

### Then — the ADR-0020 step that is still open

4. **Page-level layout and navigation.** Unchanged from the last two handoffs
   and still the largest, least reversible piece. There is **no global nav at
   all** — every page is reached from the landing page or by URL. `Icon` exists
   for chrome; `ItemIcon` now exists for content.
5. **Marble texture**, which needs the layout first. Never behind data.

### Phase B's menu — unchanged, still unblocked

- **Roster page.** Still the highest-value thing not built: `sortByRank` /
  `groupByRank` over the WOM group, surfacing `player.updatedAt`.
- **`pruneRateLimitCounters()` job**, behind `CRON_SECRET`.
- **Drop-table feature**, now that V9b is answerable — and a natural first
  consumer of `ItemIcon`.
- **Deployment.** Blocked on **V13** more than on code. Note the migration is
  applied locally only.
- **~~Branch protection~~ — blocked, not pending.** The API returns **403,
  "Upgrade to GitHub Pro or make this repository public"**. On a private repo on
  the free plan there is no branch protection and no rulesets. Make the repo
  public, pay for Pro, or accept that CI reports rather than blocks. **Decide
  which, rather than re-listing it.**

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

- **`/mapping`'s `icon` field is authoritative; the item name is not.** 294 of
  4,650 differ. This is the same family as the `Salve amulet(i)` page-name trap.
- **A 200 response does not mean the icon exists.** Four mapping rows name files
  that 404. Handle per-item failure; do not abort the run.
- **`next/image` is wrong for pixel art**, not merely unnecessary. It resamples
  and re-encodes, which is exactly what destroys it, and
  `image-rendering: pixelated` cannot undo a resampled source. `<img>` plus a
  documented `no-img-element` suppression is deliberate — don't "fix" it. Vercel
  also bills optimisation per source image.
- **`shape-rendering: crispEdges` and `image-rendering: pixelated` are not
  interchangeable.** The first is SVG-only and does nothing to a raster; the
  second does nothing to an SVG. `Sprite` needs one, `ItemIcon` the other.
- **Throttle with a shared cursor, not a per-worker sleep.** `await sleep(delay)`
  inside N workers gives N× the intended rate — the classic way a "throttled"
  scraper turns out not to be.
- **A generated TS file fails `format:check` until `npm run format` runs.**
  Generated datasets are Prettier-formatted in this repo; the script prints the
  reminder.
- **`ItemIcon.test.tsx`'s disk guards are `it.runIf` and currently skipping.**
  That is a deliberate, temporary concession because their subject is
  gitignored. **Make them unconditional when delivery lands** — a skipped guard
  that stays skipped is how a suite starts lying. Contrast
  `postgres-store.live.test.ts`, which fails rather than skips under CI.

**Carried over, still true:**

- **`drizzle-kit` does not read `.env.local`** — a Next.js convention, not a Node
  one. Presents as `url: undefined`.
- **PowerShell 5.1's `Get-Content` defaults to ANSI**, silently corrupting
  em-dashes in `.tsx` past typecheck, lint _and_ Prettier. **Use the editor, not
  shell text substitution, on source files.** Its quote mangling also breaks
  `git commit -m`; write the message to a file and use `git commit -F`.
- **`.prettierignore` hides `.claude/worktrees/`**, so a root-run Prettier check
  against a worktree path silently checks _nothing_ and prints success.
- **Sprites cannot be tinted, ever** — state lives on the container. Glyphs
  (`Icon`) are `currentColor` and can. Never put one beside the other at the
  same size.
- **Sprites and item icons both need the inventory slot on dark.** The `#1b1206`
  outline is ~1.1:1 on a near-black surface.
- **ADRs are point-in-time.** ADR-0008 still names `--osrs-slate-900`; ADR-0020
  still says sprites must be original art, with a forward pointer to ADR-0021
  rather than an edit.
- **The dev server must be stopped before `next build`** — both use `.next/`.
- **`force-dynamic` is not a caching-neutral flag.** Use
  `fetchCache = 'default-cache'` + `connection()`.
- **`cn()` joins classes, it does not merge them.** CSS source order decides.
- **`getEnv()` validates the entire schema on first call.**
- **`app/layout.tsx` provides no `<main>`** — every page renders its own.
- **ESLint flat config: same-named rules replace, they do not merge.**
- **Never concatenate a Bucket query.** A bad query returns **HTTP 200** with an
  `error` field.
- **`roleOrders` indices are sparse**; **`gained` returns fewer rows than
  `memberCount`**.
- **Never call OSRS APIs with bare `fetch()`** — lint enforces it.

---

## The thing this session confirmed

The last three handoffs each closed on a variant of the same lesson: a rendered
comparison catches what walking routes cannot, and a measurement catches what
looking cannot. Today added the inverse, and it is the sharper half.

**Measurement is a lower bound, not a specification.** The icon cell was nearly
sized from a 222-file sample that topped out at 32×31. The real maximum is
36×32, and the difference would have clipped the widest icons in production
while every test stayed green — because the tests would have been written
against the same sample. The fix was not more measuring; it was noticing that
the game _publishes_ a 36×32 inventory cell and that a sample can only ever
confirm a documented invariant, never replace one.

The second confirmation is duller and more useful: **a decision changes the docs
that assert its opposite.** Reversing the commit-the-PNGs call meant editing
ADR-0021's title, its decision, its consequences, its alternatives table, plus
`CLAUDE.md`, `api-terms.md`, `components/README.md`, the generator header and
the manifest template. Any one of those left stale would have been a document
confidently stating the opposite of the truth — which is worse than no document,
and is exactly what `components/README.md` was doing about sprites before this
session touched it.
