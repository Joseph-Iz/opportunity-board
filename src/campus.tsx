import { useMemo, useState } from 'react';
import { Award, CalendarDays, Check, Footprints, Info, Users } from 'lucide-react';
import campusListings from './campus-listings.json';
import listings from './listings.json';
import { campusScopeLabels, type CampusScope } from './campus-rules';
import { isDeadlineOpen } from './listing-rules';
import { type ChromeProps, formatLongDate, Masthead, OfficialLink, SiteFooter } from './site-chrome';

// The campus edition is a preview of Callboard for a university department: campus and Utah
// opportunities shown beside the national board, each with a plain first step. It is a demo
// built from public official pages, and says so on the page.

type CampusEntry = (typeof campusListings)[number];

// One shape for every card, whether it came from campus-listings.json or the national board.
type Row = {
  name: string;
  scope: CampusScope;
  kind: string;
  deadline: string;
  award: string;
  eligibility: string;
  firstStep: string;
  feeLabel: string | null;
  feeDetail: string;
  link: string;
  verified: string;
  note: string;
  caveat: string;
};

const scopeFilters: ('all' | CampusScope)[] = ['all', 'campus', 'utah', 'national'];
const MONTHS_SHOWN = 6;

const fromCampus = (item: CampusEntry): Row => ({
  name: item.name,
  scope: item.scope as CampusScope,
  kind: item.kind,
  deadline: item.deadline,
  award: item.award,
  eligibility: item.eligibility,
  firstStep: item.firstStep,
  // "No fee" is only claimed when the official page says so in words.
  feeLabel: item.feeStated ? 'No fee' : null,
  feeDetail: item.feeStated ? 'No fee, per the official page.' : 'None listed on the official page.',
  link: item.link,
  verified: item.verified,
  note: item.note,
  caveat: item.caveat,
});

const fromNational = (item: (typeof listings)[number]): Row => ({
  name: item.name,
  scope: 'national',
  kind: item.type,
  deadline: item.deadline,
  award: item.award,
  eligibility: item.eligibility,
  firstStep: '',
  feeLabel: item.feeCondition ? 'Free with limits' : 'No fee',
  feeDetail: item.feeCondition || 'No fee',
  link: item.link,
  verified: item.verified,
  note: item.note,
  caveat: 'disclaimer' in item && typeof item.disclaimer === 'string' ? item.disclaimer : '',
});

const shortDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', timeZone: 'UTC',
});

function daysUntil(deadline: string, today: Date) {
  const [year, month, day] = deadline.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Calendar midnights avoid daylight-saving changes turning a full day into 23 or 25 hours.
  return Math.round((due.getTime() - current.getTime()) / 86400000);
}

function ScopeBadge({ scope }: { scope: CampusScope }) {
  return <span className={`scope-badge scope-${scope}`}>{campusScopeLabels[scope]}</span>;
}

