import type { SparkFilter } from "./catalog-filters";
import { SPARK_OPTIONS } from "./catalog-filters";
import { MODEL_TYPES, type ModelTypeId } from "./model-types";


// The entry point of both catalog pages: say what you have, see what runs on
// it. Counts come from the loaded index with the other filters applied, so a
// tile never promises more than the list below can show.
export function SparkPicker({ value, counts, noun, onChange }: {
  value: SparkFilter;
  counts: Record<SparkFilter, number>;
  noun: string;
  onChange: (value: SparkFilter) => void;
}) {
  const number = new Intl.NumberFormat("en");
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
              aria-label={`${option.label}: ${number.format(count)} ${noun}`}
              disabled={count === 0 && !pressed}
              onClick={() => onChange(pressed ? "" : option.value)}
            >
              <strong>{option.numeral}</strong>
              <span>{option.label}</span>
              <small>{number.format(count)} {noun}</small>
            </button>
          );
        })}
        <button type="button" className="setup-tile setup-tile-any" aria-pressed={value === ""} aria-label={`Any count: ${number.format(counts[""])} ${noun}`} onClick={() => onChange("")}>
          <strong>Any</strong>
          <span>Every count</span>
          <small>{number.format(counts[""])} {noun}</small>
        </button>
      </div>
    </fieldset>
  );
}


export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

// A row of the most common values as toggles, with the long tail behind one
// select. The selected value always stays visible as a toggle.
export function FacetStrip({ label, options, value, onChange, max = 10 }: {
  label: string;
  options: FacetOption[];
  value: string;
  onChange: (value: string) => void;
  max?: number;
}) {
  const ranked = [...options].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, undefined, { numeric: true }));
  const shown = ranked.slice(0, max);
  if (value && !shown.some((option) => option.value === value)) {
    const selected = ranked.find((option) => option.value === value);
    if (selected) shown.push(selected);
  }
  const rest = ranked.filter((option) => !shown.includes(option));
  const number = new Intl.NumberFormat("en");
  return (
    <div className="setup-facet" role="group" aria-label={label}>
      <span className="setup-facet-label">{label}</span>
      <div className="setup-chips">
        {shown.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            aria-label={`${option.label}: ${number.format(option.count)}`}
            disabled={option.count === 0 && value !== option.value}
            onClick={() => onChange(value === option.value ? "" : option.value)}
          >
            {option.label}<small>{number.format(option.count)}</small>
          </button>
        ))}
        {rest.length ? (
          <select aria-label={`More ${label.toLowerCase()}`} value="" onChange={(event) => onChange(event.target.value)}>
            <option value="">{rest.length} more…</option>
            {rest.map((option) => <option key={option.value} value={option.value} disabled={option.count === 0}>{option.label} ({number.format(option.count)})</option>)}
          </select>
        ) : null}
      </div>
    </div>
  );
}


// The first choice on both catalog pages: what kind of model. A group of toggle
// buttons (each a native button, so Tab and Enter/Space work); "All" clears it.
// Counts come from the list with every other filter applied.
export function TypeTabs({ value, counts, total, noun, onChange }: {
  value: ModelTypeId | "";
  counts: Record<ModelTypeId, number>;
  total: number;
  noun: string;
  onChange: (value: ModelTypeId | "") => void;
}) {
  const number = new Intl.NumberFormat("en");
  const options: Array<{ id: ModelTypeId | ""; label: string; count: number }> = [
    { id: "", label: "All", count: total },
    ...MODEL_TYPES.map((type) => ({ id: type.id, label: type.label, count: counts[type.id] })),
  ];
  return (
    <div className="type-tabs" role="group" aria-label="Model type">
      {options.map((option) => (
        <button
          key={option.id || "all"}
          type="button"
          aria-pressed={value === option.id}
          aria-label={`${option.label}: ${number.format(option.count)} ${noun}`}
          disabled={option.count === 0 && value !== option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}<small>{number.format(option.count)}</small>
        </button>
      ))}
    </div>
  );
}

// "Verified on Spark": a recipe passed hardware checks on a DGX Spark. On by default.
export function VerifiedToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="verified-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>Verified on Spark</span>
      <small>Only recipes that passed hardware checks on a DGX Spark</small>
    </label>
  );
}
