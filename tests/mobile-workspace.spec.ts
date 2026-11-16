import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const stones = [
  {
    id: "GEM-E6E4FB0C",
    variety: "Cornflower Sapphire",
    shape: "Oval",
    treatment: "Heated",
    evidence: "Approved",
  },
  {
    id: "GEM-3BCA9FF5",
    variety: "Cornflower Sapphire",
    shape: "Cushion",
    treatment: "Heated",
    evidence: "Approved",
  },
  {
    id: "GEM-D1847F7C",
    variety: "Star Ruby (Consignment)",
    shape: "Cabochon",
    treatment: "None",
    evidence: "Approved",
  },
  {
    id: "GEM-2C6089C5",
    variety: "Red Spinel (Consignment)",
    shape: "Cushion",
    treatment: "None",
    evidence: "Review needed",
  },
].map((stone, index) => ({
  state: index === 3 ? "Draft" : "In stock",
  carats: "2.460",
  price: "2400.00",
  currency: "USD",
  location: "Main vault · Tray 12",
  custodian: "Inventory desk",
  internal: true,
  ownershipConfirmed: true,
  version: 1,
  ...stone,
}));

async function mockWorkspace(page: Page, role = "Owner", aiConfigured = true) {
  await page.route("**/api/auth", (route) =>
    route.fulfill({
      json: {
        setupRequired: false,
        user: { id: "test-user", role, name: "Test Owner", csrf: "test" },
      },
    }),
  );
  await page.route("**/api/workspace", (route) =>
    route.fulfill({
      json: {
        settings: { business: "Test Gem Office", currency: "USD" },
        mfaEnabled: false,
        aiConfigured,
        stones: role === "Accounts" ? [] : stones,
        incomingMemos: [
          {
            id: "MEM-123",
            supplierName: "Sample supplier",
            due: "2027-12-20",
            lines: [
              { stoneId: stones[0].id, status: "Pending", cost: "1200.00" },
            ],
          },
        ],
        fileMeta: [
          {
            id: "file-test",
            stoneId: stones[0].id,
            name: "Sample report.pdf",
            size: 900,
          },
        ],
      },
    }),
  );
  await page.route("**/api/labels/*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"/>',
    }),
  );
}

test.use({
  viewport: { width: 402, height: 874 },
  hasTouch: true,
  reducedMotion: "reduce",
  serviceWorkers: "block",
});

test("phone shell reserves safe areas and stock keeps its identity, controls, and details", async ({
  page,
}, info) => {
  await mockWorkspace(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.addStyleTag({
    content: ":root { --safe-top: 62px; --safe-bottom: 34px; }",
  });
  const header = page.locator(".toolbar");
  const nav = page.getByRole("navigation", { name: "Quick navigation" });
  expect((await header.boundingBox())?.height).toBeGreaterThanOrEqual(116);
  expect(
    (await nav.boundingBox())!.y + (await nav.boundingBox())!.height,
  ).toBeLessThanOrEqual(840);
  const recent = page.locator(".records-stock-preview");
  const stoneName = recent.getByRole("button", {
    name: /Cornflower Sapphire.*GEM-E6E4FB0C/,
  });
  await expect(stoneName).toBeVisible();
  expect((await stoneName.boundingBox())?.width).toBeGreaterThan(300);
  expect(
    await recent.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("overview-light.png") });
  await stoneName.focus();
  await stoneName.press("Enter");
  const detail = page.getByRole("dialog");
  await expect(detail).toContainText("GEM-E6E4FB0C");
  await expect(detail).toHaveCSS("animation-name", "none");
  await detail.getByRole("button", { name: "Close dialog" }).tap();
  await expect(stoneName).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await nav.getByRole("button", { name: "Overview" }).tap();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);

  await page.getByRole("button", { name: "Search stock" }).tap();
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Receive stock", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search stock" }).fill("spinel");
  await page.getByRole("button", { name: "Done" }).tap();
  await expect(page.locator(".records-stock tbody tr")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Search stock" }),
  ).toBeFocused();
  await page
    .locator(".stock-search-summary")
    .getByRole("button", { name: "Clear" })
    .tap();
  await expect(page.locator(".records-stock tbody tr")).toHaveCount(
    stones.length,
  );
  await page.getByRole("button", { name: "Filters" }).tap();
  await page
    .getByLabel("Laboratory Evidence", { exact: true })
    .filter({ visible: true })
    .selectOption("Review needed");
  await page.getByRole("button", { name: "Done", exact: true }).tap();
  await expect(page.locator(".records-stock tbody tr")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Select GEM-2C6089C5" }).check();
  await expect(page.getByText("1 stone selected")).toBeVisible();
  await page.getByRole("button", { name: "Cards" }).tap();
  await expect(
    page.getByRole("region", { name: "Gemstone grid" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "More workspaces" }).focus();
  await page.getByRole("button", { name: "More workspaces" }).press("Enter");
  await page.getByRole("button", { name: "Appearance: Light" }).tap();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .tap();
  await expect(
    page.getByRole("button", { name: "More workspaces" }),
  ).toBeFocused();
  await page.screenshot({ path: info.outputPath("stock-dark.png") });
  expect(errors).toEqual([]);
});

