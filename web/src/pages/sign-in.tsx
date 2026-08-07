import { useEffect, useState } from "react";

import { getProviders } from "../api/client";


export function SignInPage() {
  const [providers, setProviders] = useState<string[] | null>(null);
  const returnTo = `${window.location.pathname}${window.location.search}`;
  useEffect(() => {
    getProviders().then(setProviders).catch(() => setProviders([]));
  }, []);
  return (
    <main className="workspace-page narrow">
      <p className="eyebrow">Publisher identity</p>
      <h1>Sign in to your forge.</h1>
      <p>
        OAuth proves who controls a publisher namespace. Vonk Forge discards
        provider access tokens after it verifies your identity.
      </p>
      {!providers ? <p role="status">Loading sign-in providers…</p> : null}
      {providers?.map((provider) => (
        <a
          className="button primary provider-button"
          href={`/v1/auth/${provider}/start?return_to=${encodeURIComponent(returnTo)}`}
          key={provider}
        >
          Continue with {provider === "github" ? "GitHub" : "Google"}
        </a>
      ))}
      {providers?.length === 0 ? (
        <div className="status-panel error">No OAuth provider is configured.</div>
      ) : null}
    </main>
  );
}
