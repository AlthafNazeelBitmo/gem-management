import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("persistent parcel journey, buyer-safe sharing, navigation and responsive accessibility", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Your name", { exact: true }).fill("Training owner");
  await page
    .getByLabel("Business name", { exact: true })
    .fill("Training Gem Office");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByLabel("Base currency", { exact: true }).selectOption("JPY");
  await expect(page.getByLabel("Currency decimals")).toHaveValue("0");
  await page.getByLabel("Base currency", { exact: true }).selectOption("USD");
  await page
    .getByLabel("Launch country", { exact: true })
    .selectOption("Sri Lanka");
  await expect(
    page.getByLabel("Use this workspace for training and demonstrations"),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Receive stock", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Gemstone variety").fill("Training blue sapphire");
  await dialog.getByLabel("Weight (ct)", { exact: true }).fill("3.240");
  await dialog.getByLabel("Internal location").fill("Training vault");
  await dialog.getByLabel("Acquisition cost").fill("100.01");
  await dialog.getByLabel("Asking price").fill("200.00");
  await dialog.getByLabel("Ownership authority and terms confirmed").check();
  await dialog.getByRole("button", { name: "Receive as draft" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Training blue sapphire",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add claim", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Claim or finding")
    .fill("Training claim only. No laboratory finding is asserted.");
  await dialog.getByRole("button", { name: "Preserve claim" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Review disclosure" })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Approved buyer-facing wording")
    .fill("Training sapphire. Identity requires original laboratory evidence.");
  await dialog.getByRole("button", { name: "Approve wording" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Release to stock" })
    .click();
  await expect(page.getByRole("dialog").locator(".stone-title")).toContainText(
    "In stock",
  );
  await page.keyboard.press("Escape");
  await page
    .locator("nav")
    .getByRole("button", { name: "Inventory", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search inventory" })
    .fill("does not exist");
  await expect(page.getByText("No stones match this search.")).toBeVisible();
  await page.getByRole("textbox", { name: "Search inventory" }).fill("");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .locator("nav")
    .getByRole("button", { name: "Customers", exact: true })
    .click();
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Customer or business name")
    .fill("Training buyer");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save customer" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator("nav")
    .getByRole("button", { name: "Quotes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepare quote", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: "Training buyer" });
  const stones = await dialog
    .getByLabel("Stones", { exact: true })
    .locator("option")
    .all();
  const id = await stones[0].getAttribute("value");
  await dialog.getByLabel("Stones", { exact: true }).selectOption(id!);
  await dialog.getByLabel("Price per selected stone").fill("200.00");
  await dialog.getByRole("button", { name: "Save quote" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Convert to invoice" }).click();
  await expect(page.locator("tbody")).toContainText("Converted");
  await page
    .locator("nav")
    .getByRole("button", { name: "Sales", exact: true })
    .click();
  await expect(page.locator("tbody")).toContainText("200.00 USD");
  await page
    .locator("nav")
    .getByRole("button", { name: "Payments", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: "Training buyer" });
  await dialog
    .getByLabel("Invoice", { exact: true })
    .selectOption({ index: 1 });
  await dialog.getByLabel("Amount received").fill("200.00");
  await dialog.getByLabel("Bank or receipt reference").fill("Training receipt");
  await dialog
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("tbody")).toContainText("Training receipt");
  for (const name of [
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
  ]) {
    await page
      .locator("nav")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(page.locator("main h1")).toHaveText(name);
  }
  await page
    .locator("nav")
    .getByRole("button", { name: "Inventory", exact: true })
    .click();
  let scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page.screenshot({
    path: "test-results/workspace-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "More workspaces" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Walkthrough/ })
    .click();
  await expect(page.locator("main h1")).toHaveText("Walkthrough");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/workspace-mobile-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(page.locator(".walkthrough-body h2")).toHaveText(
    "Review the evidence",
  );
  expect(errors).toEqual([]);
});

test("purchasing, import reconciliation, backups, stocktake and role sign-in", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main h1")).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Purchasing", exact: true })
    .click();
  await page.getByRole("button", { name: "Add supplier", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Supplier name", { exact: true })
    .fill("Training supplier");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save supplier" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create purchase order", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Supplier", { exact: true })
    .selectOption({ label: "Training supplier" });
  await dialog
    .getByLabel("Variety", { exact: true })
    .fill("Training purchased parcel");
  await dialog.getByLabel("Total weight (ct)", { exact: true }).fill("2.000");
  await dialog
    .getByLabel("Agreed total supplier cost (USD)", { exact: true })
    .fill("50.00");
  await dialog
    .getByLabel("Agreed terms", { exact: true })
    .fill("Training purchase only");
  await dialog
    .getByRole("button", { name: "Create purchase order", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Receive purchase", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Internal receiving location", { exact: true })
    .fill("Purchase intake");
  await dialog
    .getByRole("button", { name: "Receive purchase", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Record supplier payment", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (USD)", { exact: true }).fill("50.00");
  await dialog
    .getByLabel("Verified payment reference", { exact: true })
    .fill("Training supplier receipt");
  await dialog
    .getByRole("button", { name: "Record supplier payment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Training supplier receipt", { exact: false }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Stocktake", exact: true })
    .click();
  await page.getByRole("button", { name: "Start stocktake" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Exact internal location").fill("Purchase intake");
  await dialog.getByRole("button", { name: "Compare physical count" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("tbody")).toContainText("Purchase intake");
  await page
    .locator("nav")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Upload CSV for preview" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Stock CSV").setInputFiles({
    name: "training-stock.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "reference,variety,carats,location,cost,price\nBROWSER-IMPORT,Training CSV stone,1.250,CSV intake,20.01,40.00\n",
    ),
  });
  await dialog.getByRole("button", { name: "Preview CSV" }).click();
  await page.getByRole("button", { name: "Confirm totals & import" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Source total carats (3 decimals)").fill("1.250");
  await dialog.getByLabel("Source total cost (2 decimals)").fill("20.01");
  await dialog
    .getByRole("button", { name: "Commit reconciled import" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download complete backup" }).click();
  expect((await download).suggestedFilename()).toContain(".sqlite");
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("img", { name: "Authenticator setup QR" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add person" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Training sales");
  await dialog.getByLabel("Email", { exact: true }).fill("sales@example.test");
  await dialog
    .getByLabel("Password (at least 12 characters)", { exact: true })
    .fill("training-sales-password");
  await dialog.getByLabel("Role", { exact: true }).selectOption("Sales staff");
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("sales@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("training-sales-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main h1")).toBeVisible();
  await expect(
    page.locator("nav").getByRole("button", { name: "Payments", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator("nav")
      .getByRole("button", { name: "Purchasing", exact: true }),
  ).toHaveCount(0);
});

test("document review, private buyer pack, holds, memo return and cutter handoff", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main h1")).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Inventory", exact: true })
    .click();
  await page.getByRole("button", { name: /Training purchased parcel/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Attach report / photo" })
    .click();
  let dialog = page.getByRole("dialog");
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.addPage();
  await dialog.getByLabel("PDF, JPEG or PNG (up to 15 MB)").setInputFiles({
    name: "training-evidence.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await dialog.getByRole("button", { name: "Upload original" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add claim", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Claim or finding")
    .fill(
      "Training evidence only. Original PDF is an empty training document.",
    );
  await dialog.getByRole("button", { name: "Preserve claim" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Review disclosure" })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Approved buyer-facing wording")
    .fill("Training parcel. Not authentic laboratory evidence.");
  await dialog
    .getByLabel("Documents approved for buyer sharing")
    .selectOption({ label: "training-evidence.pdf" });
  await dialog.getByRole("button", { name: "Approve wording" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Release to stock" })
    .click();
  await expect(page.getByRole("dialog").locator(".stone-title")).toContainText(
    "In stock",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Place hold" })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: "Training buyer" });
  await dialog.getByRole("button", { name: "Place hold" }).click();
  await expect(page.getByRole("dialog").locator(".stone-title")).toContainText(
    "Held",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Release hold" })
    .click();
  await expect(page.getByRole("dialog").locator(".stone-title")).toContainText(
    "In stock",
  );
  await page.keyboard.press("Escape");
  await page
    .locator("nav")
    .getByRole("button", { name: "Holds & selections", exact: true })
    .click();
  await page.getByRole("button", { name: "Create selection" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Selection title").fill("Training buyer pack");
  await dialog
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: "Training buyer" });
  const candidate = dialog
    .getByLabel("Stones", { exact: true })
    .getByRole("option", { name: /Training purchased parcel/ });
  const stoneId = await candidate.getAttribute("value");
  await dialog.getByLabel("Stones", { exact: true }).selectOption(stoneId!);
  await dialog.getByRole("button", { name: "Create private link" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const href = await page
    .getByRole("link", { name: "Open buyer view" })
    .getAttribute("href");
  const buyer = await context.newPage();
  await buyer.goto(href!);
  await expect(
    buyer.getByRole("link", { name: "training-evidence.pdf" }),
  ).toBeVisible();
  await expect(buyer.locator("body")).not.toContainText("50.00");
  await buyer.getByRole("button", { name: "Send decision" }).click();
  await expect(buyer.getByRole("status")).toContainText("Response recorded");
  await buyer.close();
  await page
    .locator("nav")
    .getByRole("button", { name: "Memos", exact: true })
    .click();
  await page.getByRole("button", { name: "Issue memo", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: "Training buyer" });
  await dialog.getByLabel("Stones", { exact: true }).selectOption(stoneId!);
  await dialog
    .getByLabel("Return due")
    .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  await dialog
    .getByLabel("Agreed terms")
    .fill("Training memo, return tomorrow");
  await dialog.getByRole("button", { name: "Issue memo", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Receive return", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Condition inspection")
    .fill("Training return inspected");
  await dialog
    .getByLabel("Internal location", { exact: true })
    .fill("Returns desk");
  await dialog
    .getByRole("button", { name: "Receive return", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("tbody")).toContainText("Returned");
  await page
    .locator("nav")
    .getByRole("button", { name: "Inventory", exact: true })
    .click();
  await page.getByRole("button", { name: /Training purchased parcel/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Release to stock" })
    .click();
  await expect(page.getByRole("dialog").locator(".stone-title")).toContainText(
    "In stock",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Issue for processing" })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Receiving lab / cutter").fill("Training cutter");
  await dialog
    .getByLabel("Instructions", { exact: true })
    .fill("Training cutting job");
  await dialog
    .getByRole("button", { name: "Issue stone", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator(".stone-title")).toContainText(
    "With lab or cutter",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator("nav")
    .getByRole("button", { name: "Processing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record return", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Return weight (ct)").fill("1.500");
  await dialog.getByLabel("Recorded loss (ct)").fill("0.500");
  await dialog.getByLabel("Processing charge").fill("10.00");
  await dialog.getByLabel("Internal return location").fill("Cutting return");
  await dialog
    .getByRole("button", { name: "Record return", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("tbody")).toContainText("75.00% yield");
});
