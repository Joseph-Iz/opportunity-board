import { ArrowUpRight } from 'lucide-react';
import listings from './listings.json';
import { countReportClick } from './analytics';
import { reportUrlFor, safeOfficialUrl } from './listing-rules';
import { type ChromeProps, Masthead, SiteFooter } from './site-chrome';

// A short, plain guide to getting a submission ready. It is general advice: every call's own
// guidelines come first, and the page says so at the top.

// Free tools, checked the same way listing links are. Kept short on purpose.
export const guideLinks = [
  {
    name: 'Proper Manuscript Format, by William Shunn',
    link: 'https://www.shunn.net/format/',
    why: 'The reference most fiction editors mean by “standard manuscript format”, with free templates.',
  },
  {
    name: 'LibreOffice',
    link: 'https://www.libreoffice.org/',
    why: 'A free word processor that opens and saves .docx files.',
  },
];

function GuideLink({ name, link }: { name: string; link: string }) {
  const href = safeOfficialUrl(link);
  if (!href) return <span>{name} (link unavailable)</span>;
  return (
    <a className="report-link" href={href} target="_blank" rel="noopener noreferrer">
      {name}<span className="sr-only"> (opens in a new tab)</span> <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  );
}

export function PrepareGuide({ chrome }: { chrome: ChromeProps }) {
  const latestVerified = listings.reduce((latest, item) => item.verified > latest ? item.verified : latest, '');
  return (
    <main className="quiet-page">
      <div className="page-shell">
        <Masthead {...chrome} updated={latestVerified} />

        <article className="guide" aria-labelledby="guide-title">
          <header className="guide-head">
            <h1 id="guide-title">Preparing your submission</h1>
            <p>The plain basics, so your work is judged on the work. Every call's own guidelines come first: if they ask for something different, do what they ask.</p>
          </header>

          <div className="guide-grid">
            <section className="guide-card">
              <h2>Stories and essays</h2>
              <ul>
                <li>12-point, easy-to-read serif font, such as Times New Roman.</li>
                <li>Double-spaced, with one-inch margins on every side.</li>
                <li>Left-aligned text, with the first line of each paragraph indented.</li>
                <li>A header on each page with your last name, a short title and the page number.</li>
                <li>On the first page: the title, your name, your contact details and an approximate word count.</li>
                <li>Save as .docx unless the call names another file type.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>Poems</h2>
              <ul>
                <li>Single-spaced, with your own line and stanza breaks kept exactly.</li>
                <li>Start each poem on a new page.</li>
                <li>Put all the poems in one file, in the order you want them read.</li>
                <li>Send only as many poems as the call allows. Three to five is common.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>Photographs and artwork</h2>
              <ul>
                <li>Export each image at the size and file type the call asks for.</li>
                <li>Name the files the way the call asks. If it does not say, use your last name and the title.</li>
                <li>Keep a list with each piece's title, year, medium and size. Many calls ask for one.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>Plays and screenplays</h2>
              <ul>
                <li>Scripts have their own page layouts, and they differ between stage and screen.</li>
                <li>Use the format the call names. If it names none, use the standard for that form.</li>
                <li>Check the page or minute limit before you send a full-length script.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>If the reading is anonymous</h2>
              <ul>
                <li>Some calls read “blind”, meaning the readers must not know who wrote the piece.</li>
                <li>Take your name off every page, the header and the file name.</li>
                <li>Put your contact details only where the form asks for them.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>The cover letter</h2>
              <ul>
                <li>Three or four sentences are enough.</li>
                <li>Say what you are sending: the title, the genre and the word count.</li>
                <li>Add a one- or two-sentence note about yourself. It is fine to have no publications yet.</li>
                <li>Do not explain or summarize the piece. Thank the editors and stop.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>Sending to more than one place</h2>
              <ul>
                <li>Sending the same piece to several places at once is called a simultaneous submission.</li>
                <li>Check that each call allows it. Most magazines do, and some do not.</li>
                <li>If one place accepts the piece, withdraw it from the others the same day.</li>
                <li>Keep a simple log: what you sent, where, on what date, and the answer.</li>
              </ul>
            </section>

            <section className="guide-card guide-card-warning">
              <h2>Signs to walk away</h2>
              <ul>
                <li>A fee to be considered, or a fee to be printed once you are “accepted”.</li>
                <li>A request for bank details, an ID or a deposit.</li>
                <li>An invitation that arrives by ad or direct message and pushes you to decide fast.</li>
                <li>Terms that take all rights to your work forever.</li>
              </ul>
              <p>Seen one of these on a listing here? <a className="report-link" href={reportUrlFor()} target="_blank" rel="noopener noreferrer" onClick={() => countReportClick('guide')}>Report it<span className="sr-only"> (opens in a new tab)</span></a>.</p>
            </section>
          </div>

          <section className="guide-tools" aria-labelledby="guide-tools-title">
            <h2 id="guide-tools-title">Free tools</h2>
            <ul>
              {guideLinks.map((tool) => (
                <li key={tool.name}><GuideLink name={tool.name} link={tool.link} /> <span>{tool.why}</span></li>
              ))}
            </ul>
          </section>
        </article>

        <SiteFooter />
      </div>
    </main>
  );
}
