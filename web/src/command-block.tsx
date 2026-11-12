import { useEffect, useRef, useState } from "react";

// The one command block on the site: a label, the command in a strip that
// scrolls inside itself, and a Copy button that announces "Copied" politely.
export function CommandBlock({ children, label }: { children: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => setCopied(false));
  };

  return (
    <div className="command-block">
      <div className="command-block-head">
        <span>{label}</span>
        <button type="button" className="command-copy" onClick={copy} aria-label={`Copy ${label.toLowerCase()} command`}>
          Copy
        </button>
        <span className="visually-hidden" role="status">{copied ? "Copied" : ""}</span>
      </div>
      <pre tabIndex={0}><code>{children}</code></pre>
    </div>
  );
}