export function CampusEdition({ chrome }: { chrome: ChromeProps }) {
  const [scope, setScope] = useState<'all' | CampusScope>('all');

  const today = new Date();
  // Use the visitor's local calendar day so a deadline does not shift because of UTC conversion.
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const openRows = useMemo(() => [
    ...campusListings.filter((item) => item.status === 'open' && isDeadlineOpen(item.deadline, todayKey)).map(fromCampus),
    ...listings.filter((item) => isDeadlineOpen(item.deadline, todayKey)).map(fromNational),
  ].sort((a, b) => {
    if (a.deadline === 'rolling') return b.deadline === 'rolling' ? 0 : 1;
    if (b.deadline === 'rolling') return -1;
    return a.deadline.localeCompare(b.deadline);
  }), [todayKey]);
  const comingUp = useMemo(() => campusListings.filter((item) => item.status === 'coming-up').map(fromCampus), []);
  const timings = useMemo(() => new Map(campusListings.map((item) => [item.name, item.timing])), []);
  const leftOff = useMemo(() => campusListings.filter((item) => item.status === 'left-off'), []);

  const visibleRows = openRows.filter((row) => scope === 'all' || row.scope === scope);
  const datedRows = openRows.filter((row) => row.deadline !== 'rolling');
  const closingSoon = datedRows.filter((row) => daysUntil(row.deadline, today) <= 30).length;
  const localCount = openRows.filter((row) => row.scope !== 'national').length + comingUp.length;
  const lastChecked = [...campusListings, ...listings].reduce((latest, item) => item.verified > latest ? item.verified : latest, '');

  // The next six calendar months, each with the dated deadlines that fall in it.
  const months = Array.from({ length: MONTHS_SHOWN }, (_, offset) => {
    const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const key = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: first.toLocaleDateString('en-US', { month: 'long' }),
      year: first.getFullYear(),
      rows: datedRows.filter((row) => row.deadline.startsWith(key)),
    };
  });
  const laterCount = datedRows.filter((row) => row.deadline.slice(0, 7) > months[MONTHS_SHOWN - 1].key).length;

  return (
    <main className="quiet-page">
      <div className="page-shell">
        <Masthead {...chrome} updated={lastChecked} />

        <section className="campus-hero" aria-labelledby="campus-title">
          <div className="campus-hero-copy">
            <p className="campus-eyebrow">Campus edition <span>Preview</span></p>
            <h1 id="campus-title">The University of Utah, on one board.</h1>
            <p className="campus-lede">Campus, Utah and national opportunities for student writers and artists in one place. Every listing is checked by a person against the official page, and each campus call comes with a first step.</p>
            <p className="campus-disclaimer">
              <Info size={15} aria-hidden="true" />
              <span>This is a preview built by Callboard from public pages. It is not affiliated with or endorsed by the University of Utah.</span>
            </p>
          </div>
          <dl className="campus-stats">
            <div><dt>Open now</dt><dd data-testid="stat-open">{openRows.length}</dd></div>
            <div><dt>Closing within 30 days</dt><dd>{closingSoon}</dd></div>
            <div><dt>Campus and Utah calls tracked</dt><dd>{localCount}</dd></div>
            <div><dt>Last checked</dt><dd className="campus-stat-date">{formatLongDate(lastChecked)}</dd></div>
          </dl>
        </section>

        <section className="campus-calendar" aria-labelledby="calendar-title">
          <div className="campus-heading">
            <h2 id="calendar-title">The semester at a glance</h2>
            <p>Every dated deadline for the next six months. Rolling calls are in the list below.</p>
          </div>
          <ol className="month-strip">
            {months.map((month) => (
              <li key={month.key} className={`month-column ${month.rows.length ? '' : 'is-empty'}`}>
                <h3>{month.label} <span>{month.year}</span></h3>
                {month.rows.length ? (
                  <ul>
                    {month.rows.map((row) => (
                      <li key={row.name} className={`month-item scope-${row.scope}`}>
                        <span className="month-day">{shortDate(row.deadline)}</span>
                        <span className="month-name">{row.name}</span>
                        <span className="month-scope">{campusScopeLabels[row.scope]}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="month-empty">Nothing dated yet</p>
                )}
              </li>
            ))}
          </ol>
          {laterCount > 0 && <p className="calendar-later">{laterCount} more {laterCount === 1 ? 'deadline falls' : 'deadlines fall'} after this window.</p>}
        </section>

        <section className="campus-open" aria-labelledby="campus-open-title">
          <div className="campus-heading">
            <h2 id="campus-open-title">Open now</h2>
            <p>Soonest deadline first.</p>
          </div>
          <div className="chip-row campus-scope-row" role="group" aria-label="Filter by where the opportunity comes from">
            {scopeFilters.map((value) => (
              <button
                key={value}
                type="button"
                className={`filter-chip ${scope === value ? 'is-active' : ''}`}
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
                data-testid={`filter-scope-${value}`}
              >
                {value === 'all' ? 'All' : campusScopeLabels[value]}
                <span className="chip-count">{value === 'all' ? openRows.length : openRows.filter((row) => row.scope === value).length}</span>
              </button>
            ))}
          </div>
          {visibleRows.length ? (
            <div className="campus-grid">
              {visibleRows.map((row, index) => (
                <CampusCard key={row.name} row={row} index={index} days={row.deadline === 'rolling' ? null : daysUntil(row.deadline, today)} />
              ))}
            </div>
          ) : (
            <p className="campus-none" data-testid="status-no-campus-results">Nothing open in this group right now. Check “Coming up” below.</p>
          )}
        </section>

        <section className="campus-coming" aria-labelledby="campus-coming-title">
          <div className="campus-heading">
            <h2 id="campus-coming-title">Coming up</h2>
            <p>These run every year. Dates for the next round were not posted when we checked, so each card says what we know.</p>
          </div>
          <div className="campus-grid">
            {comingUp.map((row, index) => (
              <CampusCard key={row.name} row={row} index={index} days={null} timing={timings.get(row.name) ?? ''} />
            ))}
          </div>
        </section>

        {leftOff.length > 0 && (
          <section className="campus-leftoff" aria-labelledby="campus-leftoff-title">
            <div className="campus-heading">
              <h2 id="campus-leftoff-title">Left off on purpose</h2>
              <p>Calls that look like a fit but exclude enrolled students. We checked so you do not lose an evening to them.</p>
            </div>
            <ul className="leftoff-list">
              {leftOff.map((item, index) => (
                <li key={item.name}>
                  <div>
                    <strong>{item.name}</strong> <span className="leftoff-award">{item.award}</span>
                    <p>{item.eligibility}</p>
                  </div>
                  <div className="leftoff-foot">
                    <span className="verified"><Check size={14} /> Verified {shortDate(item.verified)}</span>
                    <OfficialLink link={item.link} name={item.name} testId={`link-leftoff-${index + 1}`} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="campus-adds" aria-labelledby="campus-adds-title">
          <div className="campus-heading">
            <h2 id="campus-adds-title">What a campus edition adds</h2>
          </div>
          <div className="adds-grid">
            <div className="adds-card">
              <strong>Local calls beside the national board</strong>
              <p>Department scholarships, campus journals and Utah competitions sit in the same list as national magazines and fellowships.</p>
            </div>
            <div className="adds-card">
              <strong>A first step for every campus call</strong>
              <p>Many campus awards need a mentor, a nomination or an endorsement. Each card says what to do first, in one sentence.</p>
            </div>
            <div className="adds-card">
              <strong>The same checks as the main board</strong>
              <p>A person reads the official page, the check date is shown, and anything unclear on that page is said plainly on the card.</p>
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}

function CampusCard({ row, index, days, timing = '' }: { row: Row; index: number; days: number | null; timing?: string }) {
  const comingUp = Boolean(timing);
  const deadlineText = row.deadline === 'rolling' ? 'Rolling' : row.deadline ? formatLongDate(row.deadline) : '';
  return (
    <article className={`campus-card scope-${row.scope}`} data-testid={`campus-card-${comingUp ? 'coming' : 'open'}-${index + 1}`}>
      <div className="campus-card-top">
        <ScopeBadge scope={row.scope} />
        <span className="type-tag">{row.kind}</span>
        {row.feeLabel && <span className="sticker sticker-free">{row.feeLabel}</span>}
        {days !== null && days <= 30 && <span className="sticker sticker-days-left">{days <= 0 ? 'Closes today' : days === 1 ? '1 day left' : `${days} days left`}</span>}
      </div>
      <h3>{row.name}</h3>
      <p className="campus-note">{row.note}</p>
      <dl className="campus-facts">
        <div>
          <dt><CalendarDays size={15} aria-hidden="true" /> {comingUp ? 'Timing' : 'Deadline'}</dt>
          <dd>{comingUp ? timing : deadlineText}</dd>
        </div>
        <div>
          <dt><Award size={15} aria-hidden="true" /> What you get</dt>
          <dd>{row.award}</dd>
        </div>
        <div>
          <dt><Users size={15} aria-hidden="true" /> Who can apply</dt>
          <dd>{row.eligibility}</dd>
        </div>
      </dl>
      {row.firstStep && (
        <p className="first-step">
          <Footprints size={16} aria-hidden="true" />
          <span><strong>First step:</strong> {row.firstStep}</span>
        </p>
      )}
      {row.caveat && (
        <p className="listing-disclaimer">
          <Info size={14} aria-hidden="true" />
          <span><span className="sr-only">Note: </span>{row.caveat}</span>
        </p>
      )}
      <p className="campus-fee">Application fee: {row.feeDetail}</p>
      <div className="campus-card-foot">
        <span className="verified"><Check size={14} /> Verified {shortDate(row.verified)}</span>
        <OfficialLink link={row.link} name={row.name} testId={`link-campus-${comingUp ? 'coming' : 'open'}-${index + 1}`} />
      </div>
    </article>
  );
}
