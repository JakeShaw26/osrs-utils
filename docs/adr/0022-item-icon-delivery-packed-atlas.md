# ADR-0022: Item icons are delivered as ten packed atlas sheets

- **Status:** Accepted
- **Date:** 2026-08-01
- **Deciders:** Repository owner (the call to build it), AI agent (the mechanism)
- **Resolves:** [ADR-0021](./0021-osrs-item-icons-by-id.md) → _"Delivery is
  unresolved, and nothing ships until it is"_

## Context

ADR-0021 shipped `ItemIcon` and the generator, then gitignored the 4,646 PNGs on
the owner's call — 4k binaries is too much repo churn. That left the app with
icons on exactly one machine: a fresh checkout, CI, or any deploy rendered empty
cells everywhere, and two disk-coverage guards in `ItemIcon.test.tsx` skipped
because their subject was absent. Nothing could be wired up until this was
answered.

ADR-0021 named an atlas as the likely answer and estimated it at ~2 MB, with the
trade being "a whole-atlas download for a page showing three icons".

### What was measured, 2026-08-01

The estimate was wrong, in our favour, and the correction changes the shape of
the decision rather than just its price tag.

- **The full set packs to 0.81 MB, not ~2 MB.** The loose files total 2.29 MB
  because each of 4,646 PNGs carries its own header and its own zlib dictionary.
  One stream shares them. **[VERIFIED]**
- **Sharding is free.** Ten sheets of 512 icons total 0.80 MB against 0.81 MB for
  one sheet — 512 icons already saturate what the shared dictionary can win, so
  splitting costs nothing. **[VERIFIED]**
- **So the trade ADR-0021 weighed does not exist.** A page showing three icons
  pulls at most 3 × ~82 KB, not 829 KB, and a full price table pulls the same
  0.80 MB either way. **[VERIFIED]**
- **One sheet would also have been 2304×2628** — 6 megapixels, ~24 MB of RGBA in
  memory, to display a single whip. A 512-icon shard is 1152×576. **[VERIFIED]**
- **One mapping row has blank artwork.** Item **34035** is named `Placeholder`
  and its icon is a 1×1 fully transparent PNG. It was in the ADR-0021 manifest,
  so `hasItemIcon(34035)` answered true for something that renders nothing.
  **[VERIFIED]**
- **The widest icon really is 36×32**, matching the game's documented inventory
  cell, across all 4,645 packed icons. **[VERIFIED]**

## Decision

**Item icons ship as ten content-hashed PNG atlas sheets in
`public/item-icons/`, committed, addressed by offset from the manifest.**

1. **Two scripts, two jobs.** `generate-item-icons.mjs` downloads into the
   gitignored `.icon-cache/`; `pack-item-icons.mjs` packs that cache into sheets
   and writes the manifest. The download is slow, throttled and network-bound;
   packing is local and takes seconds. Separating them means a repack — after
   changing the cell, the shard size, or the packing order — never touches the
   wiki. `npm run icons` does both.
2. **The grid is fixed at 36px, 32 columns, 512 cells per sheet.** The cell is
   the game's inventory cell, **not** the measured maximum; the packer asserts
   every icon fits and fails the run loudly if one does not. ADR-0021's lesson
   holds — a sample is a lower bound, never a specification.
3. **An id's index in `ITEM_ICON_IDS` is its cell.** Sheet = `index / 512`, cell
   within it = `index % 512`. No separate offset map: a second list of 4,645
   coordinates would be one more thing to drift out of step.
4. **Sheet filenames carry a content hash** (`atlas-3-574195be.png`), and
   `next.config.ts` serves `/item-icons/*` as `immutable` for a year. The hash is
   what makes that safe — a changed sheet is a changed URL, so a cached sheet can
   never be stale against a fresh manifest.
5. **Blank artwork is dropped, not packed.** Fully transparent art is
   indistinguishable from a missing icon on screen, so it must be
   indistinguishable in the manifest. `hasItemIcon()` now means "there is
   something to show".
6. **`ItemIcon` renders a background offset**, not an `<img>`. Its accessible
   name moves to `role="img"` + `aria-label`, and is dropped along with the
   artwork for an id we have no icon for.
7. **The skipped guards become unconditional**, in a new
   `item-icons.atlas.test.ts`. They now read the committed pixels rather than the
   filesystem: sheet dimensions against the addressed grid, filename against
   content hash, ascending id order, and **every claimed cell contains at least
   one opaque pixel**.

## ⚠️ This puts Jagex artwork in the repository

ADR-0021 listed, under Good: _"Making the repo public stays cheap. Had the icons
been committed, the branch-protection option in HANDOFF.md would have turned into
publishing a Jagex art mirror."_

**That benefit is now spent.** The sheets are committed, so making this
repository public publishes ~4,645 Jagex item icons as a redistributable archive
— which is a materially different act from a website displaying them, and a
worse one under the "tolerated ≠ licensed" bet
([`api-terms.md`](../api-terms.md) §1) that ADR-0021 rests on.

