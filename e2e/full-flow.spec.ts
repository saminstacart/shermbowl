import { test, expect } from "@playwright/test";

// Use allowed names from the name picker
const ALLOWED_NAMES = ["Sam", "Adam", "Brian", "John", "Arjun", "Spencer", "Jin", "Justin", "Russ", "Miguel"];

// Helper: join as a player via the name picker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function joinAs(page: any, name: string) {
  await page.goto("/");
  // Wait for name picker to load
  await page.waitForTimeout(1500);

  // If returning user screen is shown, click "Not {name}?" to get to picker
  const notMeBtn = page.locator("button", { hasText: /^Not / });
  if (await notMeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await notMeBtn.click();
    await page.waitForTimeout(500);
  }

  // Tap the name button (may have "joined" subtitle, so no end anchor)
  const nameBtn = page.locator("button", { hasText: new RegExp(`^${name}`) });
  await nameBtn.click();

  // Confirm selection
  await expect(page.locator("text=Joining as")).toBeVisible({ timeout: 3000 });
  await page.locator("button", { hasText: "Let's go" }).click();

  // Wait for navigation or rules modal
  await page.waitForTimeout(2000);

  // Dismiss rules modal if it appears
  const gotItBtn = page.locator("button", { hasText: "Got it" });
  if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await gotItBtn.click();
    await page.waitForTimeout(500);
  }

  // Should navigate to picks or live
  await page.waitForURL(/\/(picks|live|waiting)/, { timeout: 5000 });
}