test("narrow business pages fit, including purchasing and the AI drafting states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await mockWorkspace(page);
  await page.route("**/api/assistant", (route) =>
    route.fulfill({
      json: { answer: "GEM-2C6089C5 is waiting for evidence review." },
    }),
  );
  await page.goto("/");
  const destinations = [
    "Overview",
    "Inventory",
    "Evidence",
    "Processing",
    "Holds & selections",
    "Memos",
    "Quotes",
    "Purchasing",
    "Customers",
    "Sales",
    "Payments",
    "Stocktake",
    "Reports",
    "Show mode",
    "Activity log",
    "Assistant",
    "Walkthrough",
    "Settings",
  ];
  for (const name of destinations) {
    await page.evaluate((destination) => {
      location.hash = encodeURIComponent(destination);
    }, name);
    await expect(
      page.getByRole("heading", { name, exact: true }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name,
    ).toBe(true);
  }

  await page.goto("/#Purchasing");
  const memo = page.locator(".memo-section").filter({ hasText: "MEM-123" });
  await expect(
    memo.getByRole("button", { name: "Return stone" }),
  ).toBeVisible();
  expect(
    await memo
      .locator(".records-table")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.goto("/#Assistant");
  await expect(
    page.getByText("Read-only. Answers use records", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Your question").fill("What is waiting for review?");
  await page.getByRole("button", { name: "Ask assistant" }).tap();
  await expect(
    page.getByRole("heading", { name: "AI-generated answer" }),
  ).toBeVisible();
  await expect(
    page.getByText("Verify the answer against the original records."),
  ).toBeVisible();

  await page.route("**/api/files/file-test/extract", (route) =>
    route.fulfill({
      json: {
        draft: { reportNumber: "LAB-17", variety: "Sapphire", carats: "2.460" },
      },
    }),
  );
  await page.goto("/#Inventory");
  await page
    .locator(".records-stock")
    .getByRole("button", { name: /Cornflower Sapphire.*GEM-E6E4FB0C/ })
    .tap();
  await expect(
    page.getByText(
      "Extraction sends this report to the configured AI provider.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Extract AI draft" }).tap();
  const review = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Review AI-extracted report" }),
  });
  await expect(review.getByLabel("Report number", { exact: true })).toHaveValue(
    "LAB-17",
  );
  await review
    .getByRole("button", { name: "Confirm fields & preserve claim" })
    .tap();
  await expect(review.getByRole("alert")).toHaveText(
    "Check the critical fields before saving.",
  );
});

test("role tabs, unconfigured AI, and Home Screen assets", async ({
  page,
  request,
}) => {
  await mockWorkspace(page, "Accounts", false);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Quick navigation" });
  await expect(
    nav.getByRole("button", { name: "Stock", exact: true }),
  ).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "Payments" })).toBeVisible();
  await nav.getByRole("button", { name: "More workspaces" }).tap();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Assistant/ })
    .tap();
  await expect(page.getByText(/AI is not connected/)).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/icons/gem-180.png",
  );
});
