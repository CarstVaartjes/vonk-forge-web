import { usePageMeta } from "../page-meta";

export function PrivacyPage() {
  usePageMeta("Privacy", "What the Vonk Forge site measures and what it never collects.");
  return (
    <main className="guide-page privacy-page">
      <section className="guide-hero" aria-labelledby="privacy-title">
        <h1 id="privacy-title">Useful numbers. No visitor profiles.</h1>
        <p>
          This public website uses Cloudflare Web Analytics to understand which pages are useful and
          how well they perform. The statistics are aggregate; they do not identify individual
          visitors.
        </p>
      </section>

      <section className="privacy-content" aria-labelledby="analytics-title">
        <div>
          <h2 id="analytics-title">Traffic and performance, in aggregate.</h2>
        </div>
        <div className="privacy-details">
          <article>
            <h3>Available statistics</h3>
            <p>
              Visits, page views, popular paths, referring sites, country, browser, operating
              system, device type, page load time, and Core Web Vitals.
            </p>
          </article>
          <article>
            <h3>What we do not receive</h3>
            <p>
              No names, email addresses, account identities, cross-site profiles, or lists of
              individual visitors. URL query strings are not included in Web Analytics reports.
            </p>
          </article>
          <article>
            <h3>No analytics cookies</h3>
            <p>
              Cloudflare Web Analytics does not use cookies or local storage for usage metrics and
              does not fingerprint visitors by IP address, user agent, or another identifier.
            </p>
          </article>
          <article>
            <h3>Why Cloudflare instead of GA4</h3>
            <p>
              The site already runs on Cloudflare Pages. Its built-in analytics provide the product
              and performance information we need without adding advertising-oriented tracking or a
              visitor identity layer.
            </p>
          </article>
        </div>
        <p className="privacy-source">
          Read Cloudflare&apos;s current descriptions of
          <a href="https://developers.cloudflare.com/web-analytics/about/">
            {" "}
            Web Analytics privacy
          </a>
          ,
          <a href="https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/">
            {" "}
            reported dimensions
          </a>
          , and
          <a href="https://developers.cloudflare.com/web-analytics/faq/">
            {" "}
            retention and query-string behavior
          </a>
          .
        </p>
      </section>

      <section className="privacy-content" aria-labelledby="device-title">
        <div>
          <h2 id="device-title">Stored on your device.</h2>
        </div>
        <div className="privacy-details">
          <article>
            <h3>
              <code>vonk-theme</code>
            </h3>
            <p>The light or dark theme you chose, in local storage.</p>
          </article>
          <article>
            <h3>
              <code>vonk-my-sparks</code>
            </h3>
            <p>
              Your Spark count and model type from the setup picker, in local storage, so the recipe
              list starts from them next time.
            </p>
          </article>
          <article>
            <h3>
              <code>vonk-chunk-reload</code>
            </h3>
            <p>
              A flag in session storage that lets the site reload once after an update, and only
              once. It is gone when you close the tab.
            </p>
          </article>
          <article>
            <h3>Never sent</h3>
            <p>
              None of these leaves your browser. Clearing this site&apos;s data in your browser
              removes them.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
