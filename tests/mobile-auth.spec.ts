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

for (const [width, height] of [[320, 640], [768, 700], [1041, 962], [1100, 500], [1280, 800], [1440, 900]]) {
  test(`authentication stays aligned and reachable at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.route("**/api/auth", (route) =>
      route.fulfill({ json: { setupRequired: false, user: null } }),
    );
    await page.goto("/");
    for (const setup of [false, true]) {
      if (setup) await page.locator(".auth-switch-link").click();
      await expect(page.locator("#auth-title")).toBeVisible();
      const form = (await page.locator(".auth-form").boundingBox())!;
      const heading = (await page.locator(".auth-heading").boundingBox())!;
      expect(Math.abs(heading.x + heading.width / 2 - (form.x + form.width / 2))).toBeLessThan(2);
      if (width >= 1100) {
        expect(Math.abs(form.x + form.width - width)).toBeLessThan(2);
      } else {
        expect(Math.abs(form.x + form.width / 2 - width / 2)).toBeLessThan(2);
      }
      const password = page.getByLabel("Password", { exact: true });
      await page.getByLabel("Email", { exact: true }).focus();
      await page.keyboard.press("Tab");
      await expect(password).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Show password", exact: true })).toBeFocused();
      await password.fill("layout-test-password");
      await page.getByRole("button", { name: "Show password", exact: true }).click();
      await expect(password).toHaveAttribute("type", "text");
      await page.getByRole("button", { name: "Hide password", exact: true }).click();
      await expect(password).toHaveAttribute("type", "password");
      await expect(password).toHaveCSS("padding-right", "70px");
      if (setup) {
        const groups = await page.locator(".auth-group").all();
        if (width >= 1100) {
          expect(Math.abs((await groups[0].boundingBox())!.y - (await groups[1].boundingBox())!.y)).toBeLessThan(2);
        }
        expect((await page.getByLabel("Base currency", { exact: true }).boundingBox())!.width).toBeGreaterThan(200);
      }
      await page.locator(".auth-switch-link").scrollIntoViewIfNeeded();
      await expect(page.locator(".auth-switch-link")).toBeInViewport();
      await page.locator("#auth-title").scrollIntoViewIfNeeded();
      await expect(page.locator("#auth-title")).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: info.outputPath(setup ? "signup.png" : "login.png"), fullPage: true });
    }
  });
}

test("desktop signup preserves settings and shows submission errors", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.route("**/api/auth", (route) =>
    route.fulfill({ json: { setupRequired: true, user: null } }),
  );
  await page.route("**/api/setup", (route) =>
    route.fulfill({ status: 400, json: { error: "Setup could not be completed. Try again." } }),
  );
  await page.goto("/");
  await page.getByLabel("Your name", { exact: true }).fill("Layout tester");
  await page.getByLabel("Business name", { exact: true }).fill("Test workspace");
  await page.getByLabel("Email", { exact: true }).fill("layout@example.test");
  await page.getByLabel("Password", { exact: true }).fill("layout-test-password");
  await page.getByLabel("Base currency", { exact: true }).selectOption("KWD");
  await expect(page.getByLabel("Currency decimals")).toHaveValue("3");
  await page.getByLabel("Launch country", { exact: true }).selectOption("Sri Lanka");
  await page.getByLabel("Use this workspace for training and demonstrations").check();
  await page.getByRole("button", { name: "Create workspace", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Setup could not be completed. Try again.");
  await expect(page.getByLabel("Base currency", { exact: true })).toHaveValue("KWD");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
});
