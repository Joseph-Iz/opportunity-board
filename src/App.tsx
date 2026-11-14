import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  Info,
  Moon,
  Share2,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import listings from './listings.json';
import { filterDisciplineLabels, filterTypeLabels, isDeadlineOpen, isRecentlyClosed, RECENTLY_CLOSED_DAYS, reportUrlFor, safeOfficialUrl } from './listing-rules';

type Listing = (typeof listings)[number];

const types = [...filterTypeLabels];
const disciplines = [...filterDisciplineLabels];
const classNameFor = (value: string) => value.toLowerCase().replaceAll(' ', '-');
const disciplineAccents: Record<string, string> = {
  Poetry: 'var(--plum)',
  Fiction: 'var(--coral)',
  Nonfiction: 'var(--sun)',
  Photography: 'var(--sky)',
  'Visual art': 'var(--mint)',
  Screenwriting: 'var(--indigo)',
  Playwriting: 'var(--berry)',
};
// Saved items stay on this device only; this key stores them in this browser's local storage.
const savedListingsStorageKey = 'callboard-saved-v1';
type ShareStatus = { name: string; status: 'copied' | 'error' } | null;

function readSavedListings() {
  // Browsing should still work when a browser blocks storage; only saved items are unavailable then.
  try {
    const raw = localStorage.getItem(savedListingsStorageKey);
    if (!raw) return new Set<string>();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((name): name is string => typeof name === 'string'))
      : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Some browsers block the Clipboard API, so use their older copy command as a fallback.
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  try {
    field.select();
    if (!document.execCommand('copy')) throw new Error('Clipboard access is unavailable.');
  } finally {
    field.remove();
  }
}

// Some listings are legitimate but carry a caveat worth showing (for example, who sponsors them).
// The field is optional, so most listings don't have it.
const disclaimerFor = (item: Listing): string | null =>
  'disclaimer' in item && typeof item.disclaimer === 'string' && item.disclaimer.trim() ? item.disclaimer : null;

function ListingDisclaimer({ item }: { item: Listing }) {
  const disclaimer = disclaimerFor(item);
  if (!disclaimer) return null;
  return (
    <p className="listing-disclaimer" data-testid="listing-disclaimer">
      <Info size={14} aria-hidden="true" />
      <span><span className="sr-only">Note: </span>{disclaimer}</span>
    </p>
  );
}

// Several calls are free only on one route: free by post but paid online, free for one genre but
// not another, free to submit but with a paid add-on. A plain "No fee" badge on those is accurate
// about the listed route and misleading about everything else, so the badge says which it is and
// the exact condition sits with the fee in the details panel.
function FeeSticker({ item, extraClass = '' }: { item: Listing; extraClass?: string }) {
  const conditional = Boolean(item.feeCondition);
  return (
    <span
      className={`sticker sticker-free ${conditional ? 'sticker-free-conditional ' : ''}${extraClass}`.trim()}
      title={item.feeCondition || undefined}
      data-testid={conditional ? 'sticker-fee-conditional' : 'sticker-fee-free'}
    >
      {conditional ? 'Free with limits' : 'No fee'}
      {conditional && <span className="sr-only">: {item.feeCondition}</span>}
    </span>
  );
}

// The deadline day itself still counts as open, so it reads "Closes today", not "0 days left".
function daysLeftText(days: number) {
  if (days <= 0) return 'Closes today';
  return days === 1 ? '1 day left' : `${days} days left`;
}

// "Verified Oct 18" reads faster than "Verified Oct 18, 2026" and fits on one line;
// the year is only shown when it isn't the current one.
function formatShortDate(date: string) {
  const sameYear = date.slice(0, 4) === String(new Date().getFullYear());
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC',
  });
}

const edgeStyleFor = (item: Listing) => ({
  '--edge-colors': item.discipline.map((discipline) => disciplineAccents[discipline]).join(', '),
}) as CSSProperties;

