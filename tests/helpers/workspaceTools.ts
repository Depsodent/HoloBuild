import { expect, type Page } from "@playwright/test";
export async function showTools(
  page: Page,
  tab: "build" | "edit" | "ai" | "scene",
) {
  const button = page.getByRole("tab", {
    name: tab === "ai" ? "AI" : tab[0].toUpperCase() + tab.slice(1),
    exact: true,
  });
  if ((await button.getAttribute("aria-selected")) !== "true")
    await button.click();
}
export async function showGestureSettings(page: Page) {
  await showTools(page, "edit");
  const details = page.locator("details.advanced-gesture-settings");
  if ((await details.getAttribute("open")) === null)
    await details.locator(":scope > summary").click();
}
export async function showAISettings(page: Page) {
  await showTools(page, "ai");
  const b = page.getByRole("button", { name: "AI Settings", exact: true });
  if ((await b.getAttribute("aria-pressed")) !== "true") await b.click();
}
export async function openWorkspaceSection(page: Page, key: string) {
  const tabs: Record<string, "build" | "edit" | "ai" | "scene"> = {
    "tools.shapes": "build",
    "tools.transform": "edit",
    "tools.voice": "ai",
    "tools.scene": "scene",
  };
  if (tabs[key]) {
    if (key === "tools.transform") await showGestureSettings(page);
    else await showTools(page, tabs[key]);
    return;
  }
  if (key === "tools.ai-settings" || key === "tools.generator-parameters")
    await showAISettings(page);
  if (key === "tools.ai-examples" || key === "tools.voice-help") {
    await showTools(page, "ai");
    const b = page.getByRole("button", { name: "AI Help", exact: true });
    if ((await b.getAttribute("aria-pressed")) !== "true") await b.click();
  }
  const details = page.locator(`[data-accordion-key="${key}"]`);
  await expect(details).toBeAttached();
  if ((await details.getAttribute("open")) === null)
    await details.locator(":scope > summary").click();
}
