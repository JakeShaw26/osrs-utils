# Handoff — 2026-08-02

Snapshot for picking this up cold. **Living context is [`CLAUDE.md`](./CLAUDE.md)** —
read that first; this file covers what just happened and what to do next.

This replaces the 2026-08-01 handoff, whose first instruction was "wire
`ItemIcon` into economy". That is done, and it was a small session — the atlas
built the day before did what it was supposed to do, which is the point.

> ## ✅ Resume point: item art is in a real data-bearing route. Start on layout.
>
> **`ItemIcon` renders in all three economy organisms** — `ItemPriceTable`,
> `AlchProfitTable`, `ItemOverview`. Display only: every call site already held
> `item.id`, so no new data, no new fetch, no upstream cost. 1,141 passing,
> lint/typecheck/format/build clean.
>
> **Next: page-level layout and navigation.** It is now the only remaining
> ADR-0020 step and has been deferred across four handoffs. There is no global
> nav at all — every page is reached from the landing page or by URL.
> `app/layout.tsx` is nearly bare, so there is a clean place for a header, and
> `TOOL_GROUPS` is already the nav's data model. Full detail in
> [Next steps](#next-steps).
>
> **The branch is sorted and the work is in review.** The misnamed
> `docs/handoff-2026-07-31` was renamed to **`feat/item-icons`** and opened as
> **[PR #25](https://github.com/JakeShaw26/osrs-utils/pull/25)** — six commits,
> 47 files, three ADRs. **All four CI jobs pass**, including the `ci` gate.
>
> ⚠️ **Two things still outstanding on it.** The PR is **not merged** — start
> layout work on a fresh branch off `main` if it is still open, because a
> layout/navigation change should not stack on this one. And the old remote
> branch `origin/docs/handoff-2026-07-31` still exists, pointing at the same
> commits; deleting it was blocked by a permission rule, so it needs doing by
> hand (`git push origin --delete docs/handoff-2026-07-31`).
>
> **Green CI is not a gate here.** With branch protection unavailable, nothing
> stops a merge with red checks — waiting for green is a habit, not a guarantee.
> See the branch-protection item in [Next steps](#next-steps).

---

## Executive summary

One task, closed. Item icons now appear beside item names in the price table,
the alch table and the item detail header, which is what the atlas was built
for. The change is display-only — the organisms were already receiving item ids
they simply were not drawing.

| Changed                                 | What                                                              |
| --------------------------------------- | ----------------------------------------------------------------- |
| `organisms/economy/ItemPriceTable.tsx`  | Icon beside the name link in each row, `slotted`, decorative      |
| `organisms/economy/AlchProfitTable.tsx` | Same                                                              |
| `organisms/economy/ItemOverview.tsx`    | `scale={2}` in the detail header, icon left of name and examine   |
| Their three test files                  | +8 tests: the offset tracks the row's id, decorative, gap ids     |
| `CLAUDE.md`                             | Dropped the completed task; recorded where `ItemIcon` now renders |

No ADR. Nothing architectural was decided — ADR-0021 and ADR-0022 already
settled how item art works, and this session only used it.

---

## The two decisions inside it

Both are small, both are the kind of thing that reads as arbitrary later.

- **`slotted` in tables, not just on the landing page.** The rows sit directly
  on the page surface, which is near-black in dark mode, and an item icon's
  near-black outline is ~1.1:1 against it. ADR-0008 rules out a `dark:` variant
  in a component, so the choice is the slot in **both** themes or in neither.
  It reads as a subtle parchment well in light and as OSRS's own brown
  inventory slot in dark — checked in both, not reasoned about in one.
- **No `name` on any of them.** The link or heading beside each icon already
  prints the item name, so a named icon announces "Abyssal whip Abyssal whip".
  This is the case `ItemIcon`'s "is decorative when it has no name" test pins,
  and it is now exercised by a real caller rather than only by the atom's own
  test.

The three organisms are still Server Components, and no `"use client"` file
imports them — so the ~28 KB icon manifest stays out of the browser bundle.
That was checked rather than assumed, and it is worth re-checking if one of
these tables ever grows a sort control.

---

## What the measurement found

**The tradeables-only trap is narrower than the last handoff implied, and its
real shape is more useful.** The previous handoff warned that
`/economy/items/[id]` "takes an id from the URL and will meet ids with no
artwork". That is true only in a way that matters less than it sounds:

- **The route only serves ids in the price mapping.** `/economy/items/995`
  (Coins) returns **404**, not an empty icon — the route cannot reach an
  untradeable at all. The first version of the new test used 995 and passed
  while describing a state the app has no route to.
- **The real gap is exactly five ids**, checked against the live mapping and the
  committed manifest: `Crystal 2h axe` (28220), `Crystal 2h axe (inactive)`
  (28223), `Trinket of vengeance (1)` (33431), `Trinket of vengeance (2)`
  (33428), and `Placeholder` (34035, the packer drops it). The first four are
  the documented "mapping names an icon file that 404s" case.
- **`/economy/items/28220` is the reachable one**, and it was looked at: the
  empty slot with its `?` reads as deliberate rather than as a failed load.

So the tradeables-only warning still stands for **drop tables and clue rewards**,
where ids arrive from data that is not the price mapping. It does not really
apply inside economy, which is fed by the same mapping the packer reads.

---

## Next steps

### 1. Page-level layout and navigation — start here

The last ADR-0020 step, and now the only one. Deferred across four handoffs,
which is itself a signal: it is the largest and least reversible piece left in
the redesign, and it gets skipped because every session finds something smaller
that is genuinely useful. There is nothing smaller left in the redesign.

What already exists, so the directory does not need reinventing:

- **`TOOL_GROUPS` in `lib/navigation/tools.ts` is the nav's data model.** It
  carries a heading, an href and an item id per group, and its test fails on
  both a dead link and an unadvertised route.
- **`app/layout.tsx` is nearly bare** — the `SpriteSheet` that used to sit in it
  is gone. Clean place for a header. Note it provides **no `<main>`**; every
  page renders its own, so a header must not assume one.
- **`Icon` is tier two and tints with `currentColor`** — that is the one to use
  for chrome (menu, close, chevron). `ItemIcon` is fixed-palette art and must
  never sit beside a glyph at the same size (ADR-0020).
- **`ThemeToggle` currently lives on the landing page** and is the app's only
  client component. A global header is where it belongs; moving it is part of
  this task, not a follow-up.

Two things to get right: the mobile breakpoint (the tables already scroll inside
their own containers, so the header must not reintroduce page-level horizontal
scroll — 390px is the check), and keeping `"use client"` on the smallest leaf, so
a nav with a mobile toggle does not drag the whole layout into the bundle.

### 2. Marble texture

Needs the layout first. Never behind data.

### Then — Phase B's menu, unchanged and still unblocked

- **Roster page.** Still the highest-value thing not built: `sortByRank` /
  `groupByRank` over the WOM group, surfacing `player.updatedAt` so staleness is
  visible rather than implied. `wom-group.ts` and `ranks.ts` are tested and have
  no caller.
- **`pruneRateLimitCounters()` job**, behind `CRON_SECRET`.
- **Drop-table feature**, now that V9b is answerable — and the place where the
  tradeables-only icon gap actually bites, unlike economy.
- **Deployment.** Blocked on **V13** more than on code. The migration is applied
  locally only, so `enforceRateLimit()` fails open anywhere else — safe, but not
  rate limiting.
- **~~Branch protection~~ — still blocked, still one option short, and now with
  a live example.** The API returns **403, "Upgrade to GitHub Pro or make this
  repository public"**. "Make it public" is off the table as of ADR-0022 (4,645
  Jagex icons are in git history). So: **pay for Pro, or accept that CI reports
  rather than blocks.** Undecided since 2026-07-31.

  PR #25 is what that costs in practice: four green jobs, and nothing at all
  preventing a merge had they been red. The decision is two minutes of thought
  and keeps being deferred because the failure it prevents has not happened yet.

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

- **`/economy/items/[id]` 404s for an id outside the price mapping.** It is not
  an open lookup over every item id in the game. That is why a "no artwork"
  fixture using Coins tested nothing.
- **Exactly five mapping ids have no packed artwork**, and four of them are the
  404-ing icon files. `28220` is the one to reach for when you need a real gap.
- **`slotted` is a both-themes decision, never a dark-mode one.** ADR-0008 rules
  out `dark:` in a component, so there is no way to slot in dark only. Decide it
  once, look at both.
- **A 36px icon makes table rows ~52px.** That was checked against the `.tabular`
  columns and at 390px; it is fine, but any future change to `TableCell` padding
  should be looked at rather than reasoned about.

**Carried over, still true:**

- **The icon manifest's order is the atlas index.** `ITEM_ICON_IDS[i]` occupies
  cell `i`. Editing, sorting or filtering that array without `npm run icons:pack`
  repoints every icon after the edit at the wrong item — and it renders as
  _artwork_, not as an error.
- **The icon set is GE-tradeables only.** No coins, no clue scrolls, no quest
  capes, no diary rewards. Check `hasItemIcon()` before committing to an id in a
  feature fed by anything other than the price mapping.
- **`/mapping`'s `icon` field is authoritative; the item name is not** — 294 of
  4,650 differ.
- **`next/image` is wrong for pixel art**, and `next.config.ts` deliberately has
  no `images.remotePatterns` — one turns `/_next/image?url=…` into an open proxy
  on our origin. Don't add one back.
- **`drizzle-kit` does not read `.env.local`** — presents as `url: undefined`.
- **PowerShell 5.1's `Get-Content` defaults to ANSI**, silently corrupting
  em-dashes in `.tsx` past typecheck, lint _and_ Prettier. **Use the editor, not
  shell text substitution, on source files.** Its quote mangling also breaks
  `git commit -m`; write the message to a file and use `git commit -F`.
- **`.prettierignore` hides `.claude/worktrees/`**, so a root-run Prettier check
  against a worktree path silently checks _nothing_ and prints success.
- **Item art cannot be tinted, ever** — state lives on the container. Glyphs
  (`Icon`) are `currentColor` and can. Never put one beside the other at the
  same size.
- **ADRs are point-in-time.** ADR-0008 still names `--osrs-slate-900`; ADR-0020
  still describes a `Sprite` component that no longer exists.
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

The recent handoffs have circled one lesson — a measurement beats an assumption,
a rendered page beats a passing test. This session added the failure mode that
sits underneath all of them: **a test can pin a state the app cannot reach.**

The first version of the "item with no artwork" test used Coins, id 995. It
passed. It was also describing something that cannot happen, because
`/economy/items/995` is a 404 — the route only serves ids from the price
mapping. Nothing was wrong with the assertion; the fixture was wrong about the
world. Had it stayed, the codebase would have carried a green test claiming
coverage of a path that does not exist, while the five ids that _do_ hit that
path went unexercised.

The tell was cheap and worth reusing: the fixture was invented rather than
found. Coins were picked because they are a memorable untradeable, not because
anything demonstrated the app could reach them. Five minutes checking the live
mapping against the committed manifest produced the real list — five ids, four
of them the documented 404 case — and the test now uses one of those. **An edge
case worth a test is one the app can actually reach; if you cannot name the URL
that gets there, the fixture is a guess wearing a test's clothes.**