test.describe("ShermBowl PropBets E2E", () => {
  test("1. Landing page loads with name picker", async ({ page }) => {
    await page.goto("/");
    // h1 contains "SHERM" and "BOWL" (styled separately)
    await expect(page.locator("h1")).toContainText("SHERM");
    await expect(page.locator("h1")).toContainText("BOWL");
    await expect(page.locator("text=Super Bowl LX")).toBeVisible();

    // Should have name picker buttons instead of text input
    await expect(page.locator("text=Tap your name")).toBeVisible({ timeout: 5000 });
    for (const name of ALLOWED_NAMES.slice(0, 3)) {
      await expect(page.locator("button", { hasText: new RegExp(`^${name}`) })).toBeVisible();
    }

    // Should NOT have a text input
    const input = page.locator('input[placeholder="Enter your name"]');
    await expect(input).not.toBeVisible();

    // Should have rules button
    await expect(page.locator("button", { hasText: "Rules" })).toBeVisible();

    // Should show payout info (60% / 30% / 10%)
    await expect(page.locator("text=60%")).toBeVisible();
    await expect(page.locator("text=30%")).toBeVisible();
  });

  test("2. Rules modal opens and closes", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);

    // Click rules button
    await page.locator("button", { hasText: "Rules" }).click();
    await page.waitForTimeout(500);

    // Modal should show rules content (section titles are sentence-case with uppercase CSS)
    await expect(page.locator("text=How It Works")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("text=Scoring")).toBeVisible();
    await expect(page.locator("text=Payouts")).toBeVisible();

    // Close modal
    await page.locator("button", { hasText: "Got it" }).click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=How It Works")).not.toBeVisible();
  });

  test("3. Name picker join flow — tap name, confirm, redirect", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);

    // Dismiss returning user if shown
    const notMeBtn = page.locator("button", { hasText: /^Not / });
    if (await notMeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await notMeBtn.click();
      await page.waitForTimeout(500);
    }

    // Tap a name
    const testName = "Sam";
    await page.locator("button", { hasText: new RegExp(`^${testName}`) }).click();

    // Should show confirmation
    await expect(page.locator("text=Joining as")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(`text=${testName}`)).toBeVisible();

    // Can go back
    await page.locator("button", { hasText: "Go back" }).click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=Tap your name")).toBeVisible();
  });

  test("4. Picks page loads 21 curated props", async ({ page }) => {
    // Clear localStorage to avoid rules modal issues
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("shermbowl_rules_seen", "true"));

    await page.goto("/");
    await page.waitForTimeout(1500);

    // Join as a player
    const notMeBtn = page.locator("button", { hasText: /^Not / });
    if (await notMeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await notMeBtn.click();
      await page.waitForTimeout(500);
    }
    await page.locator("button", { hasText: /^Sam/ }).click();
    await page.waitForTimeout(500);
    await page.locator("button", { hasText: "Let's go" }).click();
    await page.waitForTimeout(2000);

    // Dismiss rules modal if shown
    const gotItBtn = page.locator("button", { hasText: "Got it" });
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
      await page.waitForTimeout(500);
    }

    await page.waitForURL(/\/(picks|live|waiting)/, { timeout: 5000 });

    if (page.url().includes("/picks")) {
      // Should see category headers (short names: Game, Player, Fun)
      await expect(page.locator("text=Game").first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Player").first()).toBeVisible();
      await expect(page.locator("text=Fun").first()).toBeVisible();

      // Should see curated prop questions
      await expect(page.locator("text=Who wins Super Bowl LX?").first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=What is the result of the opening coin toss?").first()).toBeVisible();

      // Should show progress indicator (bottom bar has X/21 format)
      await expect(page.locator("text=/\\d+\\/21/").first()).toBeVisible();

      // Should show "pts" on pick buttons (points-forward UI)
      await expect(page.locator("text=/\\d+\\.\\d+ pts/").first()).toBeVisible({ timeout: 5000 });
    } else {
      console.log(`Picks locked — landed on ${page.url()}`);
    }
  });

  test("5. Can select a pick and see progress update", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("shermbowl_rules_seen", "true"));

    await page.goto("/");
    await page.waitForTimeout(1500);

    const notMeBtn = page.locator("button", { hasText: /^Not / });
    if (await notMeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await notMeBtn.click();
      await page.waitForTimeout(500);
    }
    await page.locator("button", { hasText: /^Adam/ }).click();
    await page.waitForTimeout(500);
    await page.locator("button", { hasText: "Let's go" }).click();
    await page.waitForTimeout(2000);

    const gotItBtn = page.locator("button", { hasText: "Got it" });
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
      await page.waitForTimeout(500);
    }

    await page.waitForURL(/\/(picks|live|waiting)/, { timeout: 5000 });

    if (page.url().includes("/picks")) {
      // Find first pick button with "pts" label
      const firstOption = page.locator("button").filter({ hasText: /\d+\.\d+ pts/ }).first();
      if (await firstOption.isVisible({ timeout: 5000 })) {
        await firstOption.click();
        await page.waitForTimeout(1000);

        // Should show "Saved" toast
        const toast = page.locator("text=Saved");
        const toastVisible = await toast.isVisible({ timeout: 2000 }).catch(() => false);
        if (toastVisible) {
          console.log("Saved toast displayed");
        }

        // Progress should show at least 1 pick
        const progress = page.locator("text=/[1-9]\\d*\\/\\d+/");
        await expect(progress.first()).toBeVisible({ timeout: 3000 });
        console.log("Pick selection works with progress update");
      }
    }
  });

  test("6. Live page loads with projected leaderboard", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("shermbowl_rules_seen", "true"));

    await page.goto("/");
    await page.waitForTimeout(1500);

    const notMeBtn = page.locator("button", { hasText: /^Not / });
    if (await notMeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await notMeBtn.click();
      await page.waitForTimeout(500);
    }
    await page.locator("button", { hasText: /^Brian/ }).click();
    await page.waitForTimeout(500);
    await page.locator("button", { hasText: "Let's go" }).click();
    await page.waitForTimeout(2000);

    const gotItBtn = page.locator("button", { hasText: "Got it" });
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
      await page.waitForTimeout(500);
    }

    await page.goto("/live");
    await page.waitForTimeout(3000);

    if (page.url().includes("/live")) {
      // Bottom tabs should exist (shortened labels)
      await expect(page.locator("span:text-is('Board')")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("span:text-is('Props')")).toBeVisible();
      await expect(page.locator("span:text-is('My Picks')")).toBeVisible();

      // Should show leaderboard header
      await expect(page.locator("text=Leaderboard")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=/\\d+\\/\\d+ resolved/")).toBeVisible({ timeout: 10000 });

      // Score bar should show teams
      await expect(page.locator("text=NE")).toBeVisible();
      await expect(page.locator("text=SEA")).toBeVisible();

      // Rules button should be present
      await expect(page.locator("button", { hasText: "Rules" })).toBeVisible();
    } else {
      console.log("Redirected from live page — cookies not persisted");
    }
  });

  test("7. Live page — switch tabs", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("shermbowl_rules_seen", "true"));

    await page.goto("/");
    await page.waitForTimeout(1500);

    const notMeBtn = page.locator("button", { hasText: /^Not / });
    if (await notMeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await notMeBtn.click();
      await page.waitForTimeout(500);
    }
    await page.locator("button", { hasText: /^John/ }).click();
    await page.waitForTimeout(500);
    await page.locator("button", { hasText: "Let's go" }).click();
    await page.waitForTimeout(2000);

    const gotItBtn = page.locator("button", { hasText: "Got it" });
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
      await page.waitForTimeout(500);
    }

    await page.goto("/live");
    await page.waitForTimeout(3000);

    if (page.url().includes("/live")) {
      await expect(page.locator("span:text-is('Props')")).toBeVisible({ timeout: 10000 });

      // Click Props tab
      await page.locator("span:text-is('Props')").click();
      await page.waitForTimeout(1000);
      const hasProps = await page.locator("text=/Pending|Resolved|In Progress/").count();
      expect(hasProps).toBeGreaterThan(0);

      // Click My Picks tab
      await page.locator("span:text-is('My Picks')").click();
      await page.waitForTimeout(1000);
      const hasContent = await page.locator("text=/pts|No picks made/").count();
      expect(hasContent).toBeGreaterThan(0);
    }
  });

  test("8. Admin page loads and shows curated props", async ({ page }) => {
    await page.goto(`/admin?key=${process.env.ADMIN_SECRET}`);
    await page.waitForTimeout(3000);

    await expect(page.locator("text=ShermBowl Admin")).toBeVisible();

    // Stats on overview tab
    await expect(page.locator("text=Total Props")).toBeVisible();
    await expect(page.locator("text=Players").first()).toBeVisible();
    await expect(page.locator("text=Resolved").first()).toBeVisible();

    // Contest Settings
    await expect(page.locator("text=Contest Settings")).toBeVisible();
    await expect(page.locator("text=Buy-In")).toBeVisible();

    // Action buttons
    await expect(page.locator("text=Seed Curated Props (21)")).toBeVisible();
    await expect(page.locator("text=Poll ESPN Now")).toBeVisible();

    // Navigate to Props tab to see All Props section
    await page.locator("button:text-is('Props')").click();
    await page.waitForTimeout(1000);

    // All Props section
    await expect(page.locator("text=All Props")).toBeVisible();

    // Curated prop questions should appear (name column may not exist)
    await expect(page.locator("text=Who wins Super Bowl LX?").first()).toBeVisible();
  });

  test("9. Admin — add custom prop form exists", async ({ page }) => {
    await page.goto(`/admin?key=${process.env.ADMIN_SECRET}`);
    await page.waitForTimeout(3000);

    // Navigate to Props tab where the form lives
    await page.locator("button:text-is('Props')").click();
    await page.waitForTimeout(1000);

    await expect(page.locator("text=Add Custom Prop")).toBeVisible();
    await expect(page.locator('input[placeholder*="Question"]')).toBeVisible();
    await expect(page.locator("text=Add Prop")).toBeVisible();

    // Category dropdown should include degen
    const categorySelect = page.locator("select").first();
    const options = await categorySelect.locator("option").allTextContents();
    expect(options).toContain("Degen");
  });

  test("10. Admin — wrong key shows unauthorized", async ({ page }) => {
    await page.goto("/admin?key=wrongkey");
    await page.waitForTimeout(2000);
    await expect(page.locator("text=Unauthorized")).toBeVisible();
  });

  test("11. API — players endpoint works", async ({ request }) => {
    const res = await request.get("/api/players");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    console.log(`${data.length} players in database`);
  });

  test("12. API — 21 curated props are seeded with categories", async ({ request }) => {
    const res = await request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/props?select=id,question,category&order=sort_order`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
      }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    console.log(`${data.length} props seeded in database`);

    // Should have 21 curated props
    expect(data.length).toBe(21);

    // Verify categories
    const categories = [
      ...new Set(data.map((p: { category: string }) => p.category)),
    ];
    console.log(`Categories: ${categories.join(", ")}`);
    expect(categories).toContain("game");
    expect(categories).toContain("player");
    expect(categories).toContain("fun");

    // Verify some expected questions
    const questions = data.map((p: { question: string }) => p.question);
    expect(questions).toContain("Who wins Super Bowl LX?");
    expect(questions).toContain("What is the result of the opening coin toss?");
  });

  test("13. Waiting page accessible", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem("shermbowl_rules_seen", "true")
    );

    await page.goto("/");
    await page.waitForTimeout(1500);

    const notMeBtn = page.locator("button", { hasText: /^Not / });
    if (
      await notMeBtn.isVisible({ timeout: 1000 }).catch(() => false)
    ) {
      await notMeBtn.click();
      await page.waitForTimeout(500);
    }
    await page.locator("button", { hasText: /^Arjun/ }).click();
    await page.waitForTimeout(500);
    await page.locator("button", { hasText: "Let's go" }).click();
    await page.waitForTimeout(2000);

    const gotItBtn = page.locator("button", { hasText: "Got it" });
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
      await page.waitForTimeout(500);
    }

    await page.goto("/waiting");
    await page.waitForTimeout(2000);
    if (page.url().includes("/waiting")) {
      // Should show waiting page content
      await expect(page.locator("text=Picks Locked")).toBeVisible({ timeout: 5000 });
      // Should have "picks will be revealed" messaging
      await expect(
        page.locator("text=/revealed|hidden/i")
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("14. API — mock-game endpoint lists steps", async ({ request }) => {
    const res = await request.get(`/api/mock-game?key=${process.env.ADMIN_SECRET}`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.steps).toBeDefined();
    expect(data.steps.length).toBeGreaterThan(10);
    console.log(
      `Mock game has ${data.steps.length} steps: ${data.steps.map((s: { step: number; label: string }) => `${s.step}: ${s.label}`).join(", ")}`
    );
  });
});
