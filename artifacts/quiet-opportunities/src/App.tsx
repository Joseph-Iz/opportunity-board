import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ArrowDown, ArrowUpRight, Check, Moon, Sun } from 'lucide-react';
import listings from './listings.json';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

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
      // The theme still works for this visit when storage is unavailable.
    }
  }, [darkMode]);

  const types = ['All', 'Submission', 'Grant', 'Residency', 'Fellowship', 'Contest'];
  const disciplines = ['All', 'Fiction', 'Poetry', 'Nonfiction', 'Photography', 'Visual art'];
  const referenceDate = new Date('2026-10-13T00:00:00Z');
  const visibleListings = useMemo(() => listings
    .filter((item) => item.deadline === 'rolling' || new Date(`${item.deadline}T00:00:00Z`) >= referenceDate)
    .filter((item) => activeType === 'All' || item.type.toLowerCase() === activeType.toLowerCase())
    .filter((item) => activeDiscipline === 'All' || item.discipline.includes(activeDiscipline))
    .sort((a, b) => {
      if (a.deadline === 'rolling') return b.deadline === 'rolling' ? 0 : 1;
      if (b.deadline === 'rolling') return -1;
      return a.deadline.localeCompare(b.deadline);
    }), [activeType, activeDiscipline]);

  const daysUntil = (deadline: string) => Math.ceil(
    (new Date(`${deadline}T00:00:00Z`).getTime() - referenceDate.getTime()) / 86400000,
  );
  const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <main className="quiet-page">
      <div className="page-shell">
        <header className="masthead">
          <a className="wordmark" href="/" aria-label="Quiet Opportunities home">
            <span className="wordmark-mark" aria-hidden="true">q.</span>
            <span>Quiet Opportunities</span>
          </a>
          <button
            className="theme-toggle"
            type="button"
            onClick={() => setDarkMode((current) => !current)}
            aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`}
            aria-pressed={darkMode}
            data-testid="button-theme-toggle"
          >
            {darkMode ? <Sun size={17} strokeWidth={1.7} /> : <Moon size={17} strokeWidth={1.7} />}
            <span>{darkMode ? 'Light' : 'Dark'} mode</span>
          </button>
        </header>

        <section className="intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> A considered directory for creative work</p>
            <h1 id="page-title">Room to make<br /><em>something meaningful.</em></h1>
            <p className="promise">A calm, carefully kept list of opportunities for writers and photographers finding their way.</p>
          </div>
          <div className="intro-aside">
            <span className="issue-label">THE OPEN CALLS EDITION</span>
            <span className="intro-issue">No. 01 <span>/</span> Autumn 2026</span>
            <span className="aside-rule" />
            <p>Good work takes time.<br />Finding the right door shouldn’t.</p>
          </div>
          <div className="intro-index" aria-hidden="true">01 — 06</div>
        </section>

        <section className="directory" aria-labelledby="directory-title">
          <div className="directory-heading">
            <div>
              <p className="eyebrow section-eyebrow">THE DIRECTORY <span>·</span> UPDATED WEEKLY</p>
              <h2 id="directory-title">Open calls &amp; fellowships</h2>
            </div>
            <p className="sort-note"><ArrowDown size={14} strokeWidth={1.6} /> Soonest deadline</p>
          </div>

          <div className="filters" aria-label="Filter opportunities">
            <div className="filter-group">
              <span className="filter-label">OPPORTUNITY</span>
              <div className="chip-row" role="group" aria-label="Filter by opportunity type">
                {types.map((type) => (
                  <button
                    key={type}
                    className={`filter-chip ${activeType === type ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setActiveType(type)}
                    aria-pressed={activeType === type}
                    data-testid={`filter-type-${type.toLowerCase()}`}
                  >{type}</button>
                ))}
              </div>
            </div>
            <div className="filter-group discipline-filter">
              <span className="filter-label">DISCIPLINE</span>
              <div className="chip-row" role="group" aria-label="Filter by discipline">
                {disciplines.map((discipline) => (
                  <button
                    key={discipline}
                    className={`filter-chip ${activeDiscipline === discipline ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setActiveDiscipline(discipline)}
                    aria-pressed={activeDiscipline === discipline}
                    data-testid={`filter-discipline-${discipline.toLowerCase().replaceAll(' ', '-')}`}
                  >{discipline}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="listing-meta" aria-live="polite">
            <span>{String(visibleListings.length).padStart(2, '0')} opportunities</span>
            <span className="meta-divider" />
            <span>Dates checked for autumn 2026</span>
          </div>

          {visibleListings.length > 0 ? (
            <div className="listing-list">
              {visibleListings.map((item, index) => {
                const isRolling = item.deadline === 'rolling';
                const closingSoon = !isRolling && daysUntil(item.deadline) <= 14;
                return (
                  <article className="listing-card" key={item.name} data-testid={`card-opportunity-${index + 1}`}>
                    <div className="listing-main">
                      <div className="listing-kicker">
                        <span>{item.type}</span>
                        <span className="kicker-dot" />
                        <span>{item.discipline.join(' / ')}</span>
                      </div>
                      <h3>{item.name}</h3>
                      <p className="listing-note">{item.note}</p>
                      <dl className="listing-details">
                        <div><dt>Award</dt><dd>{item.award}</dd></div>
                        <div><dt>Eligibility</dt><dd>{item.eligibility}</dd></div>
                      </dl>
                    </div>
                    <aside className="listing-aside">
                      <div className="deadline-block">
                        <span className="detail-label">DEADLINE</span>
                        <strong className="deadline-date">{isRolling ? 'Rolling' : formatDate(item.deadline)}</strong>
                        {closingSoon && <span className="closing-badge">Closing soon</span>}
                      </div>
                      <div className="fee-block">
                        <span className="detail-label">APPLICATION FEE</span>
                        <span className="fee-value">{item.fee === 0 ? 'No fee' : `$${item.fee}`}</span>
                      </div>
                      <span className="verified"><Check size={13} strokeWidth={2} /> Verified {formatDate(item.verified)}</span>
                      <a
                        className="official-link"
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`link-official-${index + 1}`}
                      >Official page <ArrowUpRight size={15} strokeWidth={1.7} /></a>
                    </aside>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state" data-testid="status-no-results">
              <span className="empty-mark" aria-hidden="true">—</span>
              <h3>Nothing on this page just yet.</h3>
              <p>Try another discipline or opportunity type. The right fit may be just around the corner.</p>
              <button type="button" className="reset-filters" onClick={() => {
                setActiveType('All');
                setActiveDiscipline('All');
              }}>Clear filters</button>
            </div>
          )}
        </section>

        <footer className="site-footer">
          <p>Always check the official page before submitting.<br />Real opportunities never ask you to pay to be considered.</p>
        </footer>
      </div>
    </main>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
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
