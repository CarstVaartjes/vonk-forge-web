# Railway deployment runbook

## Production shape

Only `web` has a public domain. Caddy serves immutable frontend assets and
reverse-proxies `/v1/*` to `api.railway.internal:8000`. The API, validation
worker, migration job, backup job, restore drill, primary PostgreSQL, and
restore PostgreSQL have no public domain.

The initial deployment uses one production Railway project and one production
environment. This keeps the first release small and inexpensive while retaining
the same private-network boundary. A separate staging project can be added
later; it is deliberately not part of the current release path.

Create these services in the production project:

| Service | Config source | Public | Runtime |
| --- | --- | --- | --- |
| `web` | `deploy/railway/web.toml` | `vonkforge.ai` | always on |
| `api` | `deploy/railway/api.toml` | no | always on, port 8000 |
| `worker` | `deploy/railway/worker.toml` | no | always on |
| `migration` | `deploy/railway/migration.toml` | no | one-shot per release |
| `backup` | `deploy/railway/backup.toml` | no | daily UTC cron |
| `restore` | `deploy/railway/restore.toml` | no | monthly UTC cron |
| `postgres` | Railway PostgreSQL | no | primary database |
| `restore-postgres` | Railway PostgreSQL | no | isolated drill target |

Use the files above to bootstrap each service's deploy settings, start command,
health check, and cron schedule. The release workflow then changes each service
source to the signed GHCR digest with `railway service source connect --image`;
Railway skips its build phase for an image source. Keep the settings on the
service when disconnecting the repository source. Cron services must exit, and
Railway skips a schedule while its previous execution remains active. The
behavior follows Railway's current [service-source CLI](https://docs.railway.com/cli/service),
[Docker-image service](https://docs.railway.com/services), and
[cron contract](https://docs.railway.com/cron-jobs).

## Variables

Use Railway reference variables for private database coordinates. Do not use a
public database URL. The SQLAlchemy URL must explicitly select psycopg 3:

```text
VONK_DATABASE_URL=postgresql+psycopg://${{postgres.PGUSER}}:${{postgres.PGPASSWORD}}@${{postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{postgres.PGDATABASE}}
```

Set on `api`:

```text
PORT=8000
VONK_PRODUCTION=true
VONK_PUBLIC_BASE_URL=https://vonkforge.ai
VONK_SESSION_SECRET=<64 random bytes, stored as a Railway secret>
VONK_CORS_ALLOWED_ORIGINS=["https://vonkforge.ai"]
VONK_TRUSTED_PROXY_HOPS=1
VONK_GITHUB_CLIENT_ID=<provider value>
VONK_GITHUB_CLIENT_SECRET=<Railway secret>
VONK_GOOGLE_CLIENT_ID=<provider value, optional>
VONK_GOOGLE_CLIENT_SECRET=<Railway secret, optional>
VONK_FOUNDER_OAUTH_PROVIDER=github
VONK_FOUNDER_OAUTH_SUBJECT=<immutable provider subject>
```

Set the database URL on `api`, `worker`, `migration`, and `backup`. Set on
`web`:

```text
PORT=8080
VONK_API_UPSTREAM=http://api.railway.internal:8000
```

Configure OAuth callback URLs as
`https://vonkforge.ai/v1/auth/github/callback` and the equivalent Google path.
The browser stays same-origin; Caddy is the only public ingress.

Backup variables and the separate restore URL are in the backup runbook. Keep
production session, OAuth, and database secrets in Railway's production secret
store; do not put them in GitHub variables or image layers.

## First production release

1. Create one Railway project with a production environment, add the primary
   PostgreSQL service and an isolated `restore-postgres` service, and configure
   independent production secrets.
2. Bootstrap every code service from its config file, then disconnect its
   repository source. Make the four GHCR packages public, or configure Railway
   GHCR credentials with `read:packages` on a Pro workspace.
3. Set `RAILWAY_PRODUCTION_PROJECT_ID` and `RAILWAY_PRODUCTION_TOKEN` in the
   protected GitHub `production` environment. A push to `main` deploys directly
   to production; the same path can be started manually with workflow dispatch.
   It verifies each Cosign signature,
   connects `migration` and the application services to exact image digests,
   and never uploads source with `railway up`.
4. The workflow requires a new `migration` deployment to complete successfully
   before it changes application services, then waits for every new deployment
   before running the public smoke check.
5. Verify `api`, `worker`, and `web` through `/health/live` and
   `/health/ready` through the public web domain.
6. Sign in with the founder OAuth account, claim the founder namespace, upload a
   public test recipe/evidence, wait for registry validation, publish it, find
   it anonymously, then hide and unhide it as the founder moderator.
7. Run a backup and restore drill and retain the object name plus verifier JSON.
8. Record the commit, revision hash, request IDs, and restore object in the
   release evidence. Add a separate staging project later only when a pre-
   production validation environment is worth the additional cost and
   operational surface.

The deploy workflow uses one project-scoped Railway token for the production
project. Configure required reviewers for the GitHub `production` environment
if a human approval gate is desired; no staging approval is required today.

## Network boundary

Railway private DNS (`*.railway.internal`) protects internal service traffic;
do not create public domains for API, worker, or databases. The worker's HTTP
client accepts public HTTPS OCI endpoints only, ignores ambient proxies,
re-resolves every redirect, and rejects loopback, private, link-local, and
metadata addresses.

Railway currently provides outbound networking and optional static outbound
IPs, but not a destination/port allowlist in config-as-code. If policy requires
a network-enforced `DNS + public HTTPS only` boundary, route the worker through
an independently controlled egress proxy/firewall and allow only the worker's
static outbound IP. The application checks remain mandatory because a network
firewall alone does not stop registry redirects or DNS rebinding. See Railway's
[outbound networking](https://docs.railway.com/networking/outbound-networking)
and [private networking](https://docs.railway.com/networking/private-networking/how-it-works)
references.

## Rollback

Published revisions and migrations are forward-only. Roll back application
containers to the previous signed commit only after confirming the old code can
read the current schema. Never reverse a migration by restoring production over
the live database. For a data incident, stop writes, preserve evidence, and use
the independently encrypted backup under the restore runbook.
