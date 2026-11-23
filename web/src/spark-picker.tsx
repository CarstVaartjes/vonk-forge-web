import { formatDate } from "./dates";
import { TypeIcon } from "./icons";
import { engineLabel, SPARK_OPTIONS, type SparkFilter } from "./catalog-filters";
import type { CatalogSummary, RecipeRow } from "./catalog-stats";
import { memoryLine } from "./catalog-wall";
import { fitAnswer, fitsPick, type MySparks } from "./my-sparks";
import { RollingNumber } from "./rolling-number";

const number = new Intl.NumberFormat("en");
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
const word = (count: number) => WORDS[count] ?? String(count);
const sparkWord = (count: number) => (count === 1 ? "one Spark" : `${word(count)} Sparks`);

// "How many Sparks do you have?": the same choices as the catalog page (SPARK_OPTIONS), as one
// segmented control. Pressing the pressed choice clears it.
export function SparkSegments({
  value,
  onChange,
}: {
  value: SparkFilter;
  onChange: (value: SparkFilter) => void;
}) {
  return (
    <div className="picker-row">
      <p className="picker-q" id="picker-question">
        How many Sparks do you have?
      </p>
      <div className="seg" role="group" aria-labelledby="picker-question">
        {SPARK_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            aria-label={option.label}
            onClick={() => onChange(value === option.value ? "" : option.value)}
          >
            {option.numeral}
          </button>
        ))}
      </div>
    </div>
  );
}

// The kind of model: chips from the summary's types, each with the verified recipes that fit the
// Spark pick. A type nothing fits stays visible but does nothing.
export function TypeChips({
  summary,
  pick,
  onChange,
}: {
  summary: CatalogSummary;
  pick: MySparks;
  onChange: (type: string) => void;
}) {
  const counts = Object.fromEntries(
    summary.types.map((type) => [
      type.id,
      summary.recipes.filter(
        (row) => row.verified && fitsPick(row, { sparks: pick.sparks, type: type.id }),
      ).length,
    ]),
  );
  const all = summary.recipes.filter(
    (row) => row.verified && fitsPick(row, { sparks: pick.sparks, type: "" }),
  ).length;
  const chips = [
    { id: "", label: "All", count: all },
    ...summary.types.map((type) => ({
      id: type.id,
      label: type.label,
      count: counts[type.id] ?? 0,
    })),
  ];
  return (
    <div className="type-chips" role="group" aria-label="Model type">
      {chips.map((chip) => (
        <button
          key={chip.id || "all"}
          type="button"
          aria-pressed={pick.type === chip.id}
          aria-disabled={chip.count === 0 && pick.type !== chip.id ? true : undefined}
          onClick={() => {
            if (chip.count > 0 || pick.type === chip.id)
              onChange(pick.type === chip.id ? "" : chip.id);
          }}
        >
          {chip.id ? <TypeIcon id={chip.id} /> : null}
          {chip.label}
          <small>{number.format(chip.count)}</small>
        </button>
      ))}
    </div>
  );
}

