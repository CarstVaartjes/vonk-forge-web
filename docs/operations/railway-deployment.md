# Railway deployment runbook

## Production shape

Only `web` has a public domain. Caddy serves immutable frontend assets and
reverse-proxies `/v1/*` to `api.railway.internal:8000`. The API, validation
worker, migration job, backup job, restore drill, primary PostgreSQL, and
restore PostgreSQL have no public domain. Railway private networking is scoped
per environment, so staging and production cannot reach each other.

Create two separate Railway projects, one for staging and one for production.
This is a security boundary: Railway stores a Docker image source on the
service itself rather than per environment, so staging and production must not
share services. Create these services in the corresponding environment of each
project:

| Service | Config source | Public | Runtime |
| --- | --- | --- | --- |
| `web` | `deploy/railway/web.toml` | `vonkforge.ai` only in production | always on |
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

Backup variables and the separate restore URL are in the backup runbook. Never
copy the production session secret, OAuth secrets, or database credentials into
staging. Duplicate service topology, then replace every secret.

## First release and promotion

1. Create the production project, create a separate staging project with the
   same topology, and give each project independent databases and secrets.
2. Bootstrap every code service from its config file, then disconnect its
   repository source. Make the four GHCR packages public, or configure Railway
   GHCR credentials with `read:packages` on a Pro workspace.
3. Set `RAILWAY_STAGING_PROJECT_ID` and `RAILWAY_PRODUCTION_PROJECT_ID` in the
   matching protected GitHub environments, with a project-scoped token for
   each. Run the protected deploy workflow. It verifies each Cosign signature,
   connects `migration` and the application services to exact image digests,
   and never uploads source with `railway up`.
4. The workflow requires a new `migration` deployment to complete successfully
   before it changes application services, then waits for every new deployment
   before smoke testing or allowing production promotion.
5. Verify `api`, `worker`, and `web` through `/health/live` and
   `/health/ready` through the public web domain.
6. Sign in with a staging OAuth account, claim a staging namespace, upload the
   public test recipe/evidence, wait for registry validation, publish it, find
   it anonymously, then hide and unhide it as a staging moderator.
7. Run a backup and restore drill and retain the object name plus verifier JSON.
8. Record the commit, revision hash, request IDs, and restore object in the
   release evidence. Only then approve the protected GitHub `production`
   environment and repeat migration before the long-running services.

The deploy workflow uses Railway project tokens and projects scoped separately
to staging and production. Configure required reviewers for the GitHub
`production` environment.

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
