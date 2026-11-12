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

`pages.yml` is the only workflow that runs on a push to `main`; it also runs
on manual dispatch and hourly (at minute 17). Push runs first call
`ci.yml` and the deploy job waits for it (pull requests run `ci.yml` directly).
Scheduled and dispatched runs skip CI, since the code has not changed since the last main
push that passed it; they only pick up a new recipe release, and the deploy build
still type-checks the shipped code against it. A release dispatch is therefore not
blocked by CI checks that look at other branches. The deploy job:

1. installs the locked frontend dependencies;
2. runs `web/scripts/recipe-release.mjs`, which asks for the
   [`vonk-forge-recipes`](https://github.com/CarstVaartjes/vonk-forge-recipes)
   latest release (the one its publish job marks `--latest`), whatever its
   contract major. It downloads only
   that release's `recipe-library.tar` (one uncompressed tar holding
   `SHA256SUMS`, `SHA256SUMS.sigstore.json` and every file `SHA256SUMS` lists,
   as flat names), rejects any member that is not a unique flat regular file
   (no paths, links, directories or duplicates), verifies `SHA256SUMS` with
   `gh attestation verify` against the
   Sigstore bundle (signer workflow
   `CarstVaartjes/vonk-forge-recipes/.github/workflows/publish.yml`, source ref
   `refs/heads/main`, repository ID `1336002555`, GitHub-hosted runner, and a
   source commit equal to the index's `source_commit`), checks every file in
   the tar against `SHA256SUMS` (all listed files present, nothing unsigned
   extra) and the index's package digests, requires the index's `contract_version` to equal the release tag,
   checks the index envelope (`kind`, `schema_version` and the package schema version)
   against the constants of `catalog-index-v2.schema.json`, the JSON Schema the
   release ships and signs, and writes `web/public/catalog/` (its `release.json`
   records the tag, `contract_version` and `updated_at`);
3. runs `web/scripts/generate-catalog-types.mjs`, which compiles that schema to
   `web/src/api/catalog.generated.d.ts` (git-ignored; `npm --prefix web run catalog`
   does steps 2 and 3 locally). The adapter and every test fixture read the index
   through these types, so `tsc` fails when either reads a field the release's contract
   does not have: the first step of `npm run build` for the shipped adapter, and
   `npm run typecheck` (pull-request CI only) for tests and fixtures;
4. builds `web/dist` (`npm run build` type-checks only shipped code through `web/tsconfig.build.json`; tests and fixtures are checked by `npm run typecheck`, which CI runs on pull requests only. An additive contract minor with a new required field therefore reds PR CI, through the fixtures, but never the deploy) and uploads it as the production Pages deployment with
   Wrangler. A scheduled run whose verified `release.json` equals the one
   already served at `https://<project>.pages.dev/catalog/release.json` skips
   the upload.

Any download, signature, or digest failure fails the job before the upload, so
the previously deployed site keeps serving the last verified catalog. The job
uses only the workflow's `GITHUB_TOKEN`; no extra secret is involved.

The library updates its release in place (same tag, new assets) when recipes
change, so the verified `release.json` changes and the next run redeploys. The
signed files travel in the one `recipe-library.tar` asset, so a run never sees a
half-updated set; if it catches the tar briefly absent while it is replaced, the
download fails and the next run heals it.

To pin a release instead of following the newest one, set the `production`
environment (or repository) variable `VONK_RECIPE_RELEASE` to an exact tag such
as `v4.0.0` and dispatch the workflow; clear it to follow the newest release
again. A pin skips release resolution.

## Following a breaking contract major

The site keeps no copy of the contract major. It always compiles against the schema
that the newest release ships, so a breaking major (a field the adapter or a fixture
reads is renamed, moved or removed) turns the `tsc` step red in every pull request and
push, and in the scheduled and dispatched deploys, until a web fix pull request lands.
The last good site stays online during that gap, and the fix pull request is the only
change needed: nothing in this repository names a major to bump.

Two related cases:

- A new index schema version renames the schema file (`catalog-index-v3.schema.json`).
  `recipe-release.mjs` then fails the fetch step ("is missing from SHA256SUMS"), so CI and
  the deploy are red until `SCHEMA_NAME` follows the new name in the fix pull request.
- An additive minor that adds a required field reds pull-request CI through the test
  fixtures (`npm run typecheck`, run by CI on pull requests only), but never the deploy:
  the deploy build type-checks only shipped code (`web/tsconfig.build.json`) and the
  dispatched or pushed CI run skips the fixture check.

Recipe updates arrive when the `vonk-forge-recipes` publish job dispatches
`pages.yml` (`workflow_dispatch`, through the refresh GitHub App installed on this
repository). The hourly schedule is only the backstop for a failed dispatch; you
can also dispatch `pages.yml` manually. Pull requests run CI only; they do not
publish production.

The site has no per-recipe package download. Recipe pages link "View source"
(and "View adapter source" when the recipe declares a build context) to
`github.com/CarstVaartjes/vonk-forge-recipes/blob/<source_commit>/...`, pinned to
the verified release's signed source commit. Packages are not copied into the
Pages deployment because some exceed Cloudflare Pages' 25 MiB per-file limit;
the Controller fetches packages itself.

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

