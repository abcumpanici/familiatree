# Family Tree

Read `GLOSSARY.md` before naming anything; use its terms in code, UI copy and API. Read `docs/adr/` before changing storage, runtime or the API shape. `docs/PLAN.md` holds product scope.

## Rules

- Every tree change is a domain `Command` applied by `applyCommand` in `packages/domain`. The browser (optimistic edits) and the server run the same function; add new behaviour there first, test first with `bun test`.
- The server persists the `changes` that `applyCommand` returns. A new entity needs a table in `apps/server/src/db/schema.ts`, a migration from `bun run --filter @familytree/server db:generate`, and a case in `store.ts`.
- `skills/familytree-api/SKILL.md` is the single source of `/llms.txt`. Update it with any API change.
- The web app keeps zod and GEDCOM code out of the first load: import `@familytree/domain/schema` and `@familytree/domain/gedcom` with dynamic `import()`. First load budget: 150 KB gzip JS (`bun run build` prints it).
- Every tree lives in the server's SQLite database. There are no accounts and no auth: never add a user, owner or token check (see `docs/adr/0003-no-accounts-server-only.md`).
- UI copy: plain sentence case, the user's words.

## Done means

`bun run check` passes (Biome, `tsc -b`, `bun test`), and for UI changes `bun run e2e` passes (Playwright, files named `*.e2e.ts`).
