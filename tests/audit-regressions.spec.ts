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
  await expect(page.getByText("No stones match these filters.")).toBeVisible();
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

test("desktop dropdowns preserve native keyboard selection and dismissal", async ({ page }, info) => {
  await workspace(page);
  await page.goto("/#Inventory");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filters & sort" });
  const custody = dialog.getByLabel("Custody status");
  await expect(custody).toHaveValue("All stock");
  const customizable = await custody.evaluate((select) => getComputedStyle(select).appearance === "base-select");
  if (customizable) {
    await custody.focus();
    await page.keyboard.press("Space");
    await expect.poll(() => custody.evaluate((select) => select.matches(":open"))).toBe(true);
    await page.screenshot({ path: info.outputPath("desktop-dropdown.png") });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(custody).toHaveValue("Draft");
    await expect(dialog).toBeVisible();
  } else {
    await custody.selectOption("Draft");
    await expect(custody).toHaveValue("Draft");
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Filters (1)", exact: true })).toBeFocused();
});

test.describe("phone workspace finder", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce" });
  test("filters destinations without changing access and resets on reopen", async ({ page }, info) => {
    await workspace(page);
    await page.goto("/#Inventory");
    const more = page.getByRole("button", { name: "More workspaces" });
    await more.click();
    const dialog = page.getByRole("dialog", { name: "Workspaces" });
    const finder = dialog.getByRole("searchbox", { name: "Find a workspace" });
    await page.screenshot({ path: info.outputPath("phone-workspaces.png") });
    await finder.fill("no workspace here");
    await expect(dialog.getByRole("status")).toHaveText("No matching workspaces.");
    await finder.fill("purchasing");
    await expect(dialog.getByRole("button", { name: /^Evidence / })).toHaveCount(0);
    await dialog.getByRole("button", { name: /^Purchasing / }).click();
    await expect(page.getByRole("heading", { name: "Purchasing", exact: true })).toBeVisible();
    await more.click();
    await expect(finder).toHaveValue("");
  });
});

