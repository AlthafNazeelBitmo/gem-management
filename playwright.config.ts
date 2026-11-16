import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const directory = mkdtempSync(path.join(tmpdir(), "gem-browser-"));
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: "http://127.0.0.1:5382",
    headless: true,
    actionTimeout: 10000,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `API_PORT=3420 DATA_DIR='${directory}' node server/index.mjs`,
      url: "http://127.0.0.1:3420/api/health",
      reuseExistingServer: true,
    },
    {
      command:
        "GEM_API_PROXY=http://127.0.0.1:3420 npx vite --host 127.0.0.1 --port 5382 --strictPort",
      url: "http://127.0.0.1:5382",
      reuseExistingServer: true,
    },
  ],
  reporter: "list",
});