// The answer to what the visitor picked, in one live region: the number, a sentence, the breakdown.
// It counts recipes by Spark count only and never claims a memory fit.
export function FitAnswerView({ summary, pick }: { summary: CatalogSummary; pick: MySparks }) {
  const answer = fitAnswer(summary, pick);
  const typeLabel = summary.types.find((type) => type.id === pick.type)?.label;
  const option = SPARK_OPTIONS.find((candidate) => candidate.value === pick.sparks);
  const where =
    pick.sparks === "1"
      ? "one Spark"
      : pick.sparks === "4+"
        ? "4 or more Sparks"
        : `${pick.sparks} Sparks`;
  const sentence = option
    ? `verified ${typeLabel ? `${typeLabel} ` : ""}recipes run on ${where}.`
    : `${typeLabel ? `${typeLabel} ` : ""}recipes verified on a real DGX Spark, out of ${number.format(summary.recipes.filter((row) => fitsPick(row, pick)).length)} in the catalog.`;
  const moreUnverified =
    answer.moreUnverified > 0
      ? `${number.format(answer.moreUnverified)} more published for your Sparks, not verified yet. `
      : "";
  const pickedMany = option !== undefined && pick.sparks !== "1" && answer.byUse.length > 0;
  return (
    <div className="answer" aria-live="polite" aria-atomic="true">
      {pickedMany ? (
        <>
          <p className="answer-total">
            {number.format(answer.count)} {sentence}
          </p>
          <ul className="answer-choices" aria-label="How to use your Sparks">
            {answer.byUse.map((use) => {
              const query = new URLSearchParams({
                sparks: pick.sparks,
                ...(pick.type ? { type: pick.type } : {}),
                uses: String(use.sparks),
              });
              const label =
                use.sparks === 1
                  ? "run on one Spark (keep the others free)"
                  : `use ${use.sparks === Number(pick.sparks) ? "all" : word(use.sparks)} of your Sparks for one model`;
              return (
                <li key={use.sparks}>
                  <a className="answer-choice" href={`/recipes?${query}`}>
                    <span className="big">{number.format(use.count)}</span> <span>{label}</span>
                  </a>
                  <span className="fit-meta">
                    Newest:{" "}
                    <a href={`/recipes/${use.newest.publisher}/${use.newest.slug}`}>
                      {use.newest.title}
                    </a>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <span className="big">
            <RollingNumber value={answer.count} />
          </span>
          <p>{sentence}</p>
        </>
      )}
      {option ? (
        <p className="answer-breakdown">
          {moreUnverified}Your Controller checks the exact memory and disk fit before it runs
          anything.
        </p>
      ) : null}
    </div>
  );
}

function Pips({ uses, of }: { uses: number; of: number }) {
  return (
    <span
      className="pips"
      role="img"
      aria-label={`Uses ${uses} of ${of} ${of === 1 ? "Spark" : "Sparks"}`}
    >
      {Array.from({ length: of }, (_, index) => (
        <i key={index} data-on={index < uses ? "" : undefined} />
      ))}
    </span>
  );
}

// The five newest verified recipes that fit, each with how many of the picked Sparks it uses.
export function FitResults({ summary, pick }: { summary: CatalogSummary; pick: MySparks }) {
  const answer = fitAnswer(summary, pick);
  if (answer.count === 0) return null;
  const parameters = new URLSearchParams();
  if (pick.sparks) parameters.set("sparks", pick.sparks);
  if (pick.type) parameters.set("type", pick.type);
  const query = parameters.toString();
  const picked = pick.sparks && pick.sparks !== "4+" ? Number(pick.sparks) : null;
  return (
    <section className="fit-results" aria-labelledby="fit-results-title">
      <div className="fit-results-head">
        <h3 id="fit-results-title" className="wall-shelf-title">
          Newest that fit
        </h3>
        <a className="text-link" href={`/recipes${query ? `?${query}` : ""}`}>
          See all {number.format(answer.count)} in the catalog
        </a>
      </div>
      <ul>
        {answer.newest.map((row: RecipeRow) => (
          <li key={`${row.publisher}/${row.slug}`}>
            <div>
              <a href={`/recipes/${row.publisher}/${row.slug}`}>{row.title}</a>
              <span className="fit-meta">
                <Pips uses={row.sparks} of={picked ?? row.sparks} />{" "}
                {picked
                  ? `${row.sparks} of ${picked} ${picked === 1 ? "Spark" : "Sparks"}`
                  : sparkWord(row.sparks)}
                {row.creator ? (
                  <>
                    {" "}
                    · <span className="src">{row.creator}</span>
                  </>
                ) : null}
                {row.engine ? ` · ${engineLabel(row.engine)}` : ""}
                {memoryLine(row) ? ` · ${memoryLine(row)}` : ""}
              </span>
            </div>
            <span className="fit-date">released {formatDate(row.released)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
