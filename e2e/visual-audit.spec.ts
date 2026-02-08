import { test, expect } from "@playwright/test";

const BASE = "https://shermbowl.vercel.app";
const SCREENSHOTS = "visual-audit";

// Helper: get or create Spencer, resilient to rate limits
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSpencerId(page: any): Promise<string> {
  // Try POST first
  const postRes = await page.request.post(`${BASE}/api/players`, {
    data: { name: "Spencer" },
  });
  const postData = await postRes.json();
  if (postData.id) return postData.id;

  // Fallback: GET all players and find Spencer
  const getRes = await page.request.get(`${BASE}/api/players`);
  const players = await getRes.json();
  const spencer = players.find(
    (p: { name: string }) => p.name === "Spencer"
  );
  if (spencer?.id) return spencer.id;

  throw new Error("Could not get or create Spencer player");
}

// Test on both mobile and desktop viewports
const viewports = [
  { name: "mobile", width: 390, height: 844 }, // iPhone 14
  { name: "desktop", width: 1280, height: 800 },
];

for (const vp of viewports) {
  test.describe(`Visual Audit — ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("1. Landing page", async ({ page }) => {
      await page.goto(BASE);
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-01-landing.png`,
        fullPage: true,
      });

      // Check key elements
      await expect(page.locator("text=SHERMBOWL")).toBeVisible();
      await expect(page.locator("text=Tap your name")).toBeVisible();
    });

    test("2. Rules modal", async ({ page }) => {
      await page.goto(BASE);
      await page.waitForTimeout(1500);
      await page.locator("button:text-is('Rules')").click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-02-rules-modal.png`,
        fullPage: false,
      });
    });

    test("3. Name confirmation step", async ({ page }) => {
      await page.goto(BASE);
      await page.waitForTimeout(1500);

      // Clear cookies first
      await page.context().clearCookies();
      await page.reload();
      await page.waitForTimeout(1500);

      // Tap a name
      await page.locator("button:has-text('Spencer')").first().click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-03-name-confirm.png`,
        fullPage: true,
      });
    });

    test("4. Picks page — empty state with scoring dashboard", async ({
      page,
    }) => {
      const spencerId = await getSpencerId(page);

      await page.context().addCookies([
        {
          name: "shermbowl_player_id",
          value: spencerId,
          domain: "shermbowl.vercel.app",
          path: "/",
        },
        {
          name: "shermbowl_player_name",
          value: "Spencer",
          domain: "shermbowl.vercel.app",
          path: "/",
        },
      ]);

      await page.goto(`${BASE}/picks`);
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-04-picks-empty.png`,
        fullPage: false,
      });

      // Scroll to show more props
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-04b-picks-scrolled.png`,
        fullPage: false,
      });
    });

    test("5. Picks page — with selections and scoring dashboard", async ({
      page,
    }) => {
      // Join as Spencer
      const spencerId = await getSpencerId(page);

      await page.context().addCookies([
        {
          name: "shermbowl_player_id",
          value: spencerId,
          domain: "shermbowl.vercel.app",
          path: "/",
        },
        {
          name: "shermbowl_player_name",
          value: "Spencer",
          domain: "shermbowl.vercel.app",
          path: "/",
        },
      ]);

      await page.goto(`${BASE}/picks`);
      await page.waitForTimeout(3000);

      // Make some picks — click first option on first few props
      const buttons = page.locator(
        'button:has-text("pts")'
      );
      const count = await buttons.count();

      // Pick first option on first 6 props (covers multiple categories)
      for (let i = 0; i < Math.min(count, 12); i += 2) {
        try {
          await buttons.nth(i).click();
          await page.waitForTimeout(200);
        } catch {
          break;
        }
      }

      await page.waitForTimeout(1000);

      // Screenshot with scoring dashboard populated
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-05-picks-with-selections.png`,
        fullPage: false,
      });

      // Scroll down to show header scoring bar persists
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-05b-picks-scrolled-with-header.png`,
        fullPage: false,
      });

      // Scroll further to show more props with picks
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-05c-picks-deep-scroll.png`,
        fullPage: false,
      });
    });

    test("6. Waiting page", async ({ page }) => {
      const spencerId = await getSpencerId(page);

      await page.context().addCookies([
        {
          name: "shermbowl_player_id",
          value: spencerId,
          domain: "shermbowl.vercel.app",
          path: "/",
        },
        {
          name: "shermbowl_player_name",
          value: "Spencer",
          domain: "shermbowl.vercel.app",
          path: "/",
        },
      ]);

      await page.goto(`${BASE}/waiting`);
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-06-waiting.png`,
        fullPage: true,
      });
    });

    test("7. Live page — leaderboard tab", async ({ page }) => {
      const spencerId = await getSpencerId(page);

      await page.context().addCookies([
        {
          name: "shermbowl_player_id",
          value: spencerId,
          domain: "shermbowl.vercel.app",
          path: "/",
        },
        {
          name: "shermbowl_player_name",
          value: "Spencer",
          domain: "shermbowl.vercel.app",
          path: "/",
        },
      ]);

      await page.goto(`${BASE}/live`);
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-07-live-leaderboard.png`,
        fullPage: false,
      });
    });

    test("8. Live page — props tab", async ({ page }) => {
      const spencerId = await getSpencerId(page);

      await page.context().addCookies([
        {
          name: "shermbowl_player_id",
          value: spencerId,
          domain: "shermbowl.vercel.app",
          path: "/",
        },
        {
          name: "shermbowl_player_name",
          value: "Spencer",
          domain: "shermbowl.vercel.app",
          path: "/",
        },
      ]);

      await page.goto(`${BASE}/live`);
      await page.waitForTimeout(2000);

      // Click Props tab
      await page.locator("span:text-is('Props')").click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-08-live-props.png`,
        fullPage: false,
      });
    });

    test("9. Live page — my picks tab", async ({ page }) => {
      const spencerId = await getSpencerId(page);

      await page.context().addCookies([
        {
          name: "shermbowl_player_id",
          value: spencerId,
          domain: "shermbowl.vercel.app",
          path: "/",
        },
        {
          name: "shermbowl_player_name",
          value: "Spencer",
          domain: "shermbowl.vercel.app",
          path: "/",
        },
      ]);

      await page.goto(`${BASE}/live`);
      await page.waitForTimeout(2000);

      await page.locator("span:text-is('My Picks')").click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-09-live-mypicks.png`,
        fullPage: false,
      });
    });

    test("10. Admin page — overview", async ({ page }) => {
      await page.goto(`${BASE}/admin?key=${process.env.ADMIN_SECRET}`);
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-10-admin-overview.png`,
        fullPage: false,
      });

      // Scroll to see more
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-10b-admin-overview-scroll.png`,
        fullPage: false,
      });
    });

    test("11. Admin page — players section", async ({ page }) => {
      await page.goto(`${BASE}/admin?key=${process.env.ADMIN_SECRET}`);
      await page.waitForTimeout(2000);
      await page.locator("button:text-is('Players')").click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-11-admin-players.png`,
        fullPage: false,
      });
    });

    test("12. Admin page — props section", async ({ page }) => {
      await page.goto(`${BASE}/admin?key=${process.env.ADMIN_SECRET}`);
      await page.waitForTimeout(2000);
      await page.locator("button:text-is('Props')").click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: `${SCREENSHOTS}/${vp.name}-12-admin-props.png`,
        fullPage: false,
      });
    });
  });
}
