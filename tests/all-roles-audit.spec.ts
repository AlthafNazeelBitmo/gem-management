import { test, expect } from "@playwright/test";

const baseURL = "http://127.0.0.1:5383";
test.use({ baseURL, serviceWorkers: "block" });

const destinations = {
  Owner: ["Overview", "Inventory", "Evidence", "Processing", "Holds & selections", "Memos", "Quotes",
    "Purchasing", "Customers", "Sales", "Payments", "Stocktake", "Reports", "Show mode",
    "Activity log", "Assistant", "Walkthrough", "Settings"],
  "Sales staff": ["Overview", "Inventory", "Holds & selections", "Memos", "Quotes", "Customers", "Sales", "Show mode", "Assistant", "Walkthrough"],
  "Inventory clerk": ["Overview", "Inventory", "Evidence", "Processing", "Purchasing", "Stocktake", "Show mode", "Assistant", "Walkthrough"],
  Accounts: ["Overview", "Memos", "Quotes", "Purchasing", "Customers", "Sales", "Payments", "Reports", "Activity log", "Assistant", "Walkthrough"],
  "Gem reviewer": ["Overview", "Inventory", "Evidence", "Assistant", "Walkthrough"],
  "Cutter / lab liaison": ["Overview", "Inventory", "Processing", "Assistant", "Walkthrough"],
};
const email = (role: string) => `${role.toLowerCase().replace(/[^a-z]+/g, "-")}@roles.example.test`;
const password = "role-fixture-password";

test.beforeAll(async ({ playwright }) => {
  const client = await playwright.request.newContext({ baseURL });
  try {
    const auth = await client.get("/api/auth");
    if (!(await auth.json()).setupRequired) return; // Already provisioned by this spec on a worker retry.
    const setup = await client.post("/api/setup", {
      data: { name: "Owner QA", email: email("Owner"), password, businessName: "Role QA", currency: "LKR", minorUnits: 2 },
    });
    expect(setup.status()).toBe(201);
    const { user } = await setup.json();
    for (const role of Object.keys(destinations).filter((role) => role !== "Owner")) {
      const result = await client.post("/api/users", {
        headers: { "X-CSRF-Token": user.csrf },
        data: { name: `${role} QA`, email: email(role), role, password },
      });
      expect(result.ok(), role).toBe(true);
    }
  } finally {
    await client.dispose();
  }
});

for (const width of [1280, 390]) {
  for (const [role, allowed] of Object.entries(destinations)) {
    test(`${role} can reach every assigned workspace at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const uncaught: string[] = [];
      page.on("pageerror", (error) => uncaught.push(error.message));
      await page.goto("/");
      await page.getByLabel("Email", { exact: true }).fill(email(role));
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
      for (const destination of allowed.slice(1)) {
        if (width === 390) {
          await page.getByRole("button", { name: "More workspaces" }).click();
          await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${destination} `) }).click();
        } else {
          await page.getByRole("navigation", { name: "Workspace" })
            .getByRole("button", { name: destination, exact: true }).click();
        }
        await expect(page.getByRole("heading", { level: 1, name: destination, exact: true })).toBeVisible();
      }
      if (role !== "Owner") {
        await page.goto("/#Settings");
        await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
        await expect(page).toHaveTitle("Gem Management | Overview");
      }
      expect(uncaught).toEqual([]);
    });
  }
}
