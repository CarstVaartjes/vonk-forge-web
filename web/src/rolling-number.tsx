import { useLayoutEffect, useRef, useState } from "react";

const FORMAT = new Intl.NumberFormat("en");
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type Roll = { from: string; stage: "start" | "go" };

// A count that is plain text from the first render: the real number, never a count-up from zero.
// It rolls only when `value` changes afterwards (the visitor picked another Spark count). Each
// rolling digit is a slot exactly 1em tall holding a strip of 0-9 moved by whole ems, so no
// neighbouring digit shows. While rolling, the digits are aria-hidden and a visually hidden copy of
// the new number stands in. Nothing animates under prefers-reduced-motion.
export function RollingNumber({ value }: { value: number }) {
  const previous = useRef(value);
  const [roll, setRoll] = useState<Roll | null>(null);
  const text = FORMAT.format(value);

  useLayoutEffect(() => {
    const from = FORMAT.format(previous.current);
    previous.current = value;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || from === FORMAT.format(value)) return;
    setRoll({ from, stage: "start" });
    let timer: number | undefined;
    // Two frames: the old digits must paint before the transition starts.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setRoll({ from, stage: "go" });
      timer = window.setTimeout(() => setRoll(null), 1300);
    }));
    return () => window.clearTimeout(timer);
  }, [value]);

  if (!roll) return <span className="rolling-number">{text}</span>;

  const old = roll.from.replace(/\D/g, "").padStart(text.replace(/\D/g, "").length, "0");
  let column = 0;
  const digits = text.split("").map((character, position) => {
    if (!/\d/.test(character)) return <span className="rolling-separator" key={position}>{character}</span>;
    const start = Number(old.slice(-(text.replace(/\D/g, "").length))[column] ?? 0);
    const style = { "--digit": roll.stage === "go" ? Number(character) : start, "--column": column++ } as React.CSSProperties;
    return (
      <span className="rolling-column" key={position}>
        <span className="rolling-strip" style={style}>{DIGITS.map((digit) => <span key={digit}>{digit}</span>)}</span>
      </span>
    );
  });
  return (
    <span className="rolling-number" data-phase={roll.stage}>
      <span className="visually-hidden">{text}</span>
      <span className="rolling-digits" aria-hidden="true">{digits}</span>
    </span>
  );
}
