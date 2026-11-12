import { useEffect, useRef } from "react";

import { isVerifiedStatus, statusMeaning, type Vocabulary } from "./vocabulary";

export const STATUS_LEGEND_ID = "how-recipes-are-verified";

// Every status links here. A plain section, so an anchor link always lands on visible text.
// The meanings are the release vocabulary's, shown as published; a status this release has no
// entry for is listed by name.
export function StatusLegend({ statuses, vocabulary }: { statuses: string[]; vocabulary: Vocabulary }) {
  const section = useRef<HTMLElement>(null);
  // The legend mounts after the catalog loads, so a link to its anchor (from a recipe page) lands here, not at load.
  useEffect(() => {
    if (window.location.hash === `#${STATUS_LEGEND_ID}`) section.current?.scrollIntoView();
  }, []);
  return (
    <section ref={section} id={STATUS_LEGEND_ID} className="status-legend" aria-labelledby={`${STATUS_LEGEND_ID}-title`}>
      <h3 id={`${STATUS_LEGEND_ID}-title`}>How recipes are verified</h3>
      <p>
        A status comes from the recipe library, which records real runs on DGX Spark hardware. It is information to help you choose, never a gate:
        you decide what to run, and recipes that are not verified stay listed.
      </p>
      <dl className="status-legend-list">
        {statuses.map((status) => (
          <div key={status}>
            <dt><span className={`status ${isVerifiedStatus(vocabulary, status) ? "ok" : "off"}`}>{status}</span></dt>
            <dd>{statusMeaning(vocabulary, status)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
