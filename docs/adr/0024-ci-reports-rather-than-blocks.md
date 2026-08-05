# ADR-0024: CI reports rather than blocks; `main` is unprotected

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** Repository owner (the call — it is a spending decision), AI agent
  (the measurement and the record)

## Context

The CI workflow was built to be gated. Four jobs — `quality`, `test`, `build` —
run in parallel and a `ci` job requires all three, specifically so that **branch
protection could require `ci` alone** and any job added later would be covered
the moment it joined `needs`. That design assumed a gate existed to attach it to.

It does not, and the reason is a plan restriction rather than a configuration
mistake. Measured against the live API on 2026-08-05:

```
GET repos/JakeShaw26/osrs-utils/branches/main/protection  → 403
GET repos/JakeShaw26/osrs-utils/rulesets                  → 403
    "Upgrade to GitHub Pro or make this repository public to enable this feature."
```

Both endpoints are gated, which is the part worth recording. **Rulesets are
GitHub's modern replacement for classic branch protection and would have been
the natural fallback — they are behind the same paywall.** There is no free
mechanism to make a check required on a private repository.

The escape hatch named in the error message is closed on our side.
[ADR-0022](./0022-item-icon-delivery-packed-atlas.md) put ~4,645 Jagex item
icons into git history, so "make this repository public" is no longer a
configuration change — it is a publication of third-party artwork, and the whole
"tolerated ≠ licensed" bet in [ADR-0011](./0011-third-party-api-compliance.md)
depends on not doing that at scale.

What is actually at risk is small, and that is why this resolves the way it
does:

- **One contributor.** There is no second developer whose merge needs policing,
  and no untrusted fork traffic — the repo is private.
- **Nothing is deployed.** Hosting is still deferred on **V13**
  ([ADR-0006](./0006-hosting-tier-and-scheduled-jobs.md)), so a red commit on
  `main` today reaches no user. That is the strongest argument here, and it is
  also the one with an expiry date.
- **The habit already holds.** PR #25 was merged with four green checks. Waiting
  for green has been practice across every PR so far; what is missing is
  enforcement, not intent.

This has been undecided since 2026-07-31 and deferred across four handoffs.

## Decision

**We will accept CI as reporting-only, and leave `main` unprotected.** We will
not pay for GitHub Pro, and we will not make the repository public to obtain the
feature.

Concretely:

1. **The `ci` gate job stays exactly as it is.** Its value does not depend on
   being required — it collapses four results into the one status a human reads
   before clicking merge, and it keeps working the day a gate becomes available.
   Do not simplify it away on the grounds that nothing enforces it.
2. **Green `ci` before merge is a rule we keep by hand.** `gh pr checks <n>`
   before `gh pr merge`. A merge with a red or pending `ci` is a defect, not a
   judgement call.
3. **Work continues on branches and PRs**, never by committing to `main`
   directly. The PR is now the only place the checks are visible at all, which
   makes it more load-bearing than it was, not less.
4. **This is recorded as a known gap, not a solved problem.** Anyone reading the
   CI section of `CLAUDE.md` must find out that the gate is advisory there,
   rather than by discovering that a red merge went through.

## Consequences

### Good

- **No spend, and no publication of Jagex artwork.** The two costs we were
  actually weighing are both avoided.
- **The decision stops consuming attention.** It has been reopened in four
  consecutive handoffs at a few minutes each; that is now more than the decision
  is worth.
- **The CI design is validated rather than wasted.** The `ci` gate remains the
  single check to look at, and the day the repo moves host or plan, enforcement
  is one setting — no workflow change.

### Bad

- **Nothing mechanically prevents a red merge, and this is the real cost.** CI
  becomes a smoke alarm nobody is obliged to answer. The failure mode is not a
  dramatic one — it is a tired session merging on a glance, and `main` carrying
  a broken build until the next person notices.
- **`main` can also be force-pushed or committed to directly.** Branch
  protection was never only about checks; losing it loses linear-history and
  no-force-push guarantees too. The squash-merge convention that keeps `main`'s
  history readable is now purely conventional.
- **The risk grows silently with deployment.** Every argument above rests on
  "nothing is deployed yet". The moment `main` builds something users load, an
  unenforced check is protecting a live site, and this ADR will be quietly
  wrong before anyone re-reads it. That is why the V13 trigger below is the one
  that matters.
- **It puts weight on an AI agent's discipline.** Sessions like this one merge
  PRs. A human developer merging red at least remembers doing it; an agent that
  skips the check has no memory of the omission at all.

### Neutral

- **`src/test/ci-workflow.test.ts` is unaffected.** It asserts the `check`
  script and the workflow cannot drift, which is a test in our suite, not a
  GitHub setting — it keeps working exactly as before.
- Follow-on: the CI section of `CLAUDE.md` gains a line saying the gate is
  advisory, and `HANDOFF.md` loses the recurring open item.

## Alternatives considered

| Alternative                                           | Why not chosen                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pay for GitHub Pro (~$4/month)**                    | **The genuinely close one.** It is the smallest sum in the project and it buys the exact feature. Rejected because a hobby tool for one 78-member clan does not yet justify a standing subscription, and nothing is deployed. **This wins the moment the app is live** — see Revisit if.                                                            |
| **Make the repository public**                        | Foreclosed by ADR-0022, not merely undesirable. Publishing 4,645 Jagex icons is the opposite of the low-profile, non-commercial posture ADR-0011 relies on. Never trade artwork exposure for a CI setting.                                                                                                                                          |
| **Scrub the icons from history, then go public**      | Would restore the free option. Rejected on cost and blast radius: `git-filter-repo` over ten atlas sheets rewrites every SHA, breaks the recovery pointers ADRs rely on (`5202810` for the deleted auth module, `77e990f` for the sprites), and the artwork would still have to be fetched at build time — ADR-0022 exists precisely to avoid that. |
| **Move the repo to GitLab or Codeberg**               | Both offer protected branches free on private repos, so this genuinely solves it. Rejected on scope: it means porting GitHub Actions, Dependabot config and the pinned-SHA discipline for one setting, and the deployment host is still undecided (V13). Reconsider only if we are migrating anyway.                                                |
| **A local `pre-push` hook that runs `npm run check`** | Cheap, and worth having for other reasons. Rejected as a substitute: it protects the push, not the merge — PRs are merged server-side through the GitHub UI or `gh`, which no local hook can see. It would create a false sense of enforcement, which is worse than none.                                                                           |
| **Require review approvals instead**                  | Same 403. Also meaningless with one contributor.                                                                                                                                                                                                                                                                                                    |

## Revisit if

- **The app is deployed anywhere users can reach** (resolves V13). This is the
  trigger that should flip the decision to paying for Pro; every justification
  above depends on `main` being inert.
- **A second contributor gets write access.** The "one trusted contributor"
  premise is the load-bearing one, and it disappears the moment it is false.
- **A red merge actually happens.** One is data, not bad luck. Record it and
  buy the gate.
- **GitHub makes rulesets available on the free tier for private repos**, which
  would make this free — re-run the two API calls above rather than assuming.
- **We migrate hosts for unrelated reasons.** Protected branches come free on
  several alternatives; take them if we are already moving.
