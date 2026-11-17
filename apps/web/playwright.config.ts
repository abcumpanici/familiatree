import { defineConfig, devices } from '@playwright/test'

const port = 3299
const devPort = 5299

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    {
      name: 'dev-server',
      grep: /@dev/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${devPort}` },
    },
  ],
  webServer: [
    {
      command: `rm -rf test-results/e2e-data && bun run build && PORT=${port} DATA_DIR=test-results/e2e-data bun ../server/src/main.ts`,
      url: `http://localhost:${port}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `API_URL=http://localhost:${port} bunx vite --port ${devPort} --strictPort`,
      url: `http://localhost:${devPort}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
