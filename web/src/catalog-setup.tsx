import type { SparkFilter } from "./catalog-filters";
import { SPARK_OPTIONS } from "./catalog-filters";

// "1 recipe", "2 recipes": the nouns here are the plural "recipes" and "models".
const countOf = (count: number, noun: string): string =>
  `${new Intl.NumberFormat("en").format(count)} ${count === 1 ? noun.slice(0, -1) : noun}`;

// The count sits inline and muted: the number is visible, the noun is read by screen readers ("12 recipes").
function Count({ count, noun }: { count: number; noun: string }) {
  const text = countOf(count, noun);
  const split = text.indexOf(" ");
  return (
    <small>
      {text.slice(0, split)} <span className="visually-hidden">{text.slice(split + 1)}</span>
    </small>
  );
}

// The entry point of both catalog pages: say what you have, see what runs on
// it. Counts come from the loaded index with the other filters applied, so a
// tile never promises more than the list below can show.
export function SparkPicker({
  value,
  counts,
  noun,
  onChange,
}: {
  value: SparkFilter;
  counts: Record<SparkFilter, number>;
  noun: string;
  onChange: (value: SparkFilter) => void;
}) {
  return (
    <fieldset className="setup-sparks">
      <legend>How many Sparks do you have?</legend>
      <div className="setup-tiles">
        {SPARK_OPTIONS.map((option) => {
          const pressed = value === option.value;
          const count = counts[option.value];
          return (
            <button
              key={option.value}
              type="button"
              className="setup-tile"
              aria-pressed={pressed}
              disabled={count === 0 && !pressed}
              onClick={() => onChange(pressed ? "" : option.value)}
            >
              <strong aria-hidden="true">{option.numeral}</strong>
              <span>{option.label}</span> <Count count={count} noun={noun} />
            </button>
          );
        })}
        <button
          type="button"
          className="setup-tile setup-tile-any"
          aria-pressed={value === ""}
          onClick={() => onChange("")}
        >
          <strong>Any</strong> <Count count={counts[""]} noun={noun} />
        </button>
      </div>
    </fieldset>
  );
}

// The "More filters" summary of both catalog pages: a badge counts what is set inside the disclosure,
// so a filter that is hidden is never silent.
export function MoreFiltersSummary({ active }: { active: number }) {
  return (
    <summary>
      More filters
      {active ? (
        <span className="catalog-more-count" aria-hidden="true">
          {active}
        </span>
      ) : null}
      {active ? <span className="visually-hidden"> ({active} active)</span> : null}
    </summary>
  );
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

// A row of the most common values as toggles, with the long tail behind one
// select. The selected value always stays visible as a toggle.
export function FacetStrip({
  label,
  options,
  value,
  onChange,
  max = 10,
}: {
  label: string;
  options: FacetOption[];
  value: string;
  onChange: (value: string) => void;
  max?: number;
}) {
  // A value no recipe has is not offered, unless it is the one selected.
  const ranked = options
    .filter((option) => option.count > 0 || option.value === value)
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.label.localeCompare(right.label, undefined, { numeric: true }),
    );
  const shown = ranked.slice(0, max);
  if (value && !shown.some((option) => option.value === value)) {
    const selected = ranked.find((option) => option.value === value);
    if (selected) shown.push(selected);
  }
  const rest = ranked.filter((option) => !shown.includes(option));
  if (ranked.length === 0) return null;
  const number = new Intl.NumberFormat("en");
  return (
    // biome-ignore lint/a11y/useSemanticElements: role=group names a styled wrapper; fieldset would need a user-agent style reset
    <div className="setup-facet" role="group" aria-label={label}>
      <span className="setup-facet-label">{label}</span>
      <div className="setup-chips">
        {shown.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            aria-label={`${option.label}: ${number.format(option.count)}`}
            onClick={() => onChange(value === option.value ? "" : option.value)}
          >
            {option.label} <small>{number.format(option.count)}</small>
          </button>
        ))}
        {rest.length ? (
          <select
            aria-label={`More ${label.toLowerCase()}`}
            value=""
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">{rest.length} more…</option>
            {rest.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({number.format(option.count)})
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}

// The first choice on both catalog pages: what kind of model. A group of toggle
// buttons (each a native button, so Tab and Enter/Space work); "All" clears it.
// Counts come from the list with every other filter applied.
export function TypeTabs({
  types,
  value,
  counts,
  total,
  onChange,
}: {
  // The release vocabulary's categories.
  types: ReadonlyArray<{ id: string; label: string }>;
  value: string;
  counts: Record<string, number>;
  total: number;
  onChange: (value: string) => void;
}) {
  const number = new Intl.NumberFormat("en");
  const options: Array<{ id: string; label: string; count: number }> = [
    { id: "", label: "All", count: total },
    ...types.map((type) => ({ id: type.id, label: type.label, count: counts[type.id] ?? 0 })),
  ];
  return (
    // biome-ignore lint/a11y/useSemanticElements: role=group names a styled wrapper; fieldset would need a user-agent style reset
    <div className="type-tabs" role="group" aria-label="Model type">
      {options.map((option) => (
        <button
          key={option.id || "all"}
          type="button"
          aria-pressed={value === option.id}
          aria-disabled={option.count === 0 && value !== option.id ? true : undefined}
          onClick={() => {
            if (option.count > 0 || value === option.id) onChange(option.id);
          }}
        >
          {option.label} <small>{number.format(option.count)}</small>
        </button>
      ))}
    </div>
  );
}

// "Verified on Spark": a recipe passed hardware checks on a DGX Spark. On by default.
export function VerifiedToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="verified-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>Verified on Spark</span>
      <small>Only recipes that passed hardware checks on a DGX Spark</small>
    </label>
  );
}
