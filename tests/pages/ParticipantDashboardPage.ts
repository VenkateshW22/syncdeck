import { Page, expect } from "@playwright/test";

export class ParticipantDashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForApproved() {
    // Waiting room should not be visible
    const waitingRoom = this.page.locator("h2").filter({ hasText: "Waiting for Approval" });
    await expect(waitingRoom).not.toBeVisible({ timeout: 10000 });
  }

  async verifyWaitingRoom() {
    const waitingRoom = this.page.locator("h2").filter({ hasText: "Waiting for Approval" });
    await expect(waitingRoom).toBeVisible();
  }

  async raiseHand() {
    await this.page.click('button:has-text("Hand")');
  }

  async sendChatMessage(message: string) {
    await this.page.fill('input[placeholder="Send a chat message..."]', message);
    await this.page.click('button:has-text("Send")');
  }

  async votePoll(optionText: string) {
    await this.page.click(`button:has-text("${optionText}")`);
  }

  async verifyChatMessageVisible(senderName: string, text: string) {
    const bubble = this.page.locator("p").filter({ hasText: text });
    await expect(bubble).toBeVisible();
  }

  async logout() {
    await this.page.click('button:has-text("Leave")');
  }
}
