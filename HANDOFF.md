# Handoff — 2026-08-01

Snapshot for picking this up cold. **Living context is [`CLAUDE.md`](./CLAUDE.md)** —
read that first; this file covers what just happened and what to do next.

This replaces the 2026-07-31 handoff, whose first instruction was "look at the
sprites". That was done, they were rejected, replacing them became the session,
and by the end the sprite system itself was deleted.

> ## ✅ Resume point: the landing page shows real item art. Start at economy.
>
> **The icons ship as ten committed atlas sheets** — 822 KB total, 4,645 icons,
> `public/item-icons/atlas-<n>-<hash>.png` ([ADR-0022](./docs/adr/0022-item-icon-delivery-packed-atlas.md)).
> A fresh checkout has icons; CI and any deploy have icons. **The tool groups
> carry item ids and the seven rejected sprites are deleted**
> ([ADR-0023](./docs/adr/0023-retire-the-hand-drawn-sprite-system.md)).
> 1,133 passing, lint/typecheck/format/build clean.
>
> **Everything is pushed.** Three commits on `docs/handoff-2026-07-31` —
> `77e990f` (ItemIcon), `efaf60a` (atlas delivery), `1032e94` (tool groups +
> sprite removal). ⚠️ **The branch name describes only its first commit**, and it
> is not merged. Rename it or open the PR before it collects a fourth unrelated
> commit.
>
> **Next: wire `ItemIcon` into `/economy/prices` and `/economy/items/[id]`.**
> They already hold item ids, so it is display only — no new data, no new fetch.
> Full detail in [Next steps](#next-steps) below.
>
> **⚠️ One decision this spent:** Jagex artwork is now in git history, so "make
> the repo public" to unlock branch protection is effectively foreclosed. That
> leaves **pay for GitHub Pro** or **accept that CI reports rather than blocks**.
> ADR-0022 has the reasoning; the option would come back if the sheets ever move
> to object storage (blocked on V13).
>
> To refresh icons after a game update: `npm run icons` (~10 min, incremental —
> a second run costs a handful of requests, not 4,650). To repack without
> fetching: `npm run icons:pack`.
>
> **Page-level layout and navigation is still the open ADR-0020 step.** It did
> not move today. Don't lose it.

---

## Executive summary

The hand-drawn sprites from ADR-0020 were reviewed and rejected on quality. They
are now **gone** — replaced by Jagex's own item art, delivered as a packed atlas
and rendering on the landing page. The sprite system (`Sprite`, `SpriteSheet`,
`sprites.ts`, the `.sprite` palette) was deleted once nothing called it.

| Built                                   | What                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `scripts/generate-item-icons.mjs`       | Hand-run, incremental, throttled ~8 req/s with widening 403/429 backoff. Now fills the gitignored `.icon-cache/` |
| `scripts/pack-item-icons.mjs`           | Packs the cache into ten content-hashed sheets and writes the manifest                                           |
| `src/lib/ui/item-icons.ts`              | `hasItemIcon` / `itemIconPosition`, over the manifest's **ids and geometry**                                     |
| `src/components/atoms/ItemIcon.tsx`     | Fixed 36px cell, `scale={1\|2}`, background offset into a sheet                                                  |
| `.item-icon` in `globals.css`           | `image-rendering: pixelated` + `no-repeat`. The `.sprite` palette beside it is gone                              |
| `item-icons.atlas.test.ts`              | Eight guards that read the committed **pixels**, none of them skippable                                          |
| `lib/navigation/tools.ts`               | `TOOL_GROUPS` carries an **item id** per group; its test asserts each has artwork                                |
| **Deleted**                             | `Sprite`, `SpriteSheet`, `lib/ui/sprites.ts`, the `.sprite` palette — nothing called them (ADR-0023)             |
| ADR-0021/0022/0023 (+ index, CLAUDE.md) | Licensing, the hard-rule-#9 carve-out, delivery, and retiring the sprites                                        |

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
  heights 29–32 — so they could not simply reuse `Sprite` (then still alive,
  deleted later the same session), whose whole size union rested on a fixed 32
  grid. The cell is fixed instead, and the artwork sits inside it.
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

**⚠️ One consequence, and it was spent the same day.** While the PNGs were
uncommitted, "make the repo public" stayed a cheap option for unlocking branch
protection. **The atlas sheets are committed, so it is no longer** — publishing
the repo would publish ~4,645 Jagex icons as a downloadable archive, which is a
materially different act from a site displaying them. ADR-0022 took that trade
deliberately, because delivery blocked every feature and the alternative that
keeps the option (object storage) is blocked on V13.

---

## Next steps

Both blockers from the last handoff are closed — icon delivery (ADR-0022) and
the tool groups (ADR-0023). What follows is the fresh list.

### 1. Wire `ItemIcon` into economy — start here

The smallest useful next change, and the one that proves the atlas in a real
data-bearing route rather than on six hand-picked ids. **Display only: no new
data, no new fetch, no upstream cost.** Every call site already has `item.id`.

The three places:

| File                                    | Where                                        |
| --------------------------------------- | -------------------------------------------- |
| `organisms/economy/ItemPriceTable.tsx`  | Beside the item name in each row             |
| `organisms/economy/AlchProfitTable.tsx` | Same — it already links to `/economy/items/` |
| `organisms/economy/ItemOverview.tsx`    | The item detail header. `scale={2}` here     |

Four things to get right, all of them already-known traps:

- **Omit `name`.** The row prints the item name next to the icon, so passing it
  announces "Abyssal whip Abyssal whip". Decorative is the correct choice here
  and `ItemIcon` handles it — that is what the "is decorative when it has no
  name" test pins.
- **`slotted` on dark surfaces only.** The near-black outline is ~1.1:1 on a
  near-black surface. Check the table's actual surface token before deciding;
  do not slot everything reflexively, it is a visible box.
- **A 36px cell changes row height.** Check the `.tabular` GP columns still line
  up and the table does not suddenly scroll on mobile.
- **These are Server Components — keep them that way.** The manifest is ~28 KB
  and reaches the client bundle only if a Client Component imports it.

Expect a **missing icon in the tables** and make sure it looks deliberate: the
price feed is tradeables-only so coverage is near-total there, but
`/economy/items/[id]` takes an id from the URL and will meet ids with no
artwork.

### 2. Page-level layout and navigation — the last ADR-0020 step

Unchanged from the last three handoffs and still the largest, least reversible
piece. There is **no global nav at all** — every page is reached from the
landing page or by URL. `Icon` exists for chrome; `ItemIcon` now exists for
content, and `TOOL_GROUPS` is already the nav's data model, so the directory
does not need reinventing.

Note `app/layout.tsx` is now nearly bare — the `SpriteSheet` that used to sit in
it is gone, so there is a clean place to put a header.

### 3. Marble texture

Needs the layout first. Never behind data.

### Then — Phase B's menu, unchanged and still unblocked

- **Roster page.** Still the highest-value thing not built: `sortByRank` /
  `groupByRank` over the WOM group, surfacing `player.updatedAt`.
- **`pruneRateLimitCounters()` job**, behind `CRON_SECRET`.
- **Drop-table feature**, now that V9b is answerable — and a natural first
  consumer of `ItemIcon`.
- **Deployment.** Blocked on **V13** more than on code. Note the migration is
  applied locally only.
- **~~Branch protection~~ — blocked, and now with one option fewer.** The API
  returns **403, "Upgrade to GitHub Pro or make this repository public"**. On a
  private repo on the free plan there is no branch protection and no rulesets.
  **"Make it public" is off the table** as of ADR-0022 — the repo now contains
  4,645 Jagex item icons, and publishing them as a downloadable archive is a
  materially different act from a site displaying them. So: **pay for Pro, or
  accept that CI reports rather than blocks.** Decide which.

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
  `image-rendering: pixelated` cannot undo a resampled source. Vercel also bills
  optimisation per source image. There is now no `<img>` at all — the atlas is a
  background offset — and `next.config.ts` deliberately has **no
  `images.remotePatterns`**: a remote pattern turns `/_next/image?url=…` into a
  fetch-and-serve endpoint on our origin that anyone can drive, which is both an
  open proxy and hotlinking the wiki through us. Don't add one back.
- **A packed PNG is far smaller than the sum of its parts.** 2.29 MB of loose
  icons became 0.81 MB in one sheet. If you ever estimate a sprite sheet's size
  by adding up files, you will be ~3× too pessimistic and may reject the right
  option — as ADR-0021 nearly did.
- **The item mapping contains a non-item.** Id **34035** is named `Placeholder`
  and its icon is a 1×1 fully transparent PNG. It was in the first manifest, so
  `hasItemIcon()` answered true for something that renders nothing. The packer
  drops blank artwork now — but the lesson generalises: the mapping is a feed,
  not a curated list.
- **`shape-rendering: crispEdges` and `image-rendering: pixelated` are not
  interchangeable.** The first is SVG-only and does nothing to a raster; the
  second does nothing to an SVG. `Icon` (SVG) needs one, `ItemIcon` the other.
- **The icon set is GE-tradeables only**, and this is the trap most likely to
  bite next. No coins, no clue scrolls, no quest capes, no diary rewards, no
  skill icons — the generator reads the price mapping, and untradeables are
  simply not in it. Check `hasItemIcon()` before committing to an id, and assert
  it in a test the way `tools.test.ts` does.
- **Throttle with a shared cursor, not a per-worker sleep.** `await sleep(delay)`
  inside N workers gives N× the intended rate — the classic way a "throttled"
  scraper turns out not to be.
- **A generated TS file fails `format:check` until `npm run format` runs.**
  Generated datasets are Prettier-formatted in this repo; the script prints the
  reminder.
- **~~`ItemIcon.test.tsx`'s disk guards are `it.runIf` and skipping.~~ Done.**
  They are unconditional now, in `item-icons.atlas.test.ts`, and they read the
  committed pixels rather than the filesystem. The only skips in the suite are
  the five Postgres live tests, which run in CI against the service container.
- **The icon manifest's order is the atlas index.** `ITEM_ICON_IDS[i]` occupies
  cell `i`. Editing, sorting or filtering that array without `npm run icons:pack`
  repoints every icon after the edit at the wrong item — and it renders as
  _artwork_, not as an error, which is why the atlas test scans actual pixels.

**Carried over, still true:**

- **`drizzle-kit` does not read `.env.local`** — a Next.js convention, not a Node
  one. Presents as `url: undefined`.
- **PowerShell 5.1's `Get-Content` defaults to ANSI**, silently corrupting
  em-dashes in `.tsx` past typecheck, lint _and_ Prettier. **Use the editor, not
  shell text substitution, on source files.** Its quote mangling also breaks
  `git commit -m`; write the message to a file and use `git commit -F`.
- **`.prettierignore` hides `.claude/worktrees/`**, so a root-run Prettier check
  against a worktree path silently checks _nothing_ and prints success.
- **Item art cannot be tinted, ever** — state lives on the container. Glyphs
  (`Icon`) are `currentColor` and can. Never put one beside the other at the
  same size.
- **Item icons need the inventory slot on dark.** The near-black outline is
  ~1.1:1 on a near-black surface. `--sprite-slot` is still its token name, which
  now outlives the sprites — deliberate, see ADR-0023.
- **ADRs are point-in-time.** ADR-0008 still names `--osrs-slate-900`; ADR-0020
  still describes a `Sprite` component that no longer exists, with forward
  pointers to ADR-0021 and ADR-0023 rather than an edit.
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

And a third, added when the atlas landed: **an estimate built by summing parts
is not a measurement.** ADR-0021 priced the atlas at ~2 MB by adding up 4,646
files and, on that number, wrote the objection that nearly ruled it out. The
real figure is 0.81 MB, because the thing being estimated — shared compression —
is precisely what disappears when you treat a whole as the sum of its pieces.
The reason this belongs beside the 36×32 lesson is that they are the same error
in opposite directions: one trusted a sample as a ceiling, the other trusted
arithmetic as a substitute for trying it. **Both were settled in under a minute
by actually running the thing.**

The cheapest guard this session bought was also the least clever: asserting that
every id the tool directory names has artwork. It cost four lines and
immediately caught two of them.
