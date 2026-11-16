import { defineConfig } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const directory = mkdtempSync(path.join(tmpdir(), "gem-browser-"));
// An existing empty file prevents the database loader from copying workstation or demo records.
writeFileSync(path.join(directory, "gem.sqlite"), "", { mode: 0o600 });
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
      command: `APP_ORIGIN=http://127.0.0.1:5382 API_PORT=3420 DATA_DIR='${directory}' node server/index.mjs`,
      url: "http://127.0.0.1:3420/api/health",
      reuseExistingServer: false,
    },
    {
      command:
        "GEM_API_PROXY=http://127.0.0.1:3420 npx vite --host 127.0.0.1 --port 5382 --strictPort",
      url: "http://127.0.0.1:5382",
      reuseExistingServer: false,
    },
  ],
  reporter: "list",
});
