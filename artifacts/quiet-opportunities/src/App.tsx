import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ArrowDownRight, ArrowUpRight, Check, Moon, Sun, X } from 'lucide-react';
import listings from './listings.json';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
type Listing = (typeof listings)[number];

const types = ['All', 'Submission', 'Grant', 'Residency', 'Fellowship', 'Contest'];
const disciplines = ['All', 'Poetry', 'Fiction', 'Nonfiction', 'Photography', 'Visual art'];
const classNameFor = (value: string) => value.toLowerCase().replaceAll(' ', '-');
const disciplineAccents: Record<string, string> = {
  Poetry: 'var(--plum)',
  Fiction: 'var(--coral)',
  Nonfiction: 'var(--sun)',
  Photography: 'var(--sky)',
  'Visual art': 'var(--mint)',
};
const edgeStyleFor = (item: Listing) => ({
  '--edge-colors': item.discipline.map((discipline) => disciplineAccents[discipline]).join(', '),
}) as CSSProperties;

function Home() {
  const [activeType, setActiveType] = useState('All');
  const [activeDiscipline, setActiveDiscipline] = useState('All');
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('quiet-opportunities-theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('quiet-opportunities-theme', darkMode ? 'dark' : 'light');
    } catch {
      // Keep the selected theme for this visit if storage is unavailable.
    }
  }, [darkMode]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const latestVerified = useMemo(
    () => listings.reduce((latest, item) => item.verified > latest ? item.verified : latest, ''),
    [],
  );
  const featureListings = useMemo(() => listings
    .filter((item) => item.deadline !== 'rolling' && item.deadline >= todayKey)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 3), [todayKey]);
  const visibleListings = useMemo(() => listings
    .filter((item) => item.deadline === 'rolling' || item.deadline >= todayKey)
    .filter((item) => activeType === 'All' || item.type.toLowerCase() === activeType.toLowerCase())
    .filter((item) => activeDiscipline === 'All' || item.discipline.includes(activeDiscipline))
    .sort((a, b) => {
      if (a.deadline === 'rolling') return b.deadline === 'rolling' ? 0 : 1;
      if (b.deadline === 'rolling') return -1;
      return a.deadline.localeCompare(b.deadline);
    }), [activeType, activeDiscipline, todayKey]);

  const daysUntil = (deadline: string) => {
    const [year, month, day] = deadline.split('-').map(Number);
    const due = new Date(year, month - 1, day);
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((due.getTime() - current.getTime()) / 86400000);
  };
  const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  const clearFilters = () => {
    setActiveType('All');
    setActiveDiscipline('All');
  };

  return (
    <main className="quiet-page">
      <div className="page-shell">
        <header className="masthead">
          <a className="wordmark" href="/" aria-label="Quiet Opportunities home">
            <span className="wordmark-mark" aria-hidden="true">q<span>.</span></span>
            <span>Quiet Opportunities</span>
          </a>
          <p className="header-promise">Good things for people who make things.</p>
          <div className="header-actions">
            <span className="last-updated">Last updated <strong>{formatDate(latestVerified)}</strong></span>
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setDarkMode((current) => !current)}
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
              <p className="eyebrow"><span className="paint-dot" /> THREE DATES TO KEEP CLOSE</p>
              <h1 id="feature-title">Closing soon</h1>
            </div>
            <span className="heading-doodle" aria-hidden="true">〰</span>
          </div>
          {featureListings.length ? (
            <div className="feature-grid">
              {featureListings.map((item, index) => (
                <FeatureCard key={item.name} item={item} index={index} days={daysUntil(item.deadline)} formatDate={formatDate} />
              ))}
            </div>
          ) : (
            <div className="feature-empty">No dated calls on the horizon right now. The rolling ones are still open below.</div>
          )}
        </section>

        <section className="directory" aria-labelledby="directory-title">
          <div className="directory-heading">
            <div>
              <p className="eyebrow"><span className="paint-dot paint-dot-orange" /> FIND YOUR KIND OF OPENING</p>
              <h2 id="directory-title">The opportunity shelf</h2>
            </div>
            <span className="sort-note"><ArrowDownRight size={18} /> Soonest first</span>
          </div>

          <div className="filters" aria-label="Filter opportunities">
            <FilterGroup label="TYPE" title="Filter by opportunity type" values={types} selected={activeType} onSelect={setActiveType} testPrefix="type" />
            <FilterGroup label="DISCIPLINE" title="Filter by discipline" values={disciplines} selected={activeDiscipline} onSelect={setActiveDiscipline} testPrefix="discipline" />
            <button className="clear-button" type="button" onClick={clearFilters} disabled={activeType === 'All' && activeDiscipline === 'All'} data-testid="button-clear-filters">
              <X size={14} /> Clear all
            </button>
          </div>

          <div className="results-bar" aria-live="polite">
            <p><strong>{visibleListings.length}</strong> {visibleListings.length === 1 ? 'opportunity' : 'opportunities'} to explore</p>
            {(activeType !== 'All' || activeDiscipline !== 'All') && (
              <span className="active-filter-note">{[activeType !== 'All' && activeType, activeDiscipline !== 'All' && activeDiscipline].filter(Boolean).join(' · ')}</span>
            )}
          </div>

          {visibleListings.length > 0 ? (
            <div className="listing-list">
              {visibleListings.map((item, index) => (
                <ListingCard key={item.name} item={item} index={index} days={item.deadline === 'rolling' ? null : daysUntil(item.deadline)} formatDate={formatDate} />
              ))}
            </div>
          ) : (
            <div className="empty-state" data-testid="status-no-results">
              <span className="empty-mark" aria-hidden="true">✳</span>
              <h3>No matches in this little corner.</h3>
              <p>Try another type or discipline to see what’s open.</p>
              <button type="button" className="reset-filters" onClick={clearFilters}>Show everything</button>
            </div>
          )}
        </section>

        <footer className="site-footer">
          <span className="footer-squiggle" aria-hidden="true">〰</span>
          <p>Always check the official page before submitting. Real opportunities never ask you to pay to be considered.</p>
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

