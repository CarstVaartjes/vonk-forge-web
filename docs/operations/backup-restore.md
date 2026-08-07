# Encrypted backup and restore drills

The initial objectives are a 24-hour recovery point and four-hour recovery
time. Backups leave Railway before the cron exits, are encrypted before upload,
and are useless without an offline age identity. A Railway volume or snapshot
is not the independent copy.

## One-time setup

1. Generate an age identity on an offline administrator machine:

   ```bash
   age-keygen -o vonk-backup.agekey
   age-keygen -y vonk-backup.agekey
   ```

2. Put only the printed public recipient in `BACKUP_AGE_RECIPIENT` on the daily
   backup service. Store the private identity in a password manager and a second
   offline location. Give it only to the monthly restore service as the masked
   `BACKUP_AGE_IDENTITY` secret.
3. Create an S3-compatible bucket in an account independent of Railway. Give
   backup credentials write/list access and restore credentials read/list
   access. Configure rclone through secret environment variables and set
   `BACKUP_REMOTE`, for example `offsite:vonk-prod`.
4. Enable bucket versioning, object lock where available, and a provider-side
   lifecycle retaining 35 daily objects and 12 monthly objects. Deny permanent
   deletion to the runtime credentials. Alert if `latest.txt` or the daily
   encrypted object is missing after 03:00 UTC.
5. Provision `restore-postgres` separately. Its database name must contain
   `restore` or `drill`; it must have no public domain and no application
   services may reference it.

## Daily backup

The `backup` cron executes `scripts/backup-database`. It first verifies current
canonical revision hashes and records row counts plus an aggregate of immutable
revision identities. It creates a PostgreSQL custom dump, checks its table of
contents, bundles the manifest, encrypts the bundle with age, uploads it with
rclone, and finally advances `latest.txt`. Plaintext exists only in the
container's temporary filesystem and is removed on exit.

Required variables are `DATABASE_URL`, `BACKUP_REMOTE`,
`BACKUP_AGE_RECIPIENT`, and the rclone provider secrets. A successful final log
line is structured as `backup.completed`. Treat absence of that line as a
failure even if Railway reports the container started.

## Monthly restore

The `restore` cron executes `scripts/restore-database` against only
`RESTORE_DATABASE_URL` and refuses to proceed unless
`VONK_CONFIRM_ISOLATED_RESTORE=YES`. It validates the object name, decrypts an
authenticated archive, accepts exactly `catalog.dump` and `manifest.json`,
checks the target database name, restores with `--exit-on-error`, and compares:

- row counts for identity, publisher, recipe, revision, search, validation,
  evidence, and moderation tables;
- the aggregate of every stored immutable revision identity/hash; and
- deterministic canonical JSON hashes for up to 100 revisions.

The final line must be `restore.verified`. Retain it with the Railway deployment
ID and object name for at least 12 months. Investigate any mismatch before the
next production deployment. Do not automatically delete the restored database;
keep it isolated until an operator has reviewed the evidence, then recreate it
for the next drill.

## Local rehearsal

Build the operations image and pass credentials only at runtime:

```bash
docker build -f Dockerfile.backup -t vonk-catalog-backup:test .
docker run --rm --read-only --tmpfs /tmp --env-file backup.env \
  vonk-catalog-backup:test /app/scripts/backup-database
docker run --rm --read-only --tmpfs /tmp --env-file restore.env \
  vonk-catalog-backup:test /app/scripts/restore-database
```

Never put either env file in the repository. Test a specific object by setting
`BACKUP_OBJECT=vonk-catalog-YYYYMMDDTHHMMSSZ.tar.age`.
