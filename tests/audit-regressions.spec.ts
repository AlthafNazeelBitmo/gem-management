import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const owner = { id: "fixture-owner", name: "Audit Owner", email: "owner@example.test", role: "Owner", csrf: "fixture" };
const stones = Array.from({ length: 23 }, (_, index) => ({
  id: `GEM-QA-${index}`, variety: index < 9 ? "Audit Sapphire" : "Audit Spinel",
  shape: "Oval", state: "In stock", evidence: index === 0 ? "Review needed" : "Approved",
  carats: "2.460", price: index === 1 ? "0.00" : "2400.00",
  location: "Vault", custodian: "Intake", version: 1, internal: true, ownershipConfirmed: true,
}));
async function workspace(page: Page, config: {
  user?: typeof owner; currency?: string; minorUnits?: number; data?: object;
} = {}) {
  const { user = owner, currency = "LKR", minorUnits = 2, data = {} } = config;
  await page.route("**/api/auth", (route) => route.fulfill({ json: { user, setupRequired: false } }));
  await page.route("**/api/workspace", (route) => route.fulfill({
    json: { settings: { name: "Audit office", currency, minorUnits }, aiConfigured: false, mfaEnabled: false, stones, ...data },
  }));
  await page.route("**/api/labels/*", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
}
test.use({ serviceWorkers: "block", viewport: { width: 1280, height: 850 } });

for (const [currency, minorUnits, amount] of [
  ["LKR", 2, "2,400.00 LKR"], ["USD", 2, "2,400.00 USD"], ["JPY", 0, "2,400 JPY"], ["KWD", 3, "2,400.000 KWD"],
] as const) {
  test(`inventory and buyer use explicit ${currency} precision`, async ({ page }) => {
    await workspace(page, { currency, minorUnits });
    await page.goto("/#Inventory");
    await expect(page.getByText(amount, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Unpriced", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Grid view" }).click();
    await expect(page.locator(".stone-card").first()).toContainText(amount);
    await page.locator(".stone-card").first().getByRole("button", { name: "View Details" }).click();
    await expect(page.getByRole("dialog")).toContainText(amount);
    await page.route("**/api/buyer/currency-fixture", (route) => route.fulfill({
      json: { title: "Fixture selection", business: "Audit office", expires: "2099-04-05",
        stones: [{ ...stones[2], currency, minorUnits, available: true }] },
    }));
    await page.goto("/buyer/currency-fixture");
    await expect(page.getByText(amount, { exact: true })).toBeVisible();
  });
}

test("confirmed save closes the form even if the refresh fails", async ({ page }) => {
  await workspace(page);
  let writes = 0;
  let failRefresh = false;
  await page.route("**/api/commands/customer", (route) => {
    writes++;
    failRefresh = true;
    return route.fulfill({ json: { result: { id: "CUS-QA" } } });
  });
  await page.route("**/api/workspace", (route) => failRefresh
    ? route.fulfill({ status: 503, json: { error: "Fixture read unavailable" } })
    : writes ? route.fulfill({ json: { settings: { name: "Audit office", currency: "LKR" }, customers: [{ id: "CUS-QA", name: "Fixture customer" }] } })
      : route.fallback());
  await page.goto("/#Customers");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Customer or business name").fill("Fixture customer");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Could not refresh records");
  failRefresh = false;
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(page.getByText("Fixture customer", { exact: true })).toBeVisible();
  expect(writes).toBe(1);
});

test("an unconfirmed browser save reuses its reference on an identical retry", async ({ page }) => {
  await workspace(page);
  const keys: string[] = [];
  await page.route("**/api/commands/customer", (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    return route.fulfill(keys.length === 1
      ? { status: 503, json: { error: "Save confirmation unavailable" } }
      : { json: { result: { id: "CUS-QA" } } });
  });
  await page.goto("/#Customers");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Customer or business name").fill("Fixture customer");
  const save = page.getByRole("button", { name: "Save customer" });
  await save.click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("Save confirmation unavailable");
  await save.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/i);
  expect(keys[0]).toBe(keys[1]);
});

