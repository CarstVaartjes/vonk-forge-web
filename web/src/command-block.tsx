import { useEffect, useRef, useState } from "react";

// The one command block on the site: a label, the command in a strip that
// scrolls inside itself behind a drawn "$" prompt (off for code that is not a shell
// command), and a Copy button whose text turns to "Copied", announced politely.
export function CommandBlock({ children, label, prompt = true, compact = false }: { children: string; label: string; prompt?: boolean; compact?: boolean }) {
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
    <div className={compact ? "command-block compact" : "command-block"}>
      <div className="command-block-head">
        <span>{label}</span>
        <button type="button" className="command-copy" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
        <span className="visually-hidden" role="status">{copied ? "Copied" : ""}</span>
      </div>
      <pre tabIndex={0}><code className={prompt ? "prompted" : undefined}>{children}</code></pre>
    </div>
  );
}
