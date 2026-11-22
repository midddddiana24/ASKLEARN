import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', timeout: 90000, expect: { timeout: 15000 }, workers: 1,
  use: { baseURL: 'http://127.0.0.1:8001', browserName: 'chromium', channel: process.env.CI ? undefined : 'msedge', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: process.env.ASKLEARN_EXTERNAL_TEST_SERVER ? undefined : {
    command: process.platform === 'win32' ? '..\\.venv\\Scripts\\python.exe -m uvicorn backend.tests.support:app --app-dir .. --port 8001' : '../.venv/bin/python -m uvicorn backend.tests.support:app --app-dir .. --port 8001',
    url: 'http://127.0.0.1:8001/api/health', reuseExistingServer: false, timeout: 60000,
  },
})