test("tablet keeps all controls on-screen; skip and search preserve context", async ({ page }) => {
  await workspace(page);
  await page.goto("/#Quotes");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await skip.focus();
  await skip.press("Enter");
  await expect(page).toHaveURL(/#Quotes$/);
  await expect(page.locator("#main")).toBeFocused();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("heading", { name: "Inventory", exact: true })).toBeVisible();
  const query = page.getByRole("textbox", { name: "Search inventory" });
  await expect(query).toBeFocused();
  await page.getByRole("button", { name: "Page 3", exact: true }).click();
  await query.fill("  Audit Sapphire  ");
  await expect(page.getByText(/Showing 1 to 8 of 9 stones/)).toBeVisible();
  for (const width of [761, 800, 900, 1024]) {
    await page.setViewportSize({ width, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}px root width`).toBe(width);
    const controls = await page.locator(".toolbar button:visible").evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().right));
    expect(controls.length).toBeGreaterThan(1);
    expect(Math.max(...controls)).toBeLessThanOrEqual(width);
  }
});

test("dirty intake guards Escape and backdrop, while live filters explain dismissal", async ({ page }) => {
  await workspace(page);
  await page.goto("/#Inventory");
  const receive = page.getByRole("button", { name: "Receive stock", exact: true });
  await receive.click();
  const dialog = page.getByRole("dialog");
  const variety = dialog.getByLabel("Gemstone variety");
  await variety.fill("Unsaved fixture");
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("button", { name: "Keep editing" })).toBeFocused();
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(variety).toBeFocused();
  await expect(variety).toHaveValue("Unsaved fixture");
  await page.mouse.click(4, 4);
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(receive).toBeFocused();
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(dialog.getByText(/Changes apply immediately/)).toBeVisible();
  await dialog.getByLabel("Evidence", { exact: true }).selectOption("Conflict");
  await page.keyboard.press("Escape");
  await expect(page.getByText("No stones match this search.")).toBeVisible();
  await page.getByRole("button", { name: "Clear search and filters" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(8);
});

test("clerk overdue memos are informational and price sorting is not offered", async ({ page }) => {
  await workspace(page, {
    user: { ...owner, role: "Inventory clerk" },
    data: { memos: [{ id: "MEM-QA", customerName: "Fixture buyer", due: "2024-01-01", lines: [{ status: "Pending" }] }] },
  });
  await page.goto("/");
  await expect(page.getByText("MEM-QA overdue")).toBeVisible();
  await expect(page.getByRole("button", { name: /MEM-QA overdue/ })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Workspace" }).getByRole("button", { name: "Inventory" }).click();
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByRole("dialog").locator("option[value^=price]")).toHaveCount(0);
});

test("phone dark inventory has accessible control names and contrast", async ({ page }) => {
  await workspace(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/#Inventory");
  await expect(page.getByRole("button", { name: "List", exact: true })).toHaveAttribute("aria-pressed", "true");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("buyer submission has a sent state and a terminal expired-link state", async ({ page }) => {
  let posts = 0;
  await page.route("**/api/buyer/decision-fixture", (route) => {
    if (route.request().method() === "POST") {
      posts++;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { title: "Decision fixture", business: "Audit office", expires: "2099-04-05", stones: [] } });
  });
  await page.goto("/buyer/decision-fixture");
  const submit = page.getByRole("button", { name: "Send decision" });
  await submit.dblclick();
  await expect(page.getByRole("status")).toContainText("Response recorded");
  expect(posts).toBe(1);
  await page.getByRole("button", { name: "Update decision" }).click();
  await page.getByLabel("Your decision").selectOption("Decline");
  await submit.click();
  await expect(page.getByRole("button", { name: "Update decision" })).toBeVisible();
  expect(posts).toBe(2);
  await page.route("**/api/buyer/expired-fixture", (route) => route.fulfill({ status: 404, json: { error: "Expired" } }));
  await page.goto("/buyer/expired-fixture");
  await expect(page.getByRole("heading", { name: "Selection unavailable" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Ask your sales contact");
});

test("intake assigns field validation to the affected input", async ({ page }) => {
  await workspace(page);
  await page.route("**/api/commands/receive", (route) => route.fulfill({
    status: 400, json: { error: "Carat weight requires 3 decimal places at most.", field: "Carat weight" },
  }));
  await page.goto("/#Inventory");
  await page.getByRole("button", { name: "Receive stock", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Gemstone variety").fill("Intake fixture");
  await dialog.getByLabel("Internal location").fill("Fixture vault");
  const weight = dialog.getByLabel("Weight (ct)", { exact: true });
  await weight.fill("1.2345");
  await dialog.getByRole("button", { name: "Receive as draft" }).click();
  await expect(weight).toBeFocused();
  await expect(weight).toHaveAttribute("aria-invalid", "true");
  await expect(weight).toHaveAccessibleDescription("Carat weight requires 3 decimal places at most.");
  await weight.fill("1.234");
  await expect(weight).not.toHaveAttribute("aria-invalid", "true");
});

test("refresh after a remote show release preserves queued sales without allowing new ones", async ({ page }) => {
  const showId = "SHW-QA";
  await page.addInitScript(({ showId, owner, stone }) => {
    localStorage.setItem("gem-show-authority", JSON.stringify({
      id: showId, user: owner, settings: { currency: "LKR" },
      expires: "2099-01-01", stones: [{ ...stone, showId }], customers: [{ id: "CUS-QA" }],
    }));
    localStorage.setItem("gem-offline-events", JSON.stringify([
      { payload: { id: "EVT-QA", showId, lines: [{ stoneId: "Previously queued stone" }] } },
    ]));
  }, { showId, owner, stone: stones[2] });
  await workspace(page, { data: { shows: [{ id: showId, status: "Released", name: "Fixture show", stoneIds: [] }] } });
  await page.goto("/#Show%20mode");
  await expect(page.getByText(/1 queued sale needs review/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Queue offline sale" })).toHaveCount(0);
  const cache = await page.evaluate(() => ({
    authority: localStorage.getItem("gem-show-authority"), pending: localStorage.getItem("gem-offline-events"),
  }));
  expect(cache.authority).toBeNull();
  expect(cache.pending).toContain("EVT-QA");
});
