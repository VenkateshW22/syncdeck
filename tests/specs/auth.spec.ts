import { test, expect } from "../fixtures/testFixtures";

test.describe("Authentication Specs", () => {
  test("Host Login - invalid admin key failure", async ({ landingPage, page }) => {
    await landingPage.navigate();
    await landingPage.createRoom("Professor Adam", "WRONG_KEY");
    // Should display error toast for invalid admin key
    await expect(page.locator("text=Invalid Admin Key")).toBeVisible();
  });

  test("Host Login - success & JWT persistence", async ({ landingPage, page }) => {
    await landingPage.navigate();
    await landingPage.createRoom("Professor Adam", "VK2212");
    
    // Should transition to host dashboard
    await expect(page).toHaveURL(/\/host\//, { timeout: 15000 });
    await expect(page.locator("text=SyncDeck Room:")).toBeVisible();

    // Verify token exists in sessionStorage
    const sessionStore = await page.evaluate(() => sessionStorage.getItem("syncdeck-session"));
    expect(sessionStore).not.toBeNull();
    const session = JSON.parse(sessionStore || "{}");
    expect(session.state.token).not.toBeNull();
    expect(session.state.role).toBe("HOST");
  });

  test("Session persistence on refresh", async ({ landingPage, page }) => {
    await landingPage.navigate();
    await landingPage.createRoom("Professor Adam", "VK2212");
    await expect(page).toHaveURL(/\/host\//, { timeout: 15000 });

    // Refresh page
    await page.reload();

    // Session should survive refresh
    await expect(page.locator("text=SyncDeck Room:")).toBeVisible();
  });

  test("Cross-tab logout synchronization", async ({ landingPage, page, context }) => {
    await landingPage.navigate();
    await landingPage.createRoom("Professor Adam", "VK2212");
    await expect(page).toHaveURL(/\/host\//, { timeout: 15000 });

    // Open second tab in same context (sharing sessionStorage clone or auth channel)
    const tab2 = await context.newPage();
    await tab2.goto("/");
    
    // Inject the session storage from tab1 to tab2 to simulate duplicated tab
    const sessionData = await page.evaluate(() => sessionStorage.getItem("syncdeck-session"));
    await tab2.evaluate((data) => sessionStorage.setItem("syncdeck-session", data || ""), sessionData);
    await tab2.goto(page.url()); // go directly to dashboard
    await expect(tab2.locator("text=SyncDeck Room:")).toBeVisible();

    // Trigger logout (End session) on tab1
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.click('button:has-text("End")');
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Tab 2 should automatically log out and return to landing page via BroadcastChannel
    await expect(tab2).toHaveURL("/", { timeout: 10000 });
  });
});
