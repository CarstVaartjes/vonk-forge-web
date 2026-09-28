# Cloudflare Pages deployment

Cloudflare Pages is the only production host for Vonk Forge Web. The site is
fully static: the build output in `web/dist` is the whole deployment, including
the verified recipe-library catalog under `/catalog/`. The
local product does not depend on this site being available.

The live production site is [vonkforge.ai](https://vonkforge.ai). Cloudflare's
default Pages hostname is `vonk-forge-web.pages.dev`.

## One-time Cloudflare setup

1. In Cloudflare Workers & Pages, create a Pages project named
   `vonk-forge-web` using **Direct Upload**. The GitHub Actions workflow owns
   the build and upload; do not configure a second Git integration for the same
   project.
2. Create a narrowly scoped Cloudflare API token with Account → Cloudflare
   Pages → Edit permission.
3. In the GitHub `production` environment, add:

   ```text
   Secret:   CLOUDFLARE_ACCOUNT_ID
   Secret:   CLOUDFLARE_API_TOKEN
   Variable: CLOUDFLARE_PAGES_PROJECT=vonk-forge-web
   ```
4. In the Pages project, add the custom domain `vonkforge.ai`. Because this is
   an apex domain, the zone must use Cloudflare nameservers; Cloudflare then
   provisions the Pages DNS and certificate.
5. In the Pages project, open **Metrics** and select **Enable** under **Web
   Analytics**. Cloudflare injects its beacon into the next deployment. Keep
   automatic installation enabled for the complete `vonkforge.ai` hostname.

6. In the `vonkforge.ai` zone, turn off **JavaScript detections**
   (**Security → Settings → Bot traffic → JavaScript detections → Off**; on the
   older dashboard, **Security → Bots → Configure → JavaScript Detections**).
   See [Content Security Policy](#content-security-policy) below.

## Visitor analytics

Vonk Forge Web uses Cloudflare Web Analytics instead of Google Analytics. It
reports aggregate visits, page views, paths, referrers, country, browser,
operating system, device type, page-load performance, and Core Web Vitals. It
does not use cookies or local storage for analytics, does not fingerprint
individuals, and does not expose names, email addresses, or an individual
visitor list. The public disclosure is at `/privacy`.

View results in **Cloudflare dashboard → Web Analytics → vonkforge.ai**. The
repository's Content Security Policy permits only the official
`static.cloudflareinsights.com` beacon and its reporting endpoint. Do not add a
second analytics script without updating the privacy disclosure and reviewing
whether consent is required.

After enabling Web Analytics, publish a new deployment and verify from a region
included by the selected Cloudflare analytics policy:

```bash
curl -fsSL https://vonkforge.ai | grep -F 'static.cloudflareinsights.com/beacon.min.js'
```

Cloudflare can automatically omit the beacon for regions excluded by an
account's analytics policy, so a missing snippet from such a region is not by
itself proof that the project-level setting is disabled. Confirm the setting
and incoming data in the dashboard.

## Releases

`pages.yml` runs on every push to `main`, on manual dispatch, and hourly (at
minute 17). It:

1. installs the locked frontend dependencies;
2. runs `web/scripts/recipe-release.mjs`, which lists the
   [`vonk-forge-recipes`](https://github.com/CarstVaartjes/vonk-forge-recipes)
   releases, downloads the newest non-draft release whose tag major equals
   the supported contract major (`SUPPORTED_CONTRACT_MAJOR`), verifies `SHA256SUMS` with `gh attestation verify` against the
   Sigstore bundle (signer workflow
   `CarstVaartjes/vonk-forge-recipes/.github/workflows/publish.yml`, source ref
   `refs/heads/main`, repository ID `1336002555`, GitHub-hosted runner, and a
   source commit equal to the index's `source_commit`), checks
   `catalog-index.json` and every package digest the index names against
   `SHA256SUMS`, requires the index's `contract_version` to have that major,
   and writes `web/public/catalog/` (its `release.json` records the tag,
   `contract_version` and `updated_at`);
3. builds `web/dist` and uploads it as the production Pages deployment with
   Wrangler. A scheduled run whose verified `release.json` equals the one
   already served at `https://<project>.pages.dev/catalog/release.json` skips
   the upload.

Any download, signature, or digest failure fails the job before the upload, so
the previously deployed site keeps serving the last verified catalog. The job
uses only the workflow's `GITHUB_TOKEN`; no extra secret is involved.

The library updates its release in place (same tag, new assets) when recipes
change, so the verified `release.json` changes and the next run redeploys. A
run that catches the assets mid-replacement fails verification and the next
run heals it.

To pin a release instead of following the newest one, set the `production`
environment (or repository) variable `VONK_RECIPE_RELEASE` to an exact tag such
as `v2.0.0` and dispatch the workflow; clear it to follow the newest release
again.

Recipe updates arrive through the hourly schedule. `vonk-forge-recipes`
does not hold a token that could send a `repository_dispatch` to this
repository, so polling is the deliberate choice; dispatch `pages.yml` manually
to publish an update immediately. Pull requests run CI only; they do not
publish production.

Package download links go to the verified release's assets on
`github.com/CarstVaartjes/vonk-forge-recipes/releases/download/<tag>/`, a plain
browser navigation that needs no CORS. Packages are not copied into the Pages
deployment because some exceed Cloudflare Pages' 25 MiB per-file limit.

The `_headers` and `_redirects` files under `web/public` provide the security
headers (the Content Security Policy's `connect-src` allows only this origin and
the Cloudflare analytics endpoint), immutable asset caching, and SPA fallback.

## Content Security Policy

The CSP in `web/public/_headers` allows scripts only from this origin and the
Cloudflare Web Analytics beacon; it never allows `'unsafe-inline'`. The build
emits no inline scripts, so nothing in `web/dist` needs a hash.

Cloudflare's zone-level **JavaScript detections** (part of Bot Fight Mode /
bot protection) injects an inline script before `</body>` that loads
`/cdn-cgi/challenge-platform/scripts/jsd/main.js`. The CSP blocks it and the
browser console shows `Executing inline script violates ... script-src`. The
script embeds the request's Ray ID and timestamp
(`window.__CF$cv$params={r:'…',t:'…'}`), so its hash changes on every response
and cannot be allowed by hash, and a static Pages site has no per-request
nonce. The site does not rely on bot detection, so keep the feature off (setup
step 6). Check that no inline script is injected:

```bash
curl -fsSL https://vonkforge.ai | grep -c 'challenge-platform'   # expect 0
```

