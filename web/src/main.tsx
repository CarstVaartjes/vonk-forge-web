import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/onest";

import { App, preparePage } from "./app";
import "./styles.css";


const root = document.getElementById("root");

if (root === null) {
  throw new Error("Missing root element");
}

// The first page's code is loaded before the first render, so a direct visit draws no loading state either.
preparePage(window.location.pathname).catch(() => undefined).then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
