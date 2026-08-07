# Deferred Railway global-backend runbook

Railway is not part of the initial Vonk Forge release. Do not provision this
runbook yet. Local PostgreSQL remains authoritative for recipe authoring,
imports, installation, placement, admission, and execution.

When the global catalog is enabled, Cloudflare Pages will serve the static
frontend at `vonkforge.ai`, while Railway will host only the global backend.
The current frontend deployment is documented in
[Cloudflare Pages deployment](cloudflare-pages.md).

Railway services would be:

| Service | Runtime | Public |
| --- | --- | --- |
| `api` | always-on catalog API | `api.vonkforge.ai` |
| `worker` | always-on catalog validation worker | no |
| `migration` | one-shot schema migration per release | no |
| `postgres` | Railway PostgreSQL | no |

The global backend will not run recipe containers, model weights, or the NAS
Caddy boundary. The worker validates submitted source manifests, immutable OCI
artifact metadata, resource envelopes, and publisher evidence; it never
executes a submitted workload.

## Future variables

Use Railway private reference variables for the database. The SQLAlchemy URL
must explicitly select psycopg 3:

```text
VONK_DATABASE_URL=postgresql+psycopg://${{postgres.PGUSER}}:${{postgres.PGPASSWORD}}@${{postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{postgres.PGDATABASE}}
```

Set on `api`:

```text
PORT=8000
VONK_PRODUCTION=true
VONK_PUBLIC_BASE_URL=https://api.vonkforge.ai
VONK_SESSION_SECRET=<Railway secret>
VONK_CORS_ALLOWED_ORIGINS=["https://vonkforge.ai"]
VONK_TRUSTED_PROXY_HOPS=1
VONK_GITHUB_CLIENT_ID=<provider value>
VONK_GITHUB_CLIENT_SECRET=<Railway secret>
VONK_GOOGLE_CLIENT_ID=<provider value, optional>
VONK_GOOGLE_CLIENT_SECRET=<Railway secret, optional>
VONK_FOUNDER_OAUTH_PROVIDER=github
VONK_FOUNDER_OAUTH_SUBJECT=<immutable provider subject>
```

Set the database reference on `api`, `worker`, and `migration`. OAuth callback
URLs will use the API origin:

```text
https://api.vonkforge.ai/v1/auth/github/callback
https://api.vonkforge.ai/v1/auth/google/callback
```

Railway native PostgreSQL volume backups should be enabled before considering
an independent encrypted backup service. The deferred backup design is kept
separate in [backup and restore](backup-restore.md).

## Future release wiring

When this backend is needed:

1. Create one Railway production project and PostgreSQL service.
2. Create `api`, `worker`, and `migration` from the repository's future
   configuration files.
3. Configure the production variables and private networking.
4. Set the project-scoped Railway token and project ID in GitHub's protected
   production environment.
5. Deploy migrations first, then the API and worker images.
6. Publish the frontend through Cloudflare Pages and set its API base URL to
   `https://api.vonkforge.ai`.

The local control plane must continue to work if this entire hosted backend is
unavailable.
