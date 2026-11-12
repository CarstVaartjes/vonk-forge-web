import { WORKING_STATUS } from "./qualification-status";

export const STATUS_LEGEND_ID = "how-recipes-are-verified";

// The one owner of what each status means.
const STATUS_MEANINGS_URL = "https://github.com/CarstVaartjes/vonk-forge-recipes/blob/main/docs/recipe-authoring.md";

// Every status badge links here. A plain section, so an anchor link always lands on visible text.
export function StatusLegend({ statuses }: { statuses: string[] }) {
  return (
    <section id={STATUS_LEGEND_ID} className="status-legend" aria-labelledby={`${STATUS_LEGEND_ID}-title`}>
      <h3 id={`${STATUS_LEGEND_ID}-title`}>How recipes are verified</h3>
      <p>
        A status comes from the recipe library, which records real runs on DGX Spark hardware. It is information to help you choose, never a gate:
        you decide what to run, and recipes that are not verified stay listed.
      </p>
      <p>
        Statuses in this catalog:{" "}
        {statuses.map((status, index) => (
          <span key={status}>
            {index > 0 ? " " : ""}
            <span className={`badge ${status === WORKING_STATUS ? "accepted" : "candidate"}`}>{status}</span>
          </span>
        ))}
      </p>
      <p><a href={STATUS_MEANINGS_URL}>What each status means</a></p>
    </section>
  );
}
