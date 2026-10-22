/** Keyboard activation keeps toolbar actions reachable while the browser owns the locked pointer. */
export async function activate(page, name) {
  await page.getByRole("button", { name, exact: true }).focus();
  await page.keyboard.press("Enter");
}