This does not change the app's exposure, which was already public display
(ADR-0012). It changes **one option that was previously cheap**: the
branch-protection decision in [`HANDOFF.md`](../../HANDOFF.md) now reads _pay for
GitHub Pro, or accept that CI reports rather than blocks_. Going public should be
treated as foreclosed unless the icons come back out of git.

The trade was taken knowingly: delivery blocked every feature, and the
alternatives either hammered the wiki or waited on hosting (V13), which is still
open.

## Consequences

### Good

- **The app has icons everywhere** — fresh checkout, CI, any deploy. This is the
  entire point, and it unblocks the tool-group re-point and the economy wiring.
- **10 files, not 4,646.** The owner's objection is answered on its own terms.
- **A table of 200 items is one request, not 200**, and after the first page the
  sheets are served from cache with no revalidation at all.
- **Two guards that were skipping now run, and read pixels.** The failure mode
  here is art, not errors — an off-by-one in packing order renders the _next_
  item's icon, which looks entirely deliberate. Only pixels catch that.
- **The build never touches the wiki.** Hard rule and `api-terms.md` §2 intact.

### Bad

- **Jagex artwork is now in git history.** See the section above. Removing it
  later means rewriting history, not deleting a file.
- **Every regeneration rewrites all ten binaries.** Inserting one new item id
  shifts every icon after it into a different cell, so the diff is ~800 KB of
  undiffable blob on every game update. Expect a few per year.
- **`sharp` is now an explicit devDependency**, and a native module in the test
  path. It was already present transitively via Next, and CI installs prebuilt
  Linux binaries, but a suite that could previously run anywhere Node runs now
  depends on one that cannot.
- **The manifest and the sheets are one artefact in two halves**, and only one
  half is readable in review. The atlas test is the mitigation, not a fix.
- **`ItemIcon` can no longer lazy-load per icon.** `loading="lazy"` had meaning
  for 4,646 files and has none for a sheet — which is fine here, but it means a
  page showing one icon still fetches 82 KB.

### Neutral

- Non-integer scaling is still refused (`scale={1 | 2}`), for the same
  nearest-neighbour reason as before; the mechanism moved from `<img>` transform
  to cell transform and the constraint did not change.
- The manifest grew four constants and ten filenames. Still ~28 KB, still only
  reaching the client bundle if a Client Component imports it.

## Alternatives considered

| Alternative                            | Why not chosen                                                                                                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One sheet instead of ten**           | Simpler by one division. Rejected on measurement: identical total bytes, but 829 KB and a 24 MB decode to show three icons. Sharding cost 10 KB and one modulo.                                                                           |
| **Commit the 4,646 loose PNGs**        | ADR-0021's original choice, already rejected by the owner on repo churn. The atlas satisfies that objection without re-opening it.                                                                                                        |
| **Generate at build**                  | ~4,600 wiki requests per build. Ruled out by `api-terms.md` §2, and it makes every deploy depend on the wiki being up.                                                                                                                    |
| **Object storage at the host**         | The cleanest answer to the licensing point — artwork out of git entirely, served from a bucket. **Blocked on V13**, which has been open across three handoffs. Revisit when hosting is decided; the packer's output would move unchanged. |
| **Separate offset map (JSON)**         | Explicit rather than derived from the index. Rejected: a second list of 4,645 coordinates is a second thing to drift, and the derivation is two lines.                                                                                    |
| **CSS classes per item, generated**    | `background-position` in a stylesheet rather than inline. Rejected: 4,645 class rules is a ~200 KB stylesheet on every page to serve what an inline style does for the handful of icons actually rendered.                                |
| **SVG sprite sheet with `<use>`**      | What `Sprite` does, and it would unify the two tiers. Not possible — these are rasters, and wrapping each in `<image>` inside an SVG symbol is strictly worse than a background offset.                                                   |
| **Keep icons gitignored, cache in CI** | Rejected in ADR-0021 and still rejected: a cache miss silently ships a site with no icons, and "silently correct-looking" is the defect shape this project keeps being bitten by.                                                         |

## Revisit if

- **V13 resolves and the host has object storage** → moving the sheets out of git
  restores the "make the repo public" option and removes the artwork-in-history
  problem. This is the one change that would clearly improve the position.
- **Regeneration churn becomes annoying** → shard by id range with fixed
  boundaries instead of by count, so inserting an id rewrites one sheet rather
  than all ten. Costs some packing density.
- **A page ever shows icons from many scattered ids at once** (a drop table
  spanning the id space) → measure whether it pulls most of the ten sheets, and
  if so consider packing by usage frequency rather than by id.
- **`sharp` becomes a problem on CI** → the packer could emit PNGs by hand via
  `zlib`; we control the encoder's input, so the format is fully known.