function Home() {
  const [activeType, setActiveType] = useState('All');
  const [activeDiscipline, setActiveDiscipline] = useState('All');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [savedListings, setSavedListings] = useState<Set<string>>(readSavedListings);
  const [shareStatus, setShareStatus] = useState<ShareStatus>(null);
  const [darkMode, setDarkMode] = useState(() => {
    // A visitor's own choice wins; until they make one, follow their device's light/dark setting.
    try {
      const stored = localStorage.getItem('callboard-theme');
      if (stored === 'dark' || stored === 'light') return stored === 'dark';
    } catch {
      // Storage is blocked; fall through to the device setting.
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    try {
      localStorage.setItem('callboard-theme', next ? 'dark' : 'light');
    } catch {
      // Keep the selected theme for this visit if storage is unavailable.
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(savedListingsStorageKey, JSON.stringify([...savedListings]));
    } catch (error) {
      console.warn('Saved opportunities could not be stored in this browser.', error);
    }
  }, [savedListings]);

  const today = new Date();
  // Use the visitor's local calendar day so a deadline does not shift because of UTC conversion.
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  // The ISO date strings sort in calendar order, so the header can use the newest verification date directly.
  const latestVerified = useMemo(
    () => listings.reduce((latest, item) => item.verified > latest ? item.verified : latest, ''),
    [],
  );
  const featureListings = useMemo(() => listings
    .filter((item) => item.deadline !== 'rolling' && isDeadlineOpen(item.deadline, todayKey))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 3), [todayKey]);
  const visibleListings = useMemo(() => listings
    .filter((item) => isDeadlineOpen(item.deadline, todayKey))
    .filter((item) => !showSaved || savedListings.has(item.name))
    .filter((item) => activeType === 'All' || item.type.toLowerCase() === activeType.toLowerCase())
    .filter((item) => activeDiscipline === 'All' || item.discipline.includes(activeDiscipline))
    .sort((a, b) => {
      if (a.deadline === 'rolling') return b.deadline === 'rolling' ? 0 : 1;
      if (b.deadline === 'rolling') return -1;
      return a.deadline.localeCompare(b.deadline);
    }), [activeType, activeDiscipline, savedListings, showSaved, todayKey]);
  // Closed calls are kept, not deleted: newest-closed first, for the last RECENTLY_CLOSED_DAYS days.
  const recentlyClosed = useMemo(() => listings
    .filter((item) => isRecentlyClosed(item.deadline, todayKey))
    .sort((a, b) => b.deadline.localeCompare(a.deadline)), [todayKey]);
  const activeFilterCount = Number(activeType !== 'All') + Number(activeDiscipline !== 'All') + Number(showSaved);

  const daysUntil = (deadline: string) => {
    const [year, month, day] = deadline.split('-').map(Number);
    const due = new Date(year, month - 1, day);
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    // Calendar midnights avoid daylight-saving changes turning a full day into 23 or 25 hours.
    return Math.round((due.getTime() - current.getTime()) / 86400000);
  };
  const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  const clearFilters = () => {
    setActiveType('All');
    setActiveDiscipline('All');
  };
  const clearAllBrowseFilters = () => {
    clearFilters();
    setShowSaved(false);
  };
  const toggleSavedListing = (name: string) => {
    setSavedListings((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const copyOfficialLink = async (item: Listing) => {
    try {
      const href = safeOfficialUrl(item.link);
      if (!href) throw new Error('This listing has no safe official link to copy.');
      await copyTextToClipboard(href);
      setShareStatus({ name: item.name, status: 'copied' });
    } catch (error) {
      console.warn('Could not copy the official opportunity link.', error);
      setShareStatus({ name: item.name, status: 'error' });
    }
    window.setTimeout(() => {
      setShareStatus((current) => current?.name === item.name ? null : current);
    }, 1800);
  };

  const shareAnnouncement = !shareStatus
    ? ''
    : shareStatus.status === 'copied'
      ? `Official link copied for ${shareStatus.name}.`
      : `Could not copy the official link for ${shareStatus.name}.`;

  return (
    <main className="quiet-page">
      {/* Read aloud by screen readers when a link is copied; invisible on screen. */}
      <p className="sr-only" role="status" aria-live="polite">{shareAnnouncement}</p>
      <div className="page-shell">
        <header className="masthead">
          <a className="wordmark" href="/" aria-label="Callboard home">
            <span className="wordmark-mark" aria-hidden="true">c<span>.</span></span>
            <span>Callboard</span>
          </a>
          <p className="header-promise">Good things for people who make things. Every call is free to apply and checked by a person.</p>
          <div className="header-actions">
            <span className="last-updated">Last updated <strong>{formatDate(latestVerified)}</strong></span>
            <a className="header-info icon-button" href="#how-this-list-is-kept" aria-label="How this list is kept" title="How this list is kept">
              <Info size={17} aria-hidden="true" />
            </a>
            <button
              className="theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`}
              aria-pressed={darkMode}
              data-testid="button-theme-toggle"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              <span>{darkMode ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>

        <section className="feature-section" aria-labelledby="feature-title">
          <div className="section-heading feature-heading">
            <div>
              <h1 id="feature-title">Closing soon</h1>
            </div>
            <span className="heading-doodle" aria-hidden="true">〰</span>
          </div>
          {featureListings.length ? (
            <div className="feature-grid">
              {featureListings.map((item, index) => (
                <FeatureCard
                  key={item.name}
                  item={item}
                  index={index}
                  days={daysUntil(item.deadline)}
                  formatDate={formatDate}
                  isSaved={savedListings.has(item.name)}
                  onToggleSaved={toggleSavedListing}
                  onCopyLink={copyOfficialLink}
                  copyStatus={shareStatus?.name === item.name ? shareStatus.status : 'idle'}
                />
              ))}
            </div>
          ) : (
            <div className="feature-empty">No dated calls on the horizon right now. The rolling ones are still open below.</div>
          )}
        </section>

        <section className="directory" aria-labelledby="directory-title">
          <div className="directory-heading">
            <div>
              <h2 id="directory-title">The opportunity shelf</h2>
            </div>
          </div>

          <button
            className="mobile-filter-toggle"
            type="button"
            aria-expanded={mobileFiltersOpen}
            aria-controls="opportunity-filters"
            onClick={() => setMobileFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
            <span>Filters</span>
            {activeFilterCount > 0 && <span className="filter-count-badge" aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</span>}
          </button>
          <div className={`filters ${mobileFiltersOpen ? 'is-open' : ''}`} id="opportunity-filters" role="group" aria-label="Filter opportunities">
            <FilterGroup label="Type" title="Filter by opportunity type" values={types} selected={activeType} onSelect={setActiveType} testPrefix="type" />
            <FilterGroup label="Discipline" title="Filter by discipline" values={disciplines} selected={activeDiscipline} onSelect={setActiveDiscipline} testPrefix="discipline" />
          </div>

          <div className="results-toolbar">
            <div className="results-bar" aria-live="polite">
              <p><strong>{visibleListings.length}</strong> {visibleListings.length === 1 ? 'opportunity' : 'opportunities'} to explore</p>
              {(activeType !== 'All' || activeDiscipline !== 'All') && (
                <span className="active-filter-note">{[activeType !== 'All' && activeType, activeDiscipline !== 'All' && activeDiscipline].filter(Boolean).join(' · ')}</span>
              )}
            </div>
            <div className="results-actions">
              <button className="clear-button" type="button" onClick={clearAllBrowseFilters} disabled={activeType === 'All' && activeDiscipline === 'All' && !showSaved} data-testid="button-clear-filters">
                <X size={14} /> Clear all
              </button>
              <button
                className={`saved-toggle ${showSaved ? 'is-active' : ''}`}
                type="button"
                aria-label={showSaved ? 'Show all opportunities' : 'Show saved opportunities'}
                aria-pressed={showSaved}
                title={showSaved ? 'Show all opportunities' : 'Show saved opportunities'}
                onClick={() => setShowSaved((current) => !current)}
              >
                <Bookmark size={15} aria-hidden="true" /> Saved
              </button>
              <span className="sort-note"><ArrowDownRight size={16} /> Soonest first</span>
            </div>
          </div>

          {visibleListings.length > 0 ? (
            <div className="listing-list">
              {visibleListings.map((item, index) => (
                <ListingCard
                  key={item.name}
                  item={item}
                  index={index}
                  days={item.deadline === 'rolling' ? null : daysUntil(item.deadline)}
                  formatDate={formatDate}
                  isSaved={savedListings.has(item.name)}
                  onToggleSaved={toggleSavedListing}
                  onCopyLink={copyOfficialLink}
                  copyStatus={shareStatus?.name === item.name ? shareStatus.status : 'idle'}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state" data-testid="status-no-results">
              <span className="empty-mark" aria-hidden="true">✳</span>
              <h3>{showSaved ? 'No saved opportunities yet.' : 'No matches in this little corner.'}</h3>
              <p>{showSaved ? 'Bookmark a listing to keep it here on this device.' : 'Try another type or discipline to see what’s open.'}</p>
              <button type="button" className="reset-filters" onClick={clearAllBrowseFilters}>Show everything</button>
            </div>
          )}
        </section>

        {recentlyClosed.length > 0 && (
          <details className="closed-section" data-testid="section-recently-closed">
            <summary>
              <span><strong>Recently closed</strong> ({recentlyClosed.length})</span>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <p className="closed-intro">These deadlines have passed. Many run every year, so the official page is the place to watch for the next round.</p>
            <ul className="closed-list">
              {recentlyClosed.map((item, index) => (
                <li key={item.name}>
                  <span className="closed-name">{item.name}</span>
                  <span className="closed-date">Closed {formatDate(item.deadline)}</span>
                  {safeOfficialUrl(item.link)
                    ? <a className="closed-link" href={safeOfficialUrl(item.link)!} target="_blank" rel="noopener noreferrer" data-testid={`link-closed-${index + 1}`}>Their page<span className="sr-only"> for {item.name} (opens in a new tab)</span> <ArrowUpRight size={14} aria-hidden="true" /></a>
                    : <span className="closed-link" data-testid={`link-closed-${index + 1}`}>Link unavailable</span>}
                </li>
              ))}
            </ul>
            <p className="closed-note">Shown for {RECENTLY_CLOSED_DAYS} days after closing. Details were last checked before the deadline and may have changed since.</p>
          </details>
        )}

        <TrustSection />

        <footer className="site-footer">
          <span className="footer-squiggle" aria-hidden="true">〰</span>
          <p>
            Always check the official page before submitting. Real opportunities never ask you to pay to be considered.{' '}
            <a className="footer-report" href={reportUrlFor()} target="_blank" rel="noopener noreferrer">Spot a problem? Report a listing<span className="sr-only"> (opens in a new tab)</span></a>
          </p>
          <span className="footer-squiggle" aria-hidden="true">〰</span>
        </footer>
      </div>
    </main>
  );
}

function FilterGroup({ label, title, values, selected, onSelect, testPrefix }: {
  label: string;
  title: string;
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
  testPrefix: string;
}) {
  return (
    <div className={`filter-group filter-${testPrefix}`}>
      <span className="filter-label">{label}</span>
      <div className="chip-row" role="group" aria-label={title}>
        {values.map((value) => (
          <button
            key={value}
            className={`filter-chip ${value === 'All' ? 'chip-all' : `discipline-${classNameFor(value)}`} ${selected === value ? 'is-active' : ''}`}
            type="button"
            onClick={() => onSelect(value)}
            aria-pressed={selected === value}
            data-testid={`filter-${testPrefix}-${classNameFor(value)}`}
          >{value}</button>
        ))}
      </div>
    </div>
  );
}

type CardActionProps = {
  isSaved: boolean;
  onToggleSaved: (name: string) => void;
  onCopyLink: (item: Listing) => void;
  copyStatus: 'idle' | 'copied' | 'error';
};

function ListingActionButtons({ item, isSaved, onToggleSaved, onCopyLink, copyStatus }: CardActionProps & { item: Listing }) {
  const saveLabel = isSaved ? `Remove ${item.name} from saved` : `Save ${item.name}`;
  const shareLabel = copyStatus === 'copied'
    ? `Official link copied for ${item.name}`
    : copyStatus === 'error'
      ? `Could not copy the official link for ${item.name}. Try again.`
      : `Copy the official link for ${item.name}`;

  return (
    <div className="listing-actions">
      <button
        className="icon-button card-icon-button"
        type="button"
        aria-label={saveLabel}
        aria-pressed={isSaved}
        title={saveLabel}
        onClick={() => onToggleSaved(item.name)}
      >
        <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
      <button
        className={`icon-button card-icon-button ${copyStatus === 'copied' ? 'is-copied' : ''}`}
        type="button"
        aria-label={shareLabel}
        title={shareLabel}
        onClick={() => void onCopyLink(item)}
      >
        {copyStatus === 'copied'
          ? <Check size={18} aria-hidden="true" />
          : <Share2 size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}

function FeatureCard({ item, index, days, formatDate, isSaved, onToggleSaved, onCopyLink, copyStatus }: {
  item: Listing;
  index: number;
  days: number;
  formatDate: (date: string) => string;
} & CardActionProps) {
  const accent = classNameFor(item.discipline[0] ?? 'fiction');
  return (
    <article className={`feature-card discipline-edge-${accent} feature-card-${index + 1}`} style={edgeStyleFor(item)} data-testid={`feature-opportunity-${index + 1}`}>
      <div className="feature-topline">
        <span className="feature-type">{item.type}</span>
        <div className="feature-stickers">
          {item.fee === 0 && <FeeSticker item={item} />}
          {days <= 30 && <span className="sticker sticker-days-left">{daysLeftText(days)}</span>}
        </div>
      </div>
      <h3>{item.name}</h3>
      <div className="feature-facts">
        <div role="group" aria-label={`Deadline: ${formatDate(item.deadline)}`}>
          <CalendarDays className="fact-icon" size={14} aria-hidden="true" />
          <strong>{formatDate(item.deadline)}</strong>
        </div>
        <div role="group" aria-label={`Award: ${item.award}`}>
          <Award className="fact-icon" size={14} aria-hidden="true" />
          <strong>{item.award}</strong>
        </div>
      </div>
      <ListingDisclaimer item={item} />
      <div className="feature-foot">
        <span className="verified"><Check size={14} /> Verified {formatShortDate(item.verified)}</span>
        <div className="feature-actions">
          <ListingActionButtons item={item} isSaved={isSaved} onToggleSaved={onToggleSaved} onCopyLink={onCopyLink} copyStatus={copyStatus} />
          <OfficialLink link={item.link} name={item.name} testId={`link-feature-official-${index + 1}`} />
        </div>
      </div>
    </article>
  );
}

function OfficialLink({ link, name, testId }: { link: string; name: string; testId: string }) {
  const href = safeOfficialUrl(link);
  // A link that fails the safety check is shown as unavailable instead of being rendered.
  if (!href) {
    return <span className="official-link official-link-unavailable" data-testid={testId}>Link unavailable</span>;
  }
  return (
    <a className="official-link" href={href} target="_blank" rel="noopener noreferrer" data-testid={testId}>
      Go to official page<span className="sr-only"> for {name} (opens in a new tab)</span> <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  );
}

function ListingCard({ item, index, days, formatDate, isSaved, onToggleSaved, onCopyLink, copyStatus }: {
  item: Listing;
  index: number;
  days: number | null;
  formatDate: (date: string) => string;
} & CardActionProps) {
  const accent = classNameFor(item.discipline[0] ?? 'fiction');
  const deadlineText = item.deadline === 'rolling' ? 'Rolling' : formatDate(item.deadline);
  return (
    <article className={`listing-card discipline-edge-${accent}`} style={edgeStyleFor(item)} data-testid={`card-opportunity-${index + 1}`}>
      <div className="listing-primary">
        <div className="listing-tags">
          {item.discipline.map((discipline) => (
            <span key={discipline} className={`discipline-badge discipline-${classNameFor(discipline)}`}>{discipline}</span>
          ))}
          <span className="type-tag">{item.type}</span>
          {item.fee === 0 && <FeeSticker item={item} extraClass="listing-free-sticker" />}
        </div>
        <h3>{item.name}</h3>
        <ListingDisclaimer item={item} />
      </div>
      <div className="listing-glance">
        <div className="glance-item">
          <div className="glance-value" role="group" aria-label={`Deadline: ${deadlineText}`}>
            <CalendarDays className="fact-icon" size={15} aria-hidden="true" />
            <strong>{deadlineText}</strong>
          </div>
          {days !== null && days <= 14 && <span className="mini-closing">{daysLeftText(days)}</span>}
        </div>
        <div className="glance-item">
          <div className="glance-value" role="group" aria-label={`Award: ${item.award}`}>
            <Award className="fact-icon" size={15} aria-hidden="true" />
            <strong>{item.award}</strong>
          </div>
        </div>
        <span className="verified"><Check size={14} /> Verified {formatShortDate(item.verified)}</span>
        <OfficialLink link={item.link} name={item.name} testId={`link-official-${index + 1}`} />
        <ListingActionButtons item={item} isSaved={isSaved} onToggleSaved={onToggleSaved} onCopyLink={onCopyLink} copyStatus={copyStatus} />
      </div>
      <details className="listing-more">
        <summary aria-label={`More details for ${item.name}`}>
          <span aria-hidden="true">Details</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="expanded-details">
          <div><span>Who can apply</span><p>{item.eligibility}</p></div>
          <div>
            <span>Application fee</span>
            {/* When a condition applies, it answers "what does this cost?" more completely than
                a bare "No fee" line does, so it replaces that line rather than following it. */}
            <p>{item.feeCondition || (item.fee === 0 ? 'No fee' : `$${item.fee}`)}</p>
          </div>
          <div><span>About this call</span><p>{item.note}</p></div>
          <div>
            <span>Something wrong?</span>
            <p><a className="report-link" href={reportUrlFor(item.name)} target="_blank" rel="noopener noreferrer">Report this listing<span className="sr-only">: {item.name} (opens in a new tab)</span></a></p>
          </div>
        </div>
      </details>
    </article>
  );
}

function TrustSection() {
  return (
    <section className="trust-section" id="how-this-list-is-kept" aria-labelledby="trust-title">
      <div className="trust-heading">
        <h2 id="trust-title">How this list is kept</h2>
      </div>
      <div className="trust-grid">
        <details className="trust-card">
          <summary title="Expand or collapse: how opportunities are found">
            <span className="trust-card-copy">
              <strong>How we find them</strong>
              <span className="trust-summary">Official sources, checked by a person before publishing.</span>
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <p>We scan official sources twice each month, and a person checks each opportunity before it is published.</p>
        </details>
        <details className="trust-card">
          <summary title="Expand or collapse: how listings are verified">
            <span className="trust-card-copy">
              <strong>How we verify</strong>
              <span className="trust-summary">Every listing links to its source and shows when it was checked.</span>
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <p>Each listing links to the organization's own page, shows its verification date, and moves to “Recently closed” once the deadline passes.</p>
        </details>
        <details className="trust-card">
          <summary title="Expand or collapse: what is left out">
            <span className="trust-card-copy">
              <strong>What we leave out</strong>
              <span className="trust-summary">No reading fees, vanity anthologies, or pay-to-play contests.</span>
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <p>We skip reading fees, vanity anthologies, pay-to-play contests, and opportunities found only through ads or direct messages.</p>
        </details>
      </div>
    </section>
  );
}

// The site is a single page, so it needs no router; main.tsx wraps it in an error boundary.
export default Home;
