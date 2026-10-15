import { test as base, expect } from "@playwright/test";
import { ACCORDION_DEFAULTS } from "../../src/workspace/accordionStore";
// Existing feature tests use an explicitly remembered expanded workspace.
// Dedicated accordion tests use the raw Playwright fixture and exercise defaults.
export const test = base.extend({
  page: async ({ page }, runFixture) => {
    await page.addInitScript((keys) => {
      if (!localStorage.getItem("holobuild.accordions.v1"))
        localStorage.setItem(
          "holobuild.accordions.v1",
          JSON.stringify(Object.fromEntries(keys.map((k) => [k, true]))),
        );
    }, Object.keys(ACCORDION_DEFAULTS));
    await runFixture(page);
  },
});
export { expect };
