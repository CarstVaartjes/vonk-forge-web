import { cellState } from "./catalog-wall";
import { engineLabel, foldCreators, modelFamilyTitle, sameCreator } from "./catalog-filters";
import { passedBefore, type StatsRecipe } from "./catalog-stats";

const sparksLabel = (count: number) => (count === 1 ? "1 Spark" : `${count} Sparks`);

// Every way to run one model family: creators as rows (most recipes first), Spark counts as columns,
// one chip per recipe with its mark (filled, outlined dot, dashed: the wall's three shapes) and its
// status word for assistive technology. The current recipe is marked. A family with one recipe has
// no choice to show, so it draws nothing.
export function WaysMatrix({ recipes, family, current }: { recipes: StatsRecipe[]; family: string; current?: { publisher: string; slug: string } }) {
  const wanted = family.trim().toLowerCase();
  const scope = recipes.filter((recipe) => modelFamilyTitle(recipe).trim().toLowerCase() === wanted);
  if (scope.length < 2) return null;
  const creators = foldCreators(scope.map((recipe) => recipe.catalog.source_owner)).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  const unnamed = scope.filter((recipe) => !recipe.catalog.source_owner?.trim());
  const rows = [...creators.map(({ name }) => ({ name, recipes: scope.filter((recipe) => sameCreator(recipe.catalog.source_owner, name)) })), ...(unnamed.length ? [{ name: "Creator not named", recipes: unnamed }] : [])];
  const columns = Array.from(new Set(scope.map((recipe) => recipe.catalog.node_count))).sort((left, right) => left - right);
  return (
    <section className="card detail-block ways" aria-labelledby="ways-title">
      <p className="receipt-label">Other ways to run this family</p>
      <h2 id="ways-title">Every way to run {family}: {scope.length} recipes from {rows.length} {rows.length === 1 ? "creator" : "creators"}</h2>
      <p className="ways-note">Every creator&apos;s recipe for each number of Sparks. A filled mark is verified on real hardware, an outlined dot passed before, a dashed mark has no hardware pass yet. Hover a recipe for its status word; screen readers hear it.</p>
      <table className="matrix">
        <thead><tr><th scope="col">Creator</th>{columns.map((count) => <th key={count} scope="col">{sparksLabel(count)}</th>)}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              {columns.map((count) => (
                <td key={count} data-label={sparksLabel(count)}>
                  {row.recipes.filter((recipe) => recipe.catalog.node_count === count).map((recipe) => {
                    const here = current?.publisher === recipe.publisher && current.slug === recipe.slug;
                    return (
                      <a key={`${recipe.publisher}/${recipe.slug}`} className="way" href={`/recipes/${recipe.publisher}/${recipe.slug}`} title={recipe.catalog.qualification} aria-current={here ? "page" : undefined}>
                        <span className="wall-key" data-state={cellState({ verified: recipe.catalog.verified, passedBefore: passedBefore(recipe) })} aria-hidden="true" />
                        <span>{recipe.title}{recipe.runtime.adapter ? <> · <small>{engineLabel(recipe.runtime.adapter)}</small></> : null}<span className="visually-hidden">, {recipe.catalog.qualification}</span></span>
                      </a>
                    );
                  })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
