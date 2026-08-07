# Cloudflare Pages deployment

Cloudflare Pages is the production frontend host for Vonk Forge Web. The
initial local product does not require this repository, its global API, or
Railway. The future global API and validation worker can be enabled separately
when the shared catalog is needed.

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

   `VITE_CATALOG_API_URL` is optional while the global API is deferred. Set it
   later to `https://api.vonkforge.ai` when the Railway backend exists.
4. In the Pages project, add the custom domain `vonkforge.ai`. Because this is
   an apex domain, the zone must use Cloudflare nameservers; Cloudflare then
   provisions the Pages DNS and certificate.

## Releases

Every push to `main` and every manual dispatch runs `pages.yml`. It installs
the locked frontend dependencies, builds `web/dist`, and uploads that directory
as the production Pages deployment with Wrangler. Pull requests run CI only;
they do not publish production.

The frontend uses `/v1/*` when `VITE_CATALOG_API_URL` is empty and uses the
configured absolute API origin when it is set. Until the global backend exists,
the Pages site is only a static frontend shell; local recipe authoring and
execution remain in `vonk-forge`.

The `_headers` and `_redirects` files under `web/public` provide the static
security headers, immutable asset caching, and SPA fallback previously supplied
by the local development gateway.
