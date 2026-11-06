import { useEffect, useState } from "react";

import { loadRecipeCatalog, type RecipeSummary } from "../api/client";
import { gibLabel } from "../catalog-filters";
import {
  ROLE_CLASS,
  ROLE_LABELS,
  SHOWCASE_PROFILES,
  SHOWCASE_PUBLISHER,
  type ShowcaseColumn,
  type ShowcaseMember,
  type ShowcaseRole,
} from "../showcase-profiles";

type Catalog = Map<string, RecipeSummary> | null;

function MemberChip({ member, recipe, catalog }: { member: ShowcaseMember; recipe: RecipeSummary | undefined; catalog: Catalog }) {
  const bytes = recipe?.capacity?.maximum_runtime_memory_bytes_per_node;
  const memory = bytes === undefined ? null : `${gibLabel(bytes)} per Spark`;
  return (
    <li className={`showcase-member role-${ROLE_CLASS[member.role]}`}>
      <span className="showcase-role">{ROLE_LABELS[member.role]}</span>
      {recipe ? (
        <>
          <a href={`/recipes/${recipe.publisher}/${recipe.slug}`}>{recipe.title}</a>
          <small>{[recipe.catalog.qualification, memory].filter(Boolean).join(" · ")}</small>
        </>
      ) : (
        <>
          <span>{member.slug}</span>
          <small>{catalog ? "Not in the published catalog right now." : "Details unavailable."}</small>
        </>
      )}
    </li>
  );
}

function Column({ name, members, recipes }: { name: string; members: ShowcaseMember[]; recipes: Catalog }) {
  return (
    <div className="showcase-column">
      <h4>{name}</h4>
      {members.length === 0 ? <p className="showcase-empty">No model on this Spark in this profile.</p> : (
        <ul>{members.map((member) => <MemberChip key={member.slug} member={member} recipe={recipes?.get(member.slug)} catalog={recipes} />)}</ul>
      )}
    </div>
  );
}

export function ShowcasePage() {
  const [recipes, setRecipes] = useState<Catalog>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadRecipeCatalog(controller.signal)
      .then((items) => setRecipes(new Map(items.filter((item) => item.publisher === SHOWCASE_PUBLISHER).map((item) => [item.slug, item]))))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "The public recipe index could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  const roles = Object.keys(ROLE_LABELS) as ShowcaseRole[];
  const side = (members: ShowcaseMember[], column: ShowcaseColumn) => members.filter((member) => member.column === column);

  return (
    <main className="catalog-page showcase-page">
      <header className="page-intro">
        <h1>Example: a 3D game generation setup on two Sparks</h1>
        <p>One example of how fleet profiles reshape the same two DGX Sparks for different stages of making a 3D game. Every profile is served from one endpoint under the same model names, switching profiles is one load, and a coder stays available beside the creative pipeline.</p>
      </header>
      <ul className="showcase-legend" aria-label="Role colours">
        {roles.map((role) => <li key={role} className={`showcase-member role-${ROLE_CLASS[role]}`}><span className="showcase-role">{ROLE_LABELS[role]}</span></li>)}
      </ul>
      {error ? <div className="status-panel error" role="alert"><h2>Recipe details are temporarily out of reach.</h2><p>{error}</p></div> : null}
      {!recipes && !error ? <div className="status-panel" role="status">Loading the public recipe index…</div> : null}
      <div className="showcase-grid">
        {SHOWCASE_PROFILES.map((profile) => {
          const both = side(profile.members, "both");
          return (
            <section className="showcase-card" key={profile.id} aria-labelledby={`profile-${profile.id}`}>
              <h3 id={`profile-${profile.id}`}>{profile.title}</h3>
              {both.length > 0 ? (
                <div className="showcase-columns showcase-both">
                  <Column name="Spark A and Spark B" members={both} recipes={recipes} />
                </div>
              ) : (
                <div className="showcase-columns">
                  <Column name="Spark A" members={side(profile.members, "left")} recipes={recipes} />
                  <Column name="Spark B" members={side(profile.members, "right")} recipes={recipes} />
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="showcase-note">Titles, status and memory come from the <a href="/recipes">published recipe catalog</a>. Column placement is illustrative; your Controller decides where each model runs.</p>
    </main>
  );
}
