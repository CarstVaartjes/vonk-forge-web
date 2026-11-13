import { gibLabel } from "./catalog-filters";

// What the recipe needs from each Spark, drawn as one model across its Sparks: the model name over a
// bracket that joins one slab per Spark, each with the peak a hardware run measured (only when the
// catalog has one) and the memory the recipe declares, on one shared scale. A value the catalog does
// not carry is left out.
export function SparkUnit({ model, sparks, measuredBytes, declaredBytes }: { model: string; sparks: number; measuredBytes: number | null; declaredBytes: number | null }) {
  const scale = Math.max(measuredBytes ?? 0, declaredBytes ?? 0);
  const bar = (label: string, bytes: number | null) => bytes === null ? null : (
    <div className="spark-unit-row">
      <span>{label}</span>
      <span className="meter" aria-hidden="true"><i style={{ width: `${(bytes / scale) * 100}%` }} /></span>
      <b>{gibLabel(bytes, 1)}</b>
    </div>
  );
  return (
    <div className="spark-unit">
      <p className="spark-unit-model"><strong>{model}</strong> <span>{sparks === 1 ? "one Spark" : `one model across ${sparks} Sparks`}</span></p>
      {sparks > 1 ? <div className="spark-unit-bracket" aria-hidden="true" /> : null}
      <ul className="spark-unit-slabs" data-sparks={sparks}>
        {Array.from({ length: sparks }, (_, index) => (
          <li key={index}>
            <h3>Spark {index + 1}</h3>
            {scale === 0 ? <p className="spark-unit-none">Memory not declared</p> : <>{bar("Measured peak", measuredBytes)}{bar("Declared", declaredBytes)}</>}
          </li>
        ))}
      </ul>
      {measuredBytes !== null ? <p className="spark-unit-note">Measured peak is the most one Spark used on real hardware. Declared is what the recipe states.</p> : null}
    </div>
  );
}