test.describe("mobile audit fixes", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });

  test("hidden inventory selections require ID review before sale and reset when the view changes", async ({ page }) => {
    await workspace(page);
    await page.goto("/#Inventory");
    await page.getByRole("checkbox", { name: "Select GEM-QA-1", exact: true }).check();
    await page.getByRole("button", { name: "Page 2", exact: true }).tap();
    await expect(page.getByText("0 on this page · 1 outside this view")).toBeVisible();
    for (const name of ["Create sale", "Issue memo", "Share selection"])
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Review selected stones" }).tap();
    const review = page.getByRole("dialog", { name: "Review selected stones" });
    await expect(review.getByRole("listitem")).toContainText("GEM-QA-1");
    await review.getByRole("button", { name: "Confirm selected stones" }).tap();
    await page.getByRole("button", { name: "Create sale", exact: true }).tap();
    const sale = page.getByRole("dialog", { name: "Create sale" });
    await expect(sale.getByRole("checkbox", { name: /GEM-QA-1 ·/ })).toBeChecked();
    await sale.getByRole("button", { name: "Close dialog" }).tap();
    await page.getByRole("button", { name: "Search inventory", exact: true }).tap();
    await page.getByRole("searchbox", { name: "Search inventory" }).fill("no matching stones");
    await page.getByRole("button", { name: "Done", exact: true }).tap();
    await expect(page.getByText("No stones match this search.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create sale", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Review selected stones" }).tap();
    await review.getByRole("button", { name: "Keep only this page" }).tap();
    await expect(page.getByText("1 stone selected")).toHaveCount(0);
  });

  test("browser Back closes clean sheets and guards dirty intake without leaving Inventory", async ({ page }) => {
    await workspace(page);
    await page.goto("/#Overview");
    await page.getByRole("navigation", { name: "Quick navigation" }).getByRole("button", { name: "Inventory" }).tap();
    const stone = page.getByRole("button", { name: /Audit Sapphire.*GEM-QA-1 ·/ });
    await stone.focus();
    await stone.press("Enter");
    await expect(page.getByRole("dialog", { name: "GEM-QA-1" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/#Inventory$/);
    await expect(stone).toBeFocused();

    await page.getByRole("button", { name: "Receive stock", exact: true }).tap();
    const editor = page.getByRole("dialog");
    const variety = editor.getByLabel("Gemstone variety");
    await variety.fill("Unsaved fixture");
    await page.goBack();
    await expect(editor.getByRole("button", { name: "Keep editing" })).toBeFocused();
    await expect(page).toHaveURL(/#Inventory$/);
    await editor.getByRole("button", { name: "Keep editing" }).tap();
    await expect(variety).toHaveValue("Unsaved fixture");
    await page.goBack();
    await editor.getByRole("button", { name: "Discard changes" }).tap();
    await expect(editor).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Boolean(history.state?.gemMobileSheet))).toBe(false);
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Inventory", exact: true })).toBeVisible();
    await expect(editor).toHaveCount(0);
  });

  test("browser Back returns from a nested editor to the detail sheet before leaving it", async ({ page }) => {
    await workspace(page);
    await page.goto("/#Inventory");
    await page.getByRole("button", { name: /Audit Sapphire.*GEM-QA-1 ·/ }).tap();
    await page.getByRole("dialog").getByRole("button", { name: "Add claim", exact: true }).tap();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add versioned claim" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog", { name: "GEM-QA-1" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/#Inventory$/);
  });

  test("profile opens account controls; workspace aliases obey role visibility", async ({ page }) => {
    await workspace(page, { user: { ...owner, role: "Inventory clerk" } });
    await page.goto("/");
    await page.getByRole("button", { name: /— account$/ }).tap();
    const account = page.getByRole("dialog", { name: "Account" });
    await expect(account.getByRole("button", { name: /Appearance:/ })).toBeInViewport();
    await expect(account.getByRole("button", { name: "Sign out" })).toBeInViewport();
    await account.getByRole("button", { name: "Close dialog" }).tap();
    await page.getByRole("button", { name: "More workspaces" }).tap();
    const menu = page.getByRole("dialog", { name: "Workspaces" });
    const finder = menu.getByRole("searchbox", { name: "Find a workspace" });
    await finder.fill("stock");
    await expect(menu.getByRole("button", { name: /^Inventory / })).toBeVisible();
    await finder.fill("supplier");
    await expect(menu.getByRole("button", { name: /^Purchasing / })).toBeVisible();
    await finder.fill("invoice");
    await expect(menu.getByRole("button", { name: /^Sales / })).toHaveCount(0);
    await expect(menu.getByRole("status")).toContainText("No matching workspaces");
  });

  test("buyer documents have distinct touch targets and the response shortcut focuses the form heading", async ({ page }) => {
    await page.route("**/api/buyer/mobile-fixture", (route) => route.fulfill({
      json: { title: "Mobile buyer fixture", business: "Audit office", expires: "2099-04-05",
        stones: stones.slice(0, 8).map((stone) => ({ ...stone, currency: "LKR", minorUnits: 2,
          reports: [{ id: "A", name: "Original report.pdf" }, { id: "B", name: "Certification update.pdf" }] })) },
    }));
    await page.goto("/buyer/mobile-fixture");
    const firstRow = page.getByRole("row").filter({ hasText: "GEM-QA-0" });
    const first = firstRow.getByRole("link", { name: "Original report.pdf" });
    const second = firstRow.getByRole("link", { name: "Certification update.pdf" });
    await expect(first).toHaveAttribute("href", "/api/buyer/mobile-fixture/files/A");
    await expect(second).toHaveAttribute("href", "/api/buyer/mobile-fixture/files/B");
    const a = (await first.boundingBox())!;
    const b = (await second.boundingBox())!;
    expect(a.height).toBeGreaterThanOrEqual(44);
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height + 6);
    await page.getByRole("link", { name: "Respond to this selection" }).tap();
    await expect(page.getByRole("heading", { name: "Your response" })).toBeFocused();
  });

  test("intake optional details are collapsed but retain their values", async ({ page }) => {
    await workspace(page);
    await page.goto("/#Inventory");
    await page.getByRole("button", { name: "Receive stock", exact: true }).tap();
    const editor = page.getByRole("dialog", { name: "Receive stock" });
    const section = editor.getByText("Optional details", { exact: true });
    const dimensions = editor.getByLabel("Dimensions", { exact: true });
    await expect(dimensions).toBeHidden();
    await section.tap();
    await dimensions.fill("5 × 7 mm");
    await section.tap();
    await expect(dimensions).toBeHidden();
    await section.tap();
    await expect(dimensions).toHaveValue("5 × 7 mm");
  });

  test("short filter sheet keeps Done visible and exposes sorting separately in the chip list", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 400 });
    await workspace(page);
    await page.goto("/#Inventory");
    await page.getByRole("button", { name: "Filters", exact: true }).tap();
    const filters = page.getByRole("dialog", { name: "Filters & sort" });
    const done = filters.getByRole("button", { name: "Done" });
    for (const dimensions of [{ width: 390, height: 400 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(dimensions);
      await expect(done).toBeInViewport({ ratio: 1 });
    }
    await filters.getByLabel("Evidence", { exact: true }).selectOption("Conflict");
    await filters.getByLabel("Sort Order").selectOption("weight-desc");
    await filters.getByRole("button", { name: "Done" }).tap();
    await expect(page.getByText("No stones match these filters.")).toBeVisible();
    await expect(page.locator(".pagination-controls")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /remove Sort order filter/ })).toBeVisible();
    await page.getByRole("button", { name: /remove Evidence filter/ }).tap();
    await expect(page.getByRole("button", { name: "Filters (1)", exact: true })).toBeVisible();
  });
});
