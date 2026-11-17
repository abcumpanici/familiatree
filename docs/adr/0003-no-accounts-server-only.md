# No accounts, and every tree on the server

The app is only self-hosted, and the person who runs it backs up its data folder. So we removed accounts, sessions, API tokens and Device trees: every tree lives in the server's SQLite database, and the web app, the REST API and agents reach it with no sign-in. Accounts protected a hosted service that we no longer plan; for a family on their own server they only added passwords to forget, and Device trees added a second storage path, a move flow and a way to lose data when browser storage was cleared. The operator protects the server with their own network, VPN or reverse proxy. This supersedes [0001](0001-device-and-synced-trees.md); the one shared TypeScript domain from 0001 stays.

## Consequences

- Anyone who can reach the server can see and change every tree. The README warns operators not to put it on the public internet without their own auth in front.
- `MAX_TREES` limits the whole server, not one user. There is no login rate limit, because there is no login.
- The `0001_remove_accounts` migration drops `users`, `sessions` and `api_tokens` and rebuilds `trees` without `owner_id`. Migrations run with foreign keys off, because the drop of `users` would otherwise cascade-delete every tree.
- On start, the web app moves trees that an older version left in IndexedDB to the server with the import endpoint, then deletes them from the browser.
- Backups are the operator's job: copy the SQLite file safely, or download a JSON or GEDCOM export per tree.
