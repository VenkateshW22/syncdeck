import { Page, expect } from "@playwright/test";

export class LandingPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate() {
    await this.page.goto("/");
  }

  async selectHostTab() {
    await this.page.click("text=Host Session", { force: true });
  }

  async selectJoinTab() {
    await this.page.click("text=Join Session", { force: true });
  }

  async createRoom(hostName: string, adminKey = "VK2212", requireApproval = false) {
    await this.selectHostTab();
    await this.page.fill('input[placeholder="e.g. Dr. Adam"]', hostName);
    await this.page.fill('input[placeholder="Enter admin key"]', adminKey);
    
    const isChecked = await this.page.isChecked('input[type="checkbox"]');
    if (isChecked !== requireApproval) {
      await this.page.click('input[type="checkbox"]', { force: true });
    }

    await this.page.click('button[type="submit"]:has-text("Deploy SyncDeck")', { force: true });
  }

  async joinRoom(displayName: string, roomCode: string) {
    await this.selectJoinTab();
    await this.page.fill('input[placeholder="e.g. John Doe, Sarah"]', displayName);
    await this.page.fill('input[placeholder="Enter room code"]', roomCode);
    await this.page.click('button[type="submit"]:has-text("Join Live Session")', { force: true });
  }
}
