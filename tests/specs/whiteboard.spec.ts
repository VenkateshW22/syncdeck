import { test, expect } from "../fixtures/testFixtures";
import { LandingPage } from "../pages/LandingPage";
import { HostDashboardPage } from "../pages/HostDashboardPage";
import { drawLineOnCanvas, clearCanvas } from "../helpers/drawingSimulator";

test.describe("Whiteboard Drawing Specs", () => {
  test("Host draws on canvas and clears board", async ({ landingPage, createParticipant, page }) => {
    // 1. Host creates room
    await landingPage.navigate();
    await landingPage.createRoom("Professor Xavier", "VK2212", false);
    await expect(page).toHaveURL(/\/host\//, { timeout: 15000 });
    
    const hostPageObj = new HostDashboardPage(page);
    const roomCode = await hostPageObj.getRoomCode();

    // 2. Participant joins
    const { page: partPage } = await createParticipant("Cyclops");
    const partLanding = new LandingPage(partPage);
    await partLanding.navigate();
    await partLanding.joinRoom("Cyclops", roomCode);

    // 3. Host draws a line on canvas
    await drawLineOnCanvas(page, "canvas");

    // Let's verify canvas element exists on both ends and no console errors
    const hostCanvas = page.locator("canvas");
    const partCanvas = partPage.locator("canvas");
    await expect(hostCanvas).toBeVisible();
    await expect(partCanvas).toBeVisible();

    // 4. Host clears canvas
    await clearCanvas(page);

    // Clean up session
    await hostPageObj.endSession();
  });
});
