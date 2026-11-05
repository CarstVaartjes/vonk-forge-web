import { useLayoutEffect, useRef, useState } from "react";


const FORMAT = new Intl.NumberFormat("en");
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type Phase = "final" | "armed" | "playing";

// A count that rolls up to its value, digit column by digit column. The first
// render is the true number as plain text; the roll is presentation only and
// plays once when the number scrolls into view. While it rolls, the moving
// digits are aria-hidden and a visually hidden copy of the final number stands
// in, so assistive technology reads the value once. Nothing animates under
// prefers-reduced-motion or without IntersectionObserver.
export function RollingNumber({ value }: { value: number }) {
  const root = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<Phase>("final");
  const characters = FORMAT.format(value).split("");

  useLayoutEffect(() => {
    const element = root.current;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!element || reduced || typeof IntersectionObserver === "undefined") return;
    setPhase("armed");
    let timer: number | undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      // Two frames: the zeroed state must paint before the transition starts.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setPhase("playing");
        timer = window.setTimeout(() => setPhase("final"), 1600);
      }));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [value]);

  const rolling = phase !== "final";
  let column = 0;
  const digits = characters.map((character, position) => {
    if (!/\d/.test(character)) return <span className="rolling-separator" key={position}>{character}</span>;
    const digit = Number(character);
    // At rest a column is just its digit as text; while rolling it holds 0..digit.
    if (!rolling) return <span className="rolling-column" key={position}>{digit}</span>;
    const shown = phase === "playing" ? DIGITS.slice(0, digit + 1) : [0];
    const style = { "--digit": phase === "playing" ? digit : 0, "--column": column++ } as React.CSSProperties;
    return (
      <span className="rolling-column" key={position} style={style}>
        <span className="rolling-strip">{shown.map((value) => <span key={value}>{value}</span>)}</span>
      </span>
    );
  });
  return (
    <span className="rolling-number" data-phase={phase} ref={root}>
      {rolling ? <span className="visually-hidden">{FORMAT.format(value)}</span> : null}
      <span className="rolling-digits" aria-hidden={rolling ? "true" : undefined}>{digits}</span>
    </span>
  );
}
