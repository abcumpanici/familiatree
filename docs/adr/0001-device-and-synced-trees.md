# Device trees and Synced trees, with one TypeScript domain

Status: superseded by [0003](0003-no-accounts-server-only.md). The one TypeScript domain stays; Device trees, Synced trees and accounts are gone.

A tree is either a Device tree (kept only in the owner's browser, no account, never sent to us) or a Synced tree (kept on a hosted or self-hosted server, reachable by the REST API and agents). We offer both because many people will not trust a free service with private family data, while others want backups and agent access. Because the same tree rules must run in the browser and on the server, the whole app is written in TypeScript with one shared domain package; a Java backend would have meant writing those rules twice.

## Consequences

- Agents and the REST API only work with Synced trees.
- Moving a tree between modes uses the same full JSON export file.
- Device trees can be lost if the browser data is cleared; the UI must tell owners to keep an export.
