import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 402, height: 874 },
  hasTouch: true,
  serviceWorkers: "block",
});

test("sign-in matches the Home Screen icon and reveals the 2FA field when needed", async ({
  page,
  request,
}, info) => {
  await page.route("**/api/auth", (route) =>
    route.fulfill({
      json: { setupRequired: false, user: null },
    }),
  );
  await page.route("**/api/login", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "Enter the current authenticator code." },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  const icon = page.locator(".auth-icon");
  await expect(icon).toHaveJSProperty("naturalWidth", 180);
  const iconPath = await icon.getAttribute("src");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    iconPath!,
  );
  const appleIcon = await request.get(iconPath!);
  expect(appleIcon.headers()["content-type"]).toContain("image/png");
  expect((await appleIcon.body()).subarray(0, 8).toString("hex")).toBe(
    "89504e470d0a1a0a",
  );
  await expect(
    page.getByLabel("Authenticator code", { exact: true }),
  ).toBeHidden();
  await page.screenshot({ path: info.outputPath("sign-in.png") });
  await page.getByText("Add to iPhone Home Screen", { exact: true }).tap();
  await expect(
    page.getByText(/Turn on Open as Web App if shown/),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("login@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).tap();
  await expect(page.getByRole("alert")).toHaveText(
    "Enter the current authenticator code.",
  );
  const code = page.getByLabel("Authenticator code", { exact: true });
  await expect(code).toBeFocused();
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "login@example.test",
  );
});

test("owner setup is readable in dark mode at 320px and preserves currency defaults", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.route("**/api/auth", (route) =>
    route.fulfill({
      json: { setupRequired: true, user: null },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Create your workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Owner account" }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Workspace settings" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Password", { exact: true }),
  ).toHaveAccessibleDescription("Use at least 12 characters.");
  await expect(page.getByLabel("Email", { exact: true })).toHaveCSS(
    "font-size",
    "16px",
  );
  const currency = page.getByLabel("Base currency", { exact: true });
  expect((await currency.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await currency.selectOption("JPY");
  await expect(page.getByLabel("Currency decimals")).toHaveValue("0");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await expect(
    page.getByRole("button", { name: "Create workspace", exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("owner-setup.png"),
    fullPage: true,
  });
});

test("setup header reserves the status-bar inset and stays in place while scrolling", async ({ page }) => {
  await page.route("**/api/auth", (route) =>
    route.fulfill({ json: { setupRequired: true, user: null } }),
  );
  await page.goto("/");
  await page.addStyleTag({ content: ":root { --safe-top: 59px; }" });
  const header = page.locator(".auth-top-bar");
  const title = page.getByRole("heading", { name: "Create your workspace" });
  await expect(title).toBeVisible();
  const box = (await header.boundingBox())!;
  expect(box.y).toBe(0);
  expect(box.height).toBeGreaterThanOrEqual(101);
  expect((await title.boundingBox())!.y).toBeGreaterThan(box.y + box.height);
  await page.getByRole("button", { name: "Create workspace" }).scrollIntoViewIfNeeded();
  expect((await header.boundingBox())!.y).toBe(0);
});

test("desktop split layout displays left showcase benefits, arrow submit, and connects login with signup", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("**/api/auth", (route) =>
    route.fulfill({ json: { setupRequired: false, user: null } }),
  );
  await page.goto("/");

  const showcase = page.locator(".auth-showcase");
  await expect(showcase).toBeVisible();
  await expect(showcase.getByText("Manage precious inventory")).toBeVisible();
  await expect(showcase.getByText("Evidence & disclosure")).toBeVisible();
  await expect(showcase.getByText("Sales & memo operations")).toBeVisible();

  await expect(page.locator(".auth-welcome-back")).toHaveText("Welcome back to Gem Management");
  await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();

  const createLink = page.getByRole("button", { name: "Create workspace" });
  await expect(createLink).toBeVisible();
  await createLink.click();

  await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();
  await expect(showcase.locator("h2")).toHaveText("CREATE WORKSPACE.");

  const signInLink = page.locator(".auth-switch-link", { hasText: "Sign in" });
  await expect(signInLink).toBeVisible();
  await signInLink.click();

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(showcase.locator("h2")).toHaveText("WELCOME BACK.");
});
