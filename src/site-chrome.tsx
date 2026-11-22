import { useEffect, useState } from 'react';
import { ArrowUpRight, Flag, Info, Moon, Sun } from 'lucide-react';
import { countOfficialClick, countReportClick } from './analytics';
import { reportUrlFor, safeOfficialUrl } from './listing-rules';

// The parts every page of the site shares: which page is showing, the light/dark setting,
// the header, the footer and the checked "official page" link.

export type View = 'board' | 'campus' | 'prepare' | 'privacy' | 'claude';

// The site has no server-side pages, so the part of the address after "#" picks the page.
// Anything else (such as #how-this-list-is-kept) is a jump link within the main board.
const hashViews: Record<string, View> = {
  '#campus': 'campus',
  '#prepare': 'prepare',
  '#privacy': 'privacy',
  '#claude': 'claude',
};

const viewFromHash = (hash: string): View => hashViews[hash] ?? 'board';

const pageTitles: Record<View, string> = {
  board: 'Callboard: free, verified calls for writers and artists',
  campus: 'Campus edition preview · Callboard',
  prepare: 'Preparing your submission · Callboard',
  privacy: 'Privacy · Callboard',
  claude: 'Use Callboard in Claude · Callboard',
};

export function useView(): View {
  const [view, setView] = useState<View>(() => viewFromHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = pageTitles[view];
    const hash = window.location.hash;
    if (['', '#board', '#campus', '#prepare', '#privacy', '#claude'].includes(hash)) {
      window.scrollTo(0, 0);
    } else {
      // A jump link that also switched pages: the target only exists now, so scroll to it here.
      document.getElementById(hash.slice(1))?.scrollIntoView();
    }
  }, [view]);

  return view;
}

export function useTheme() {
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

  return { darkMode, toggleTheme };
}

export type ChromeProps = { view: View; darkMode: boolean; toggleTheme: () => void };

export const formatLongDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});

const sections: { view: View; href: string; label: string; pill?: string }[] = [
  { view: 'board', href: '#board', label: 'The board' },
  { view: 'campus', href: '#campus', label: 'Campus edition: U of U', pill: 'Preview' },
  { view: 'prepare', href: '#prepare', label: 'Submission guide' },
];

export function Masthead({ view, darkMode, toggleTheme, updated }: ChromeProps & { updated: string }) {
  return (
    <>
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="Callboard home">
          <span className="wordmark-mark" aria-hidden="true">c<span>.</span></span>
          <span>Callboard</span>
        </a>
        <p className="header-promise">Good things for people who make things. Every call is free to apply and checked by a person.</p>
        <div className="header-actions">
          <span className="last-updated">Last updated <strong>{formatLongDate(updated)}</strong></span>
          <a className="header-report" href={reportUrlFor()} title="Report a problem with a listing" target="_blank" rel="noopener noreferrer" onClick={() => countReportClick('header')} data-testid="link-header-report">
            <Flag size={15} aria-hidden="true" />
            <span>Report a problem</span>
            <span className="sr-only"> with a listing (opens in a new tab)</span>
          </a>
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
      <nav className="section-nav" aria-label="Sections">
        {sections.map((section) => (
          <a
            key={section.view}
            href={section.href}
            className={section.view === view ? 'is-current' : undefined}
            aria-current={section.view === view ? 'page' : undefined}
            data-testid={`nav-${section.view}`}
          >
            {section.label}
            {section.pill && <span className="nav-pill">{section.pill}</span>}
          </a>
        ))}
      </nav>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span className="footer-squiggle" aria-hidden="true">〰</span>
      <p>
        Always check the official page before submitting. Real opportunities never ask you to pay to be considered.{' '}
        <a className="footer-report" href={reportUrlFor()} target="_blank" rel="noopener noreferrer" onClick={() => countReportClick('footer')}>Spot a problem? Report a listing<span className="sr-only"> (opens in a new tab)</span></a>
        <br />
        <a className="footer-report" href="#claude">Use Callboard in Claude</a>
        <span aria-hidden="true"> · </span>
        <a className="footer-report" href="#privacy">Privacy</a>
        <br />
        Callboard is run by SmythBook LLC.
      </p>
      <span className="footer-squiggle" aria-hidden="true">〰</span>
    </footer>
  );
}

// A small "Report" link that sits beside each listing's Verified stamp, so a visitor who spots
// a problem never has to open the listing's details to find the form.
export function ReportListingLink({ name, testId }: { name: string; testId: string }) {
  return (
    <a className="card-report" href={reportUrlFor(name)} target="_blank" rel="noopener noreferrer" onClick={() => countReportClick('card', name)} data-testid={testId}>
      <Flag size={12} aria-hidden="true" />
      Report<span className="sr-only"> a problem with {name} (opens in a new tab)</span>
    </a>
  );
}

export function OfficialLink({ link, name, testId }: { link: string; name: string; testId: string }) {
  const href = safeOfficialUrl(link);
  // A link that fails the safety check is shown as unavailable instead of being rendered.
  if (!href) {
    return <span className="official-link official-link-unavailable" data-testid={testId}>Link unavailable</span>;
  }
  return (
    <a className="official-link" href={href} target="_blank" rel="noopener noreferrer" onClick={() => countOfficialClick(name)} data-testid={testId}>
      Go to official page<span className="sr-only"> for {name} (opens in a new tab)</span> <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  );
}
