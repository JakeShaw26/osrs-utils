import type { Metadata } from 'next';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';

export const metadata: Metadata = {
  title: 'Collection log — not available',
  description:
    'Why per-player collection log data is not shown, and what would have to change first.',
};

/**
 * PAGE — a deliberate non-feature.
 *
 * Nothing is fetched and nothing is stubbed. The only viable source of
 * per-player collection log data is TempleOSRS, whose terms we have **not
 * read** — their documentation returns HTTP 403 to automated fetching (open
 * question V2, docs/api-terms.md §4). The binding rule is "when terms are
 * unread or unclear, do not proceed on assumption", so this page exists to say
 * that out loud rather than to ship a placeholder that implies the feature is
 * merely unfinished.
 *
 * Writing this down beats leaving the route absent: the next person to pick the
 * feature up finds the blocker instead of rediscovering the 403.
 */
export default function CollectionLogPage() {
  return (
    <CalculatorLayout
      title="Collection log"
      description="We are not showing collection log data, and this page explains why rather than pretending it is coming soon."
      notes={
        <p>
          Tracked as open question <strong>V2</strong> in the PRD and in{' '}
          <code>docs/api-terms.md</code> §4.
        </p>
      }
    >
      <div className="space-y-4 text-sm text-content-muted">
        <section aria-labelledby="cl-blocked">
          <h2 id="cl-blocked" className="text-base font-semibold text-content">
            The blocker is legal, not technical
          </h2>
          <p className="mt-2">
            A player&rsquo;s collection log is not in the Jagex hiscores. The only public
            source is <strong>TempleOSRS</strong>, and we have not read their API terms —
            their documentation page returns <span className="tabular">403</span> to
            automated requests. This project&rsquo;s rule is that unread terms are a stop,
            not a shrug: we do not build against a source on the assumption that it will
            turn out to be allowed.
          </p>
          <p className="mt-2">
            Working around the 403 would be the wrong move twice over — it would evade a
            block someone deliberately put there, and it still would not tell us what the
            terms say.
          </p>
        </section>

        <section aria-labelledby="cl-partial">
          <h2 id="cl-partial" className="text-base font-semibold text-content">
            Even unblocked, the data would be partial
          </h2>
          <p className="mt-2">
            TempleOSRS data is opt-in and plugin-sourced, so it covers only members who
            have synced. Any clan-wide percentage would quietly count everyone else as
            zero. If this is ever built it has to show per-member sync freshness and mark
            unsynced members explicitly.
          </p>
        </section>

        <section aria-labelledby="cl-nonaggregate">
          <h2 id="cl-nonaggregate" className="text-base font-semibold text-content">
            There will be no clan completion percentage
          </h2>
          <p className="mt-2">
            Combat Achievements and diaries are self-declared and live in each
            member&rsquo;s own browser, so they cannot be aggregated at all. Blending them
            with verified data into one clan figure would be unverifiable, trivially
            gameable and misleading in a single number — so it is ruled out rather than
            deferred.
          </p>
        </section>

        <section aria-labelledby="cl-next">
          <h2 id="cl-next" className="text-base font-semibold text-content">
            What would unblock it
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              A human reads the TempleOSRS terms in a browser and records what they
              actually permit.
            </li>
            <li>
              If they permit read-only, non-commercial, cached use, a scheduled job
              pre-aggregates the clan&rsquo;s synced members — never a per-visitor fetch.
            </li>
            <li>
              Failing that, the OSRS Wiki does expose a <code>collection_log_source</code>{' '}
              bucket, which describes{' '}
              <em>which items are in the log and where they drop</em>. That is a genuine
              browsable reference, and it needs no third-party terms. It says nothing
              about who has what.
            </li>
          </ol>
        </section>
      </div>
    </CalculatorLayout>
  );
}
