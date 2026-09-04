import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 43817);
const previewURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = previewURL ?? `http://localhost:${port}`;
const browserName =
  process.env.PLAYWRIGHT_BROWSER === 'webkit' ? 'webkit' : 'chromium';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'output/playwright/test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'output/playwright/report', open: 'never' }],
  ],
  use: {
    ...devices['Desktop Edge'],
    browserName,
    baseURL,
    channel:
      browserName === 'chromium' && !process.env.CI ? 'msedge' : undefined,
    trace: 'retain-on-failure',
  },
  webServer: previewURL
    ? undefined
    : {
        command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
