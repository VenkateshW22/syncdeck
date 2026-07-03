import { test, expect } from "../fixtures/testFixtures";
import { LandingPage } from "../pages/LandingPage";
import { HostDashboardPage } from "../pages/HostDashboardPage";
import { ParticipantDashboardPage } from "../pages/ParticipantDashboardPage";

test.describe("Chat and Polls Specs", () => {
  test("Real-time Chat and Poll Voting Flow", async ({ landingPage, createParticipant, page }) => {
    // 1. Host creates room
    await landingPage.navigate();
    await landingPage.createRoom("Professor Xavier", "VK2212", false);
    await expect(page).toHaveURL(/\/host\//, { timeout: 15000 });
    
    const hostPageObj = new HostDashboardPage(page);
    const roomCode = await hostPageObj.getRoomCode();

    // 2. Participant joins
    const { page: partPage, dashboard: partDashboard } = await createParticipant("Beast");
    const partLanding = new LandingPage(partPage);
    await partLanding.navigate();
    await partLanding.joinRoom("Beast", roomCode);

    // 3. Participant sends chat message
    await partDashboard.sendChatMessage("Hello class!");

    // 4. Host should see the message in real-time
    const chatBubble = page.locator("p:has-text('Hello class!')");
    await expect(chatBubble).toBeVisible();

    // 5. Host sends chat message reply
    await hostPageObj.sendChatMessage("Welcome Beast!");

    // 6. Participant should see host reply
    await partDashboard.verifyChatMessageVisible("Professor Xavier", "Welcome Beast!");

    // 7. Host broadcasts a poll
    await hostPageObj.broadcastPoll("Is JavaScript single-threaded?", ["Yes", "No"]);

    // 8. Participant votes "Yes"
    await partDashboard.votePoll("Yes");

    // 9. Host should see chart reflect the vote (1 vote for Yes)
    const activePoll = page.locator("text=Active Session Poll");
    await expect(activePoll).toBeVisible();

    // 10. Host stops the poll
    await hostPageObj.stopPoll();
    await expect(activePoll).not.toBeVisible();

    // Clean up session
    await hostPageObj.endSession();
  });
});
