import { test, expect } from "../fixtures/testFixtures";
import { LandingPage } from "../pages/LandingPage";
import { HostDashboardPage } from "../pages/HostDashboardPage";
import { ParticipantDashboardPage } from "../pages/ParticipantDashboardPage";

test.describe("Room & Session Lifecycle Specs", () => {
  test("Complete Lifecycle - waiting room approval, kick, and close", async ({ landingPage, hostDashboard, createParticipant, page }) => {
    // 1. Host creates room with waiting room enabled
    await landingPage.navigate();
    await landingPage.createRoom("Professor Xavier", "VK2212", true);
    await expect(page).toHaveURL(/\/host\//, { timeout: 15000 });
    
    const hostPageObj = new HostDashboardPage(page);
    const roomCode = await hostPageObj.getRoomCode();
    expect(roomCode).not.toBe("");

    // 2. Participant joins the room
    const { page: partPage, dashboard: partDashboard } = await createParticipant("Wolverine");
    const partLanding = new LandingPage(partPage);
    await partLanding.navigate();
    await partLanding.joinRoom("Wolverine", roomCode);

    // 3. Participant should be in waiting room
    await partDashboard.verifyWaitingRoom();

    // 4. Host approves participant
    await hostPageObj.approveParticipant("Wolverine");

    // 5. Participant should enter live session
    await partDashboard.waitForApproved();

    // 6. Host kicks participant
    await hostPageObj.removeParticipant("Wolverine");

    // 7. Participant should be redirected back to landing page
    await expect(partPage).toHaveURL(/\/join\/|\//, { timeout: 10000 });

    // 8. Host ends the session
    await hostPageObj.endSession();
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("Session transition resets local store", async ({ landingPage, hostDashboard, createParticipant, page }) => {
    // Host creates Room A
    await landingPage.navigate();
    await landingPage.createRoom("Professor Xavier", "VK2212", false);
    await expect(page).toHaveURL(/\/host\//, { timeout: 15000 });
    
    const hostPageObj = new HostDashboardPage(page);
    const roomCodeA = await hostPageObj.getRoomCode();

    // Participant joins Room A
    const { page: partPage } = await createParticipant("Storm");
    const partLanding = new LandingPage(partPage);
    await partLanding.navigate();
    await partLanding.joinRoom("Storm", roomCodeA);

    // Host should see participant "Storm"
    const stormUser = page.locator(".flex-1.overflow-y-auto .relative.group").filter({ hasText: "Storm" });
    await expect(stormUser).toBeVisible();

    // Host ends Room A session
    await hostPageObj.endSession();
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Host creates Room B
    await landingPage.navigate();
    await landingPage.createRoom("Professor Xavier", "VK2212", false);
    await expect(page).toHaveURL(/\/host\//, { timeout: 15000 });

    // Host should NOT see participant "Storm" from the previous session! (Store reset verification)
    const oldStormUser = page.locator(".flex-1.overflow-y-auto .relative.group").filter({ hasText: "Storm" });
    await expect(oldStormUser).not.toBeVisible();
  });
});
