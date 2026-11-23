import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/onest";

import { App, preparePage } from "./app";
import "./styles/index.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Missing root element");
}

// A chunk that cannot be loaded (the site was redeployed since this page opened) is cured by one full load of
// the current address; the flag keeps a persistent failure from looping.
const RELOADED = "vonk-chunk-reload";
function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOADED)) return false;
    sessionStorage.setItem(RELOADED, "1");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

// The first page's code is loaded before the first render, so a direct visit draws no loading state either.
preparePage(window.location.pathname)
  .then(
    () => {
      try {
        sessionStorage.removeItem(RELOADED);
      } catch {
        /* storage unavailable */
      }
    },
    () => !reloadOnce(),
  )
  .then((render) => {
    if (render === false) return;
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
