import { beforeEach, expect, it } from "vitest";
import {
  ACCORDION_DEFAULTS,
  MAJOR_GROUPS,
  parseAccordions,
  useAccordionStore,
} from "../../src/workspace/accordionStore";
beforeEach(() =>
  useAccordionStore.setState({ open: { ...ACCORDION_DEFAULTS }, pinned: {} }),
);
it("uses a clean default and ignores corrupt or unknown preferences", () => {
  expect(MAJOR_GROUPS.filter((key) => ACCORDION_DEFAULTS[key])).toEqual([
    "tools.shapes",
  ]);
  expect(parseAccordions("broken")).toEqual(ACCORDION_DEFAULTS);
  expect(
    parseAccordions('{"tools.voice":true,"unknown":true}'),
  ).not.toHaveProperty("unknown");
});
it("opening a major group collapses other unpinned majors but keeps child preferences", () => {
  const store = useAccordionStore.getState();
  store.setOpen("tools.gesture-settings", true);
  store.setOpen("tools.transform", true);
  expect(useAccordionStore.getState().open["tools.shapes"]).toBe(false);
  store.setOpen("tools.voice", true);
  expect(useAccordionStore.getState().open["tools.transform"]).toBe(false);
  expect(useAccordionStore.getState().open["tools.gesture-settings"]).toBe(
    true,
  );
});
it("pins retain open groups without preventing explicit collapse or future unpinning", () => {
  const store = useAccordionStore.getState();
  store.togglePin("tools.shapes");
  store.setOpen("tools.voice", true);
  expect(useAccordionStore.getState().open["tools.shapes"]).toBe(true);
  store.setOpen("tools.shapes", false);
  expect(useAccordionStore.getState().open["tools.shapes"]).toBe(false);
  store.setOpen("tools.shapes", true);
  store.togglePin("tools.shapes");
  store.setOpen("tools.scene", true);
  expect(useAccordionStore.getState().open["tools.shapes"]).toBe(false);
});
