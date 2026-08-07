# Catalog moderation

Vonk Forge moderation changes visibility, never published recipe bytes. Reports,
revision actions, and publisher actions retain timestamps, actors, reasons, and
append-only sequence numbers. Database triggers reject rewriting or deleting the
moderation trail, while separate triggers protect recipe revisions themselves.

## Roles and confirmation

Use `vonk-catalog-admin set-system-role` to grant a dedicated OAuth identity the
`moderator` or `admin` role. Publisher membership does not grant moderation.
Community hide/unhide, warning, and appeal notes require a moderator. Publisher
suspension and changes to official revisions require an administrator, a session
created by sign-in within ten minutes, and explicit step-up confirmation.

## Response procedure

1. Preserve the report, exact revision hash, registry digest, observed registry
   metadata, and relevant logs. Do not pull or execute a suspected image.
2. For credible malware or image compromise, add a compromise warning and hide
   the revision. Suspend the publisher only if multiple entries or account
   compromise make that necessary.
3. Tell the publisher the reason and the immutable revision involved. Record any
   appeal or supplied evidence as an appeal note.
4. After review, use `unhide`, `warning_clear`, or `reinstate`. Reversal appends a
   new event; it does not erase the incident.
5. If an image digest is compromised, it cannot be replaced inside the existing
   revision. The publisher must publish a newly validated revision with a new
   digest.

Public list and detail endpoints omit hidden revisions and suspended publishers.
Warnings remain visible on otherwise public recipes and are explicitly described
as moderation notices, not changes to publisher-submitted evidence.
