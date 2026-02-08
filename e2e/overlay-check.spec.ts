import { test, expect } from "@playwright/test";

const BASE = "https://shermbowl.vercel.app";

// Helper: get or create Spencer, resilient to rate limits
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSpencerId(page: any): Promise<string> {
  const postRes = await page.request.post(`${BASE}/api/players`, {
    data: { name: "Spencer" },
  });
  const postData = await postRes.json();
  if (postData.id) return postData.id;

  const getRes = await page.request.get(`${BASE}/api/players`);
  const players = await getRes.json();
  const spencer = players.find(
    (p: { name: string }) => p.name === "Spencer"
  );
  if (spencer?.id) return spencer.id;
  throw new Error("Could not get or create Spencer player");
}

test.describe("Header scoring bar — no content overlap", () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14

  test("Header shows scoring row and never overlaps prop cards", async ({ page }) => {
    // Join as a real player
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

    // Make 5 picks so the scoring row has data
    const pickButtons = page.locator('button:has-text("pts")');
    const count = await pickButtons.count();
    for (let i = 0; i < Math.min(5, count); i++) {
      await pickButtons.nth(i).click();
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(500);

    // --- ASSERTION 1: Header contains scoring info ---
    const header = page.locator(".sticky.top-0").first();
    await expect(header).toBeVisible();
    // Should show points text and progress counter
    await expect(header.locator("text=/\\d+\\/\\d+/")).toBeVisible(); // e.g. "5/21"
    await expect(header.locator("text=/pts|if you sweep/")).toBeVisible();

    // --- Screenshot 1: Top of page ---
    await page.screenshot({ path: "e2e/screenshots/header-scoring-top.png", fullPage: false });

    // --- ASSERTION 2: No overlap at top ---
    const headerBox = await header.boundingBox();
    expect(headerBox).toBeTruthy();

    // Find the first prop card visible below the header
    const propCards = page.locator('[id^="prop-"]');
    const firstCardBox = await propCards.first().boundingBox();
    if (headerBox && firstCardBox) {
      // The top of the first card must be below the bottom of the header
      expect(firstCardBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 2);
    }

    // --- ASSERTION 3: After scrolling, header stays visible with scoring ---
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);

    await expect(header).toBeVisible();
    await expect(header.locator("text=/\\d+\\/\\d+/")).toBeVisible();
    await expect(header.locator("text=/pts|if you sweep/")).toBeVisible();

    // --- Screenshot 2: After scroll ---
    await page.screenshot({ path: "e2e/screenshots/header-scoring-scrolled.png", fullPage: false });

    // --- ASSERTION 4: No overlap after scrolling ---
    const headerBoxScrolled = await header.boundingBox();
    // Find the first prop card that's currently in the viewport (below header)
    const visibleCards = await propCards.evaluateAll((cards) => {
      return cards
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.id, top: r.top, bottom: r.bottom, height: r.height };
        })
        .filter((c) => c.bottom > 0 && c.top < window.innerHeight); // in viewport
    });

    if (headerBoxScrolled && visibleCards.length > 0) {
      // With a sticky header, cards naturally scroll behind it.
      // Verify no card is FULLY hidden (top AND bottom behind header).
      const headerBottom = headerBoxScrolled.y + headerBoxScrolled.height;
      const fullyHidden = visibleCards.filter(
        (c) => c.top < headerBottom && c.bottom < headerBottom
      );
      expect(fullyHidden).toHaveLength(0);
    }

    // --- ASSERTION 5: Deep scroll still works ---
    await page.evaluate(() => window.scrollBy(0, 1200));
    await page.waitForTimeout(500);

    await expect(header).toBeVisible();
    await expect(header.locator("text=/\\d+\\/\\d+/")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/header-scoring-deep.png", fullPage: false });

    // --- ASSERTION 6: No fixed/absolute overlay elements bleeding over content ---
    // Check that there are NO position:fixed elements between the header and the prop cards
    // (This catches the exact bug that kept recurring)
    const fixedOverlays = await page.evaluate(() => {
      const fixed = document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]');
      const overlays: { tag: string; top: number; zIndex: string; text: string }[] = [];
      fixed.forEach((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        // Only flag elements that are in the content area (not bottom bar, not toasts)
        if (rect.top > 0 && rect.top < window.innerHeight / 2) {
          overlays.push({
            tag: el.tagName,
            top: rect.top,
            zIndex: style.zIndex,
            text: (el as HTMLElement).innerText?.slice(0, 50) || "",
          });
        }
      });
      return overlays;
    });

    // The sticky header is position:sticky (not fixed), so there should be
    // no fixed-position scoring overlays in the top half of the viewport
    const scoringOverlays = fixedOverlays.filter(
      (o) => o.text.includes("pts") || o.text.includes("sweep") || o.text.includes("/21") || o.text.includes("/20")
    );
    expect(scoringOverlays).toHaveLength(0);

    console.log("All overlap assertions passed. Screenshots saved to e2e/screenshots/");
  });
});
