# Deferred independent backup and restore

This is defense-in-depth for a future hosted global catalog. It is not part of
the initial local release, and no Railway backup or R2 backup service needs to
be provisioned now.

If the global catalog is later enabled, first configure Railway's native
PostgreSQL volume backups and rehearse a restore. Add an independent encrypted
backup only when longer retention, provider-account recovery, or an external
disaster-recovery boundary is required.

Independent backups must be encrypted before leaving Railway, stored in a
separate account, and restored only into an isolated database. They must never
be confused with the public `vonk-forge-packages` R2 bucket, which distributes
agent Debian packages and is owned by the `vonk-forge` repository's release
workflow.
