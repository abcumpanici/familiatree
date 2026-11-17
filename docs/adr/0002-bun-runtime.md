# Bun as package manager, runtime and test runner

We use Bun for installs, workspaces, running TypeScript, the server, SQLite (`bun:sqlite`) and unit tests (`bun test`), because the main goal is a very fast build and feedback loop. Vite still serves the web app for hot reload, Playwright runs the few end-to-end flows, Biome does lint and format, and tsgo does type checks. The server uses Bun-only APIs, so moving to Node later would mean swapping the SQLite driver, the test runner and the server entry point.

## Considered Options

- pnpm + Node + Vitest: the familiar stack from other projects, but slower installs, a native SQLite module and a build step for TypeScript.
- Deno: fast and TypeScript-first, but a smaller ecosystem for this stack.
