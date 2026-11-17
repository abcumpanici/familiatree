# Plan

A simple, private, beautiful family tree. Free and open source (AGPL-3.0). Self-hosted with one container.

See [GLOSSARY.md](../GLOSSARY.md) for the words we use and [adr/](adr/) for the big decisions.

## Product

- Self-hosted only. Every Tree lives in the server's SQLite database. A server can hold several Trees.
- No accounts and no sign-in. Everyone who can reach the server can see and change every Tree. The operator protects the server with their own network, VPN or reverse proxy (see [adr/0003](adr/0003-no-accounts-server-only.md)).
- Backups: the operator backs up the data folder. Each Tree also downloads as JSON or GEDCOM.
- No research features: no DNA, sources, citations or matching.

## Data

- Person: First names (required), Surname, Birth surname, gender (male, female, other, unknown; optional), born date and place, died (yes/no, with optional date and place), one photo, Story (Markdown: bold, italic, lists, links).
- Dates: full date, month, year, or "about" a year.
- Parent link: child to parent, kind birth, adopted, step or foster. At most 2 birth parents.
- Partnership: two persons, married or not, optional start and end with date and place. A person can have many.
- Children are grouped under the Partnership of their two parents by the app, not by hand.
- Home person: the tree view opens on them. At first, the first person added.
- Export and import: full JSON and GEDCOM.

## UI

- Hourglass tree around the Home person: ancestors above, descendants below. Click a person to centre them. Pan and zoom.
- Person details in a side panel on desktop and a bottom sheet on phones.
- Warm look: Fraunces for names and headings, Inter for UI text. Three warm palettes in the prototype (Terracotta, Forest, Honey), each with dark mode; we keep one.
- Rich animation: GSAP (a FLIP glide to re-centre, DrawSVG for lines, timelines for entry); View Transitions API for screen changes. Respect reduced motion.
- Phone first. Dark mode. English only, ready for translations.

## Speed targets

- A Tree with 2,000 persons pans and zooms smoothly.
- First load under 150 KB of JavaScript (gzip).
- The app installs as a PWA.

## Agents

- The REST API is open, like the web app: no tokens.
- REST API, OpenAPI at `/api/openapi.json`, Swagger UI at `/api/docs`, and an agent reference at `/llms.txt` (also a skill file in the repo).
- No MCP server for now.

## Stack

- Bun monorepo: `apps/web` (React, Vite, Tailwind 4), `apps/server` (Hono, Drizzle, `bun:sqlite`, Zod), `packages/domain` (shared rules and types).
- TypeScript strict, type checked with tsgo. Biome for lint and format. `bun test` (test first) for domain and API, Playwright for a few UI flows.
- One `bun run check` runs Biome, types and tests.

## Order of work

1. Bun monorepo setup.
2. Clickable prototype that becomes the real web app: tree view, person panel, sample data in memory, three palettes.
3. Domain package with tests.
4. Device trees (IndexedDB, offline, export and import). Removed later: see step 7.
5. Server, REST API, OpenAPI, accounts, Synced trees, tokens, `/llms.txt`.
6. Docker image for self-hosting.
7. Remove accounts, tokens and Device trees. Every Tree lives on the server. Old browser trees move to the server once.

## Later

Name and domain, photo galleries, MCP server.
