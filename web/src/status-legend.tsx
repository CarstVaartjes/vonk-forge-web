import { useEffect, useState } from "react";

import { WORKING_STATUS, statusMeaning } from "./qualification-status";

export const STATUS_LEGEND_ID = "how-recipes-are-verified";

// Every status badge links here. The block opens when the page is opened at,
// or navigated to, its anchor.
export function StatusLegend({ statuses }: { statuses: string[] }) {
  const [open, setOpen] = useState(() => window.location.hash === `#${STATUS_LEGEND_ID}`);
  useEffect(() => {
    const onHash = () => { if (window.location.hash === `#${STATUS_LEGEND_ID}`) setOpen(true); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return (
    <details id={STATUS_LEGEND_ID} className="status-legend" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>How recipes are verified</summary>
      <p>
        A status comes from the recipe library, which records real runs on DGX Spark hardware. It is information to help you choose, never a gate:
        you decide what to run, and recipes that are not verified stay listed.
      </p>
      <dl>
        {statuses.map((status) => (
          <div key={status}>
            <dt><span className={`badge ${status === WORKING_STATUS ? "accepted" : "candidate"}`}>{status}</span></dt>
            <dd>{statusMeaning(status) ?? "Shown exactly as the recipe library published it."}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