function FeatureCard({ item, index, days, formatDate }: { item: Listing; index: number; days: number; formatDate: (date: string) => string }) {
  const isClosing = days <= 14;
  const accent = classNameFor(item.discipline[0] ?? 'fiction');
  return (
    <article className={`feature-card discipline-edge-${accent} feature-card-${index + 1}`} style={edgeStyleFor(item)} data-testid={`feature-opportunity-${index + 1}`}>
      <div className="feature-topline">
        <div className="feature-disciplines">
          {item.discipline.map((discipline) => (
            <span key={discipline} className={`discipline-badge discipline-${classNameFor(discipline)}`}>{discipline}</span>
          ))}
        </div>
        <div className="feature-stickers">
          {item.fee === 0 && <span className="sticker sticker-free">No fee</span>}
          {isClosing
            ? <span className="sticker sticker-closing">Closing<br />soon!</span>
            : <span className="up-next">UP NEXT <span aria-hidden="true">↗</span></span>}
        </div>
      </div>
      <span className="feature-type">{item.type}</span>
      <h3>{item.name}</h3>
      <div className="feature-facts">
        <div><span>Deadline</span><strong>{formatDate(item.deadline)}</strong></div>
        <div><span>Award</span><strong>{item.award}</strong></div>
      </div>
      <div className="feature-foot">
        <span className="verified"><Check size={14} /> Verified {formatDate(item.verified)}</span>
        <a href={item.link} target="_blank" rel="noopener noreferrer" className="official-link" data-testid={`link-feature-official-${index + 1}`}>
          Go to official page <ArrowUpRight size={16} />
        </a>
      </div>
    </article>
  );
}

function ListingCard({ item, index, days, formatDate }: { item: Listing; index: number; days: number | null; formatDate: (date: string) => string }) {
  const accent = classNameFor(item.discipline[0] ?? 'fiction');
  return (
    <article className={`listing-card discipline-edge-${accent}`} style={edgeStyleFor(item)} data-testid={`card-opportunity-${index + 1}`}>
      <div className="listing-primary">
        <div className="listing-tags">
          {item.discipline.map((discipline) => (
            <span key={discipline} className={`discipline-badge discipline-${classNameFor(discipline)}`}>{discipline}</span>
          ))}
          <span className="type-tag">{item.type}</span>
          {item.fee === 0 && <span className="sticker sticker-free listing-free-sticker">No fee</span>}
        </div>
        <h3>{item.name}</h3>
      </div>
      <div className="listing-glance">
        <div className="glance-item"><span>Deadline</span><strong>{item.deadline === 'rolling' ? 'Rolling' : formatDate(item.deadline)}</strong>
          {days !== null && days <= 14 && <span className="mini-closing">Closing soon</span>}
        </div>
        <div className="glance-item"><span>Award</span><strong>{item.award}</strong></div>
        <span className="verified"><Check size={14} /> Verified {formatDate(item.verified)}</span>
        <a className="official-link" href={item.link} target="_blank" rel="noopener noreferrer" data-testid={`link-official-${index + 1}`}>
          Go to official page <ArrowUpRight size={16} />
        </a>
      </div>
      <details className="listing-more">
        <summary>More details <span aria-hidden="true">＋</span></summary>
        <div className="expanded-details">
          <div><span>Who can apply</span><p>{item.eligibility}</p></div>
          <div><span>Application fee</span><p>{item.fee === 0 ? 'No fee' : `$${item.fee}`}</p></div>
          <div><span>About this call</span><p>{item.note}</p></div>
        </div>
      </details>
    </article>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
