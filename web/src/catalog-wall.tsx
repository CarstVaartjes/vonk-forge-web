import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

import type { CatalogSummary, RecipeRow } from "./catalog-stats";
import { gibLabel } from "./catalog-filters";

// One recipe is one lit, outlined or hollow mark; the state comes from two catalog facts only
// (the vocabulary's verified flag and whether a hardware pass is on record), never from a status word.
export type CellState = "verified" | "before" | "none";

export function cellState(row: Pick<RecipeRow, "verified" | "passedBefore">): CellState {
  return row.verified ? "verified" : row.passedBefore ? "before" : "none";
}

const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });
const number = new Intl.NumberFormat("en");

// Newest release first, so new work appears top-left.
const newestFirst = (left: RecipeRow, right: RecipeRow) => right.released.localeCompare(left.released) || left.title.localeCompare(right.title);

function recipeHref(row: RecipeRow): string {
  return `/recipes/${row.publisher}/${row.slug}`;
}

function memoryLine(row: RecipeRow): string | null {
  if (row.measuredBytes !== null) return `${gibLabel(row.measuredBytes)} per Spark, measured`;
  if (row.memoryBytes !== null) return `${gibLabel(row.memoryBytes)} per Spark, declared`;
  return null;
}

function WallCard({ row }: { row: RecipeRow | null }) {
  if (!row) return <div className="wall-card" aria-hidden="true"><p className="wall-card-hint">Hover, focus or tap a mark for its details.</p></div>;
  const memory = memoryLine(row);
  return (
    <div className="wall-card">
      <strong>{row.title}</strong>
      {row.creator ? <span className="src">{row.creator}</span> : null}
      <span className="wall-card-status">{row.status}</span>
      <span>{row.tested ? `Tested ${day.format(new Date(row.tested))}` : "No hardware pass on record"}</span>
      <span>{row.sparks === 1 ? "1 Spark" : `${row.sparks} Sparks`}{memory ? ` · ${memory}` : ""}</span>
      <a className="text-link" href={recipeHref(row)}>Open recipe</a>
    </div>
  );
}

// The whole catalog at a glance: shelves by Spark count, a mark per recipe (a joined mark per Spark),
// one tab stop with arrow-key movement, Enter opens the recipe. The details of the hovered, focused or
// tapped mark show in a reserved panel under the wall, so nothing moves when they change.
export function CatalogWall({ summary }: { summary: CatalogSummary }) {
  const shelves = summary.bySparks.map(({ sparks, total }) => ({ sparks, total, rows: summary.recipes.filter((row) => row.sparks === sparks).sort(newestFirst) }));
  const ordered = shelves.flatMap((shelf) => shelf.rows);
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState<number | null>(null);
  const cells = useRef<Array<HTMLAnchorElement | null>>([]);
  const touch = useRef(false);

  const counts = { verified: 0, before: 0, none: 0 };
  for (const row of ordered) counts[cellState(row)] += 1;
  const verifiedLabel = [...new Set(ordered.filter((row) => row.verified).map((row) => row.status))].join(" / ");

  const select = (index: number, focus: boolean) => {
    setActive(index);
    setShown(index);
    if (focus) cells.current[index]?.focus();
  };

  const marks = () => cells.current.flatMap((cell, index) => (cell ? [{ index, rect: cell.getBoundingClientRect() }] : []));
  const centre = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  const closest = (candidates: ReturnType<typeof marks>, x: number, y: number, fallback: number) =>
    candidates.reduce((best, { index, rect }) => {
      const point = centre(rect);
      const distance = Math.hypot(point.x - x, point.y - y);
      return distance < best.distance ? { index, distance } : best;
    }, { index: fallback, distance: Infinity }).index;

  // The mark in the next row above (-1) or below (1) that sits nearest across.
  const neighbourRow = (direction: -1 | 1): number => {
    const all = marks();
    const here = all.find((mark) => mark.index === active)?.rect;
    if (!here) return active;
    const beyond = all.filter(({ rect }) => (direction < 0 ? rect.top < here.top - 2 : rect.top > here.top + 2));
    if (beyond.length === 0) return active;
    const rowTop = direction < 0 ? Math.max(...beyond.map(({ rect }) => rect.top)) : Math.min(...beyond.map(({ rect }) => rect.top));
    return closest(beyond.filter(({ rect }) => Math.abs(rect.top - rowTop) < 2), centre(here).x, rowTop, active);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    touch.current = false;
    const last = ordered.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = Math.min(active + 1, last);
    else if (event.key === "ArrowLeft") next = Math.max(active - 1, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      next = neighbourRow(event.key === "ArrowUp" ? -1 : 1);
    }
    if (next === null) return;
    event.preventDefault();
    select(next, true);
  };

  // On touch a tap selects the nearest mark and shows its details instead of navigating:
  // the marks are smaller than a finger, and the card carries the link.
  const onClick = (event: MouseEvent) => {
    if (!touch.current) return;
    touch.current = false;
    event.preventDefault();
    select(closest(marks(), event.clientX, event.clientY, active), false);
  };
  const onPointerDown = (event: PointerEvent) => { touch.current = event.pointerType === "touch"; };

  let index = -1;
  return (
    <div className="wall">
      <p id="wall-summary" className="visually-hidden">
        {number.format(ordered.length)} recipes: {number.format(counts.verified)} {verifiedLabel}, {number.format(counts.before)} passed before and are not verified now, {number.format(counts.none)} with no hardware pass yet.
      </p>
      <div className="wall-shelves" role="group" aria-label="The recipe catalog, one mark per recipe" aria-describedby="wall-summary" onKeyDown={onKeyDown} onPointerDown={onPointerDown} onClick={onClick}>
        {shelves.map((shelf) => (
          <section key={shelf.sparks} className="wall-shelf" aria-label={`${shelf.sparks} ${shelf.sparks === 1 ? "Spark" : "Sparks"}`}>
            <h3 className="wall-shelf-title">{shelf.sparks} {shelf.sparks === 1 ? "Spark" : "Sparks"} <span>{number.format(shelf.total)}</span></h3>
            <div className="wall-cells">
              {shelf.rows.map((row) => {
                index += 1;
                const mine = index;
                return (
                  <a
                    key={`${row.publisher}/${row.slug}`}
                    ref={(element) => { cells.current[mine] = element; }}
                    className="wall-cell"
                    data-state={cellState(row)}
                    data-shown={shown === mine ? "" : undefined}
                    href={recipeHref(row)}
                    tabIndex={active === mine ? 0 : -1}
                    aria-label={`${row.title}${row.creator ? `, ${row.creator}` : ""}, ${row.status}, ${row.sparks === 1 ? "1 Spark" : `${row.sparks} Sparks`}`}
                    onFocus={() => select(mine, false)}
                    onMouseEnter={() => setShown(mine)}
                  >
                    {Array.from({ length: row.sparks }, (_, spark) => <i key={spark} />)}
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <WallCard row={shown === null ? null : ordered[shown] ?? null} />
      <ul className="wall-legend" aria-label="What the marks mean">
        <li><span className="wall-key" data-state="verified" aria-hidden="true" />{verifiedLabel} <b>{number.format(counts.verified)}</b></li>
        <li><span className="wall-key" data-state="before" aria-hidden="true" />Passed before, not verified now <b>{number.format(counts.before)}</b></li>
        <li><span className="wall-key" data-state="none" aria-hidden="true" />No hardware pass yet <b>{number.format(counts.none)}</b></li>
      </ul>
    </div>
  );
}
