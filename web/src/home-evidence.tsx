import { BarSeries, type BarPoint } from "./bar-series";
import { engineLabel } from "./catalog-filters";
import type { CatalogSummary, RecipeRow } from "./catalog-stats";
import { EvidenceReceipt } from "./evidence-receipt";
import { fitAnswer } from "./my-sparks";
import { RollingNumber } from "./rolling-number";

const number = new Intl.NumberFormat("en");
const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const DAY = 86_400_000;
const label = (day: string) => short.format(new Date(day));
const weekRange = (start: string) => `${label(start)} to ${label(new Date(Date.parse(start) + 6 * DAY).toISOString())}`;

function Newest({ row }: { row: RecipeRow }) {
  return (
    <li>
      <time dateTime={row.released}>{label(row.released)}</time>
      <div>
        <a href={`/recipes/${row.publisher}/${row.slug}`}>{row.title}</a>
        <span className="fit-meta">{row.creator ? <><span className="src">{row.creator}</span> · </> : null}{row.engine ? `${engineLabel(row.engine)} · ` : ""}{row.sparks === 1 ? "1 Spark" : `${row.sparks} Sparks`}</span>
      </div>
      <span className="status ok">{row.status}</span>
    </li>
  );
}

// Section 2: the catalog moves. Recipes released per week and the newest verified recipes.
export function KeptCurrent({ summary }: { summary: CatalogSummary }) {
  const weeks: BarPoint[] = summary.releasedPerWeek.map((week) => ({ range: weekRange(week.start), count: week.count }));
  const lastWeek = summary.releasedPerWeek.at(-1)?.count ?? 0;
  const newest = fitAnswer(summary, { sparks: "", type: "" }, 6).newest;
  return (
    <section className="home-section" aria-labelledby="kept-current-title">
      <div className="home-section-heading">
        <h2 id="kept-current-title">New models and recipe revisions arrive every week.</h2>
        <p>The catalog follows the creators&apos; releases and refreshes recipes in place. Your Controller syncs it on its own and tells you when a running install has a newer revision. You decide when to update.</p>
      </div>
      <div className="home-pair">
        <div className="card">
          <p className="fig"><RollingNumber value={lastWeek} /> <small>recipes released in the last 7 days</small></p>
          <p className="chart-sub">Recipes by release date, per week, last {weeks.length} weeks.</p>
          <BarSeries title="Recipes released per week" noun="recipes" points={weeks} axis={[`week of ${label(summary.releasedPerWeek[0]!.start)}`, `week of ${label(summary.releasedPerWeek.at(-1)!.start)}`]} />
        </div>
        <div className="card fresh">
          <div className="fit-results-head"><h3>Newest verified recipes</h3><a className="text-link" href="/recipes">All recipes</a></div>
          <ul>{newest.map((row) => <Newest key={`${row.publisher}/${row.slug}`} row={row} />)}</ul>
        </div>
      </div>
    </section>
  );
}

// Section 3: the proof. How many recipes are verified, what every other status means, when the
// hardware passes ran and one real receipt.
export function VerifiedOnHardware({ summary }: { summary: CatalogSummary }) {
  const days: BarPoint[] = summary.passesPerDay.map((day) => ({ range: label(day.day), count: day.count }));
  const dailyTitle = `Most recent hardware pass per recipe, by day, last ${days.length} days`;
  const verifiedLabel = summary.statuses.filter((status) => status.verified).map((status) => status.status).join(" / ");
  return (
    <section className="home-section" aria-labelledby="verified-title">
      <div className="home-section-heading">
        <h2 id="verified-title">Not &quot;should work&quot;. Ran, on a real DGX Spark.</h2>
        <p>A recipe counts as verified only after it passed on a real DGX Spark, for that exact recipe, runtime image and model. Change any of them and it is checked again. Everything else is shown as what it is.</p>
      </div>
      <div className="home-pair">
        <div className="card">
          <p className="fig"><RollingNumber value={summary.verified} /> <small>of {number.format(summary.total)} recipes are {verifiedLabel}</small></p>
          <div className="split" aria-hidden="true">
            {summary.statuses.map((status) => <i key={status.status} data-verified={status.verified ? "" : undefined} style={{ flexGrow: status.count }} />)}
          </div>
          <ul className="meanings">
            {summary.statuses.map((status) => (
              <li key={status.status}>
                <span className={`status ${status.verified ? "ok" : "off"}`}>{status.status} <b>{number.format(status.count)}</b></span>
                <span>{status.meaning}</span>
              </li>
            ))}
          </ul>
          <p className="chart-title">{dailyTitle}</p>
          <BarSeries title={dailyTitle} noun="recipes" points={days} axis={[label(summary.passesPerDay[0]!.day), label(summary.passesPerDay.at(-1)!.day)]} />
        </div>
        {summary.receipt ? <EvidenceReceipt facts={summary.receipt} verified /> : null}
      </div>
    </section>
  );
}
