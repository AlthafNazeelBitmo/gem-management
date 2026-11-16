import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const targetUrl = process.env.TEST_URL || "https://gem-management.vercel.app";
const screenshotDir = path.resolve(
  "/Users/humaid/.gemini/antigravity/brain/a016007f-cd8d-4f85-9ec7-8f983e518b4c/audit_screenshots"
);
mkdirSync(screenshotDir, { recursive: true });

const users = [
  {
    role: "Owner",
    email: "humaidrifai2717@gmail.com",
    name: "Humaid",
    expectedTabs: ["Overview", "Inventory", "Holds & selections", "Memos", "Evidence", "Processing", "Payments", "Activity log", "Show mode", "Settings"],
    forbiddenTabs: [],
  },
  {
    role: "Sales staff",
    email: "elena.sales@bitmo.test",
    name: "Elena Rostova",
    expectedTabs: ["Overview", "Inventory", "Holds & selections", "Memos", "Quotes", "Customers", "Sales", "Show mode"],
    forbiddenTabs: ["Payments", "Activity log", "Settings", "Evidence"],
  },
  {
    role: "Inventory clerk",
    email: "marcus.clerk@bitmo.test",
    name: "Marcus Vance",
    expectedTabs: ["Overview", "Inventory", "Evidence", "Processing", "Purchasing", "Stocktake", "Show mode"],
    forbiddenTabs: ["Payments", "Memos", "Activity log", "Settings"],
  },
  {
    role: "Accounts",
    email: "sophia.accounts@bitmo.test",
    name: "Sophia Chen",
    expectedTabs: ["Overview", "Memos", "Quotes", "Purchasing", "Customers", "Sales", "Payments", "Reports", "Activity log"],
    forbiddenTabs: ["Settings", "Inventory", "Evidence", "Processing", "Holds & selections", "Stocktake", "Show mode"],
  },
  {
    role: "Gem reviewer",
    email: "tariq.reviewer@bitmo.test",
    name: "Dr. Tariq Al-Mansoor",
    expectedTabs: ["Overview", "Inventory", "Evidence"],
    forbiddenTabs: ["Payments", "Memos", "Activity log", "Settings", "Processing", "Purchasing", "Sales"],
  },
  {
    role: "Cutter / lab liaison",
    email: "liam.liaison@bitmo.test",
    name: "Liam O'Connor",
    expectedTabs: ["Overview", "Inventory", "Processing"],
    forbiddenTabs: ["Payments", "Memos", "Activity log", "Evidence", "Settings", "Purchasing", "Sales"],
  },
];

const viewports = [
  { name: "Desktop", width: 1280, height: 800 },
  { name: "Mobile", width: 390, height: 844 },
];

