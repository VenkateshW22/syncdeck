import { test as base, Page, BrowserContext } from "@playwright/test";
import { LandingPage } from "../pages/LandingPage";
import { HostDashboardPage } from "../pages/HostDashboardPage";
import { ParticipantDashboardPage } from "../pages/ParticipantDashboardPage";
import { clearDatabaseAndRedis } from "../helpers/dbCleanups";

type CustomFixtures = {
  landingPage: LandingPage;
  hostDashboard: HostDashboardPage;
  createParticipant: (name: string) => Promise<{ page: Page; dashboard: ParticipantDashboardPage; context: BrowserContext }>;
};

export const test = base.extend<CustomFixtures>({
  // Clean up database before and after each test
  beforeEach: [async ({}, use) => {
    await clearDatabaseAndRedis();
    await use();
  }, { auto: true }],

  afterEach: [async ({}, use) => {
    await clearDatabaseAndRedis();
    await use();
  }, { auto: true }],

  landingPage: async ({ page }, use) => {
    const landing = new LandingPage(page);
    await use(landing);
  },

  hostDashboard: async ({ page }, use) => {
    const dashboard = new HostDashboardPage(page);
    await use(dashboard);
  },

  createParticipant: async ({ browser }, use) => {
    const participantContexts: BrowserContext[] = [];
    const participantPages: Page[] = [];

    const creator = async (name: string) => {
      const context = await browser.newContext();
      participantContexts.push(context);
      
      const page = await context.newPage();
      participantPages.push(page);
      
      const landing = new LandingPage(page);
      const dashboard = new ParticipantDashboardPage(page);

      return { page, dashboard, context };
    };

    await use(creator);

    // Cleanup after test completes
    for (const ctx of participantContexts) {
      await ctx.close();
    }
  }
});

export { expect } from "@playwright/test";
