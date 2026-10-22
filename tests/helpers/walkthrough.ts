export async function activate(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.getByRole("button", { name, exact: true }).focus();
  await page.keyboard.press("Enter");
}
