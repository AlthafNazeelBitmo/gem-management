import { test, expect } from "@playwright/test";
import { rolePages, Role } from "../src/data";

const users: { role: Role; email: string; name: string }[] = [
  { role: "Owner", email: "humaidrifai2717@gmail.com", name: "Humaid" },
  { role: "Sales staff", email: "elena.sales@bitmo.test", name: "Elena Rostova" },
  { role: "Inventory clerk", email: "marcus.clerk@bitmo.test", name: "Marcus Vance" },
  { role: "Accounts", email: "sophia.accounts@bitmo.test", name: "Sophia Chen" },
  { role: "Gem reviewer", email: "tariq.reviewer@bitmo.test", name: "Dr. Tariq Al-Mansoor" },
  { role: "Cutter / lab liaison", email: "liam.liaison@bitmo.test", name: "Liam O'Connor" },
];

const viewports = [
  { name: "Desktop", width: 1280, height: 800 },
  { name: "Mobile", width: 390, height: 844 },
];

for (const vp of viewports) {
  test.describe(`${vp.name} Viewport (${vp.width}x${vp.height}) - All User Roles`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const u of users) {
      test(`Role: ${u.role} (${u.email})`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text());
          }
        });
        page.on("pageerror", (err) => {
          consoleErrors.push(err.message);
        });

        // 1. Navigate to login / app
        await page.goto("/");

        // Check if already logged in or need to log in
        const emailInput = page.getByLabel("Email", { exact: false });
        if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await emailInput.fill(u.email);
          const passwordInput = page.getByLabel("Password", { exact: false });
          await passwordInput.fill("Password1234!");
          await page.getByRole("button", { name: /sign in|log in/i }).click();
        }

        // Wait for dashboard to load
        await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({
          timeout: 10000,
        });

        // Verify role indicator or welcome
        const roleIndicator = page.locator(".user-role, .user-badge, header");
        await expect(roleIndicator.first()).toContainText(u.role);

        const pagesForRole = rolePages[u.role] || ["Overview"];

        // 2. Test each page for this role
        for (const pageName of pagesForRole) {
          // Click tab
          const tabBtn = page.getByRole("button", { name: pageName, exact: true });
          
          if (await tabBtn.isVisible()) {
            await tabBtn.click();
            await page.waitForTimeout(300);

            // Check page scrollability
            const scrollInfo = await page.evaluate(() => {
              const el = document.scrollingElement || document.documentElement;
              const hasOverflowHidden =
                window.getComputedStyle(document.body).overflow === "hidden" ||
                window.getComputedStyle(document.documentElement).overflow === "hidden";
              return {
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                canScroll: el.scrollHeight > el.clientHeight,
                hasOverflowHidden,
              };
            });

            // If page is tall, test scrolling
            if (scrollInfo.canScroll) {
              await page.evaluate(() => window.scrollTo(0, 500));
              await page.waitForTimeout(100);
              const scrolledY = await page.evaluate(() => window.scrollY);
              expect(scrolledY).toBeGreaterThan(0);
              await page.evaluate(() => window.scrollTo(0, 0));
            }

            // Check that page content is not hidden behind mobile navigation bar
            if (vp.name === "Mobile") {
              const bottomPadding = await page.evaluate(() => {
                const main = document.querySelector("main") || document.body;
                return parseInt(window.getComputedStyle(main).paddingBottom, 10) || 0;
              });
              // Ensure bottom padding is present on mobile so content isn't blocked by bottom bar
              expect(bottomPadding).toBeGreaterThanOrEqual(40);
            }
          }
        }

        // 3. Test interactive modal / drawer if role can access inventory
        if (pagesForRole.includes("Inventory")) {
          const invBtn = page.getByRole("button", { name: "Inventory", exact: true });
          if (await invBtn.isVisible()) {
            await invBtn.click();
            await page.waitForTimeout(300);

            // If stone card or row exists, click to open stone drawer/details
            const stoneRow = page.locator("tbody tr, .stone-card").first();
            if (await stoneRow.isVisible({ timeout: 2000 }).catch(() => false)) {
              await stoneRow.click();
              await page.waitForTimeout(300);

              const dialog = page.getByRole("dialog");
              if (await dialog.isVisible()) {
                // Ensure dialog can be closed
                const closeBtn = dialog.getByRole("button", { name: /close|done|cancel/i }).first();
                if (await closeBtn.isVisible()) {
                  await closeBtn.click();
                } else {
                  await page.keyboard.press("Escape");
                }
                await page.waitForTimeout(200);
              }
            }
          }
        }

        // 4. Log out to prepare for next user
        const signOutBtn = page.getByRole("button", { name: /sign out|log out/i });
        if (await signOutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await signOutBtn.click();
          await page.waitForTimeout(500);
        } else {
          // If menu needed to see sign out
          const userMenu = page.locator(".user-menu, header button").last();
          if (await userMenu.isVisible()) {
            await userMenu.click();
            const menuSignOut = page.getByRole("button", { name: /sign out|log out/i });
            if (await menuSignOut.isVisible()) {
              await menuSignOut.click();
            }
          }
        }

        // Filter out benign Vite HMR or CSS warnings
        const criticalErrors = consoleErrors.filter(
          (err) => !err.includes("Download the React DevTools") && !err.includes("favicon")
        );
        expect(criticalErrors).toEqual([]);
      });
    }
  });
}

