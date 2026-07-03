import { Page, expect } from "@playwright/test";

export class HostDashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async getRoomCode(): Promise<string> {
    const heading = this.page.locator("h2:has-text('SyncDeck Room:')");
    await expect(heading).toBeVisible();
    const text = await heading.innerText();
    return text.replace("SyncDeck Room:", "").trim();
  }

  async approveParticipant(displayName: string) {
    const item = this.page.locator(".flex-1.overflow-y-auto .relative.group").filter({ hasText: displayName });
    await expect(item).toBeVisible();
    await item.locator('button:has-text("Approve")').click();
  }

  async rejectParticipant(displayName: string) {
    const item = this.page.locator(".flex-1.overflow-y-auto .relative.group").filter({ hasText: displayName });
    await expect(item).toBeVisible();
    await item.locator('button:has-text("Reject")').click();
  }

  async promoteToCohost(displayName: string) {
    const item = this.page.locator(".flex-1.overflow-y-auto .relative.group").filter({ hasText: displayName });
    await expect(item).toBeVisible();
    // Hover to reveal promote buttons
    await item.hover();
    await item.locator('button:has-text("Promote")').click();
  }

  async removeParticipant(displayName: string) {
    const item = this.page.locator(".flex-1.overflow-y-auto .relative.group").filter({ hasText: displayName });
    await expect(item).toBeVisible();
    // Hover to reveal buttons
    await item.hover();
    await item.locator('button:has-text("Remove")').click();
  }

  async broadcastPoll(question: string, options: string[]) {
    await this.page.fill('input[placeholder="What concept is being queried?"]', question);
    for (let i = 0; i < options.length; i++) {
      await this.page.fill(`input[placeholder="Answer choice option ${i + 1}"]`, options[i]);
    }
    await this.page.click('button:has-text("Broadcast Poll")');
  }

  async stopPoll() {
    await this.page.click('button:has-text("Stop Poll")');
  }

  async sendChatMessage(message: string) {
    await this.page.fill('input[placeholder="Send a chat message..."]', message);
    await this.page.click('button:has-text("Send")');
  }

  async endSession() {
    this.page.on("dialog", async (dialog) => {
      await dialog.accept();
    });
    await this.page.click('button:has-text("End")');
  }
}