async function runAudit() {
  console.log(`======================================================`);
  console.log(`STARTING LIVE QA AUDIT ON: ${targetUrl}`);
  console.log(`======================================================`);
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of viewports) {
    console.log(`\n======================================================`);
    console.log(`VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`======================================================`);

    for (const u of users) {
      console.log(`\n--- Testing Role: [${u.role}] (${u.email}) on ${vp.name} ---`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent:
          vp.name === "Mobile"
            ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });

      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => {
        consoleErrors.push(err.message);
      });

      const userAudit = {
        role: u.role,
        email: u.email,
        viewport: vp.name,
        loginSuccess: false,
        tabsPassed: 0,
        tabsTotal: u.expectedTabs.length,
        scrollVerified: true,
        securityViolations: [],
        errors: [],
      };

      try {
        // 1. Visit Login Page
        await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 25000 });

        const emailInput = page.locator('input[name="email"]');
        if (await emailInput.isVisible({ timeout: 4000 }).catch(() => false)) {
          await emailInput.fill(u.email);
          await page.locator('input[name="password"]').fill("Password1234!");
          await page.locator('button.primary.wide, button:has-text("Sign in")').click();
          await page.waitForTimeout(1500);
        }

        // Wait for dashboard to load
        await page.waitForSelector('main, .workspace, h2:has-text("Overview")', {
          timeout: 10000,
        });
        userAudit.loginSuccess = true;
        console.log(`  ✓ Login successful`);

        // Verify role indication
        const pageText = await page.textContent("body");
        const roleVisible = pageText.includes(u.role);
        console.log(`  ✓ Role displayed in app: ${roleVisible}`);

        // Take overview screenshot
        const safeRoleName = u.role.replace(/[^a-zA-Z0-9]/g, "_");
        const overviewScreenshot = path.join(
          screenshotDir,
          `${vp.name}_${safeRoleName}_overview.png`
        );
        await page.screenshot({ path: overviewScreenshot });

        // 2. Check Security / Forbidden Tabs
        if (vp.name === "Desktop") {
          const sidebarText = await page.locator("aside.sidebar nav").textContent();
          for (const fTab of u.forbiddenTabs) {
            if (sidebarText.includes(fTab)) {
              userAudit.securityViolations.push(fTab);
              console.log(`  ✗ SECURITY VIOLATION: Forbidden tab "${fTab}" found in Desktop sidebar!`);
            }
          }
        } else {
          // On mobile, check bottom bar and "More" sheet
          const bottomBarText = await page.locator(".mobile-tab-bar").textContent();
          for (const fTab of u.forbiddenTabs) {
            if (bottomBarText.includes(fTab)) {
              userAudit.securityViolations.push(`Bottom bar: ${fTab}`);
              console.log(`  ✗ SECURITY VIOLATION: Forbidden tab "${fTab}" found in Mobile bottom bar!`);
            }
          }

          // Open More sheet to check drawer
          const moreBtn = page.locator('.mobile-tab-bar button:has-text("More")');
          if (await moreBtn.isVisible()) {
            await moreBtn.click();
            await page.waitForTimeout(400);
            const sheetText = await page.locator(".more-menu-content").textContent();
            for (const fTab of u.forbiddenTabs) {
              if (sheetText.includes(fTab)) {
                userAudit.securityViolations.push(`More sheet: ${fTab}`);
                console.log(`  ✗ SECURITY VIOLATION: Forbidden tab "${fTab}" found in Mobile More sheet!`);
              }
            }
            // Close More sheet
            await page.keyboard.press("Escape");
            await page.waitForTimeout(300);
          }
        }

        if (userAudit.securityViolations.length === 0) {
          console.log(`  ✓ Security verified: All ${u.forbiddenTabs.length} forbidden tabs cleanly restricted`);
        }

        // 3. Test Navigation & Scrolling across all expected tabs
        for (const tabName of u.expectedTabs) {
          let clicked = false;

          if (vp.name === "Desktop") {
            const btn = page
              .locator("aside.sidebar nav button")
              .filter({ hasText: tabName })
              .first();
            if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
              await btn.click();
              clicked = true;
            }
          } else {
            // Mobile: check bottom bar first
            const mobileLabel = tabName === "Inventory" ? "Stock" : tabName;
            const bottomBtn = page
              .locator(".mobile-tab-bar button")
              .filter({ hasText: mobileLabel })
              .first();

            if (await bottomBtn.isVisible({ timeout: 800 }).catch(() => false)) {
              await bottomBtn.click();
              clicked = true;
            } else {
              // Open More sheet
              const moreBtn = page.locator('.mobile-tab-bar button:has-text("More")');
              await moreBtn.click();
              await page.waitForTimeout(300);
              const sheetBtn = page
                .locator(".more-menu-content button")
                .filter({ hasText: tabName })
                .first();
              if (await sheetBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await sheetBtn.click();
                clicked = true;
              } else {
                await page.keyboard.press("Escape");
              }
            }
          }

          if (clicked) {
            await page.waitForTimeout(400);

            // Test page scrolling
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

            if (scrollInfo.hasOverflowHidden) {
              userAudit.scrollVerified = false;
              console.log(`  ✗ SCROLL ISSUE on [${tabName}]: overflow is set to hidden!`);
            }

            if (scrollInfo.canScroll) {
              await page.evaluate(() => window.scrollTo(0, 350));
              await page.waitForTimeout(100);
              const scrolledY = await page.evaluate(() => window.scrollY);
              if (scrolledY === 0) {
                userAudit.scrollVerified = false;
                console.log(`  ✗ SCROLL ISSUE on [${tabName}]: page failed to scroll down!`);
              }
              await page.evaluate(() => window.scrollTo(0, 0));
            }

            userAudit.tabsPassed++;
            console.log(
              `  ✓ Tab [${tabName}]: Navigated successfully | Scrollable: ${scrollInfo.canScroll} (Height: ${scrollInfo.scrollHeight}px)`
            );
          } else {
            console.log(`  - Tab [${tabName}]: Tab not accessible directly`);
          }
        }

        // 4. Test interactive stone card / drawer modal if on Inventory
        if (u.expectedTabs.includes("Inventory")) {
          // Go to inventory
          if (vp.name === "Desktop") {
            await page
              .locator("aside.sidebar nav button")
              .filter({ hasText: "Inventory" })
              .first()
              .click();
          } else {
            const stockBtn = page
              .locator(".mobile-tab-bar button")
              .filter({ hasText: "Stock" })
              .first();
            if (await stockBtn.isVisible()) await stockBtn.click();
          }
          await page.waitForTimeout(500);

          const stoneRow = page.locator("tbody tr, .stone-card").first();
          if (await stoneRow.isVisible({ timeout: 2000 }).catch(() => false)) {
            await stoneRow.click();
            await page.waitForTimeout(500);

            const dialog = page.locator("dialog, [role='dialog']").first();
            if (await dialog.isVisible()) {
              const modalScroll = await dialog.evaluate((d) => ({
                scrollHeight: d.scrollHeight,
                clientHeight: d.clientHeight,
                canScroll: d.scrollHeight > d.clientHeight,
              }));

              console.log(
                `  ✓ Modal/Drawer opened | Scrollable: ${modalScroll.canScroll} (${modalScroll.scrollHeight}px / ${modalScroll.clientHeight}px)`
              );

              // Take modal screenshot
              const modalScreenshot = path.join(
                screenshotDir,
                `${vp.name}_${safeRoleName}_inventory_modal.png`
              );
              await page.screenshot({ path: modalScreenshot });

              // Close modal with escape
              await page.keyboard.press("Escape");
              await page.waitForTimeout(300);
            }
          }
        }

        // Filter console errors
        const relevantErrors = consoleErrors.filter(
          (err) =>
            !err.includes("Download the React DevTools") &&
            !err.includes("favicon") &&
            !err.includes("403") &&
            !err.includes("not allowed by policy")
        );
        if (relevantErrors.length > 0) {
          userAudit.errors.push(...relevantErrors);
          console.log(`  ✗ Console Errors: ${relevantErrors.join("; ")}`);
        } else {
          console.log(`  ✓ 0 Console errors recorded`);
        }
      } catch (err) {
        userAudit.errors.push(err.message);
        console.error(`  ✗ Unexpected error for ${u.role}:`, err.message);
      } finally {
        await context.close();
      }

      results.push(userAudit);
    }
  }

  await browser.close();

  console.log(`\n========================================================================================`);
  console.log(`FINAL AUDIT REPORT — ALL 6 ROLES ACROSS DESKTOP & MOBILE VIEWPORTS`);
  console.log(`========================================================================================`);
  console.log(
    `Viewport`.padEnd(10) +
      `Role`.padEnd(24) +
      `Status`.padEnd(14) +
      `Tabs Verified`.padEnd(16) +
      `Security`.padEnd(14) +
      `Scroll`
  );
  console.log(`----------------------------------------------------------------------------------------`);
  let allPassed = true;
  for (const r of results) {
    const isPass =
      r.loginSuccess &&
      r.securityViolations.length === 0 &&
      r.scrollVerified &&
      r.errors.length === 0 &&
      r.tabsPassed === r.tabsTotal;
    if (!isPass) allPassed = false;
    const statusText = isPass ? "PASSED ✅" : "FAILED ❌";
    const secText = r.securityViolations.length === 0 ? "Protected ✅" : "LEAK ❌";
    const scrollText = r.scrollVerified ? "Working ✅" : "BLOCKED ❌";

    console.log(
      r.viewport.padEnd(10) +
        r.role.padEnd(24) +
        statusText.padEnd(14) +
        `${r.tabsPassed}/${r.tabsTotal}`.padEnd(16) +
        secText.padEnd(14) +
        scrollText
    );
  }
  console.log(`========================================================================================`);
  console.log(`OVERALL RESULT: ${allPassed ? "ALL 12 CONFIGURATIONS PASSED PERFECTLY! 🚀" : "SOME CHECKS FAILED."}`);
}

runAudit().catch(console.error);