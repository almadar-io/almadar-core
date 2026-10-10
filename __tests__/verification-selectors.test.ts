import { describe, expect, it } from "vitest";
import {
  ACTION_OVERFLOW_TESTID,
  ACTION_TESTID_PREFIX,
  FORM_PATTERN,
  NATIVE_ID_PREFIX,
  VERIFICATION_DOM_ATTRS,
  actionTestId,
  actionTestIdMatches,
  nativeFieldId,
  nativePatternId,
  nativeRowId,
  nativeSlotId,
} from "../src/types/index.js";

describe("actionTestId", () => {
  it("prefixes a bare event", () => {
    expect(actionTestId("SAVE")).toBe("action-SAVE");
  });

  it("prefixes a qualified bus key verbatim", () => {
    expect(actionTestId("Notes.NoteBrowse.SAVE")).toBe("action-Notes.NoteBrowse.SAVE");
  });

  it("keeps the overflow id in the same vocabulary", () => {
    expect(ACTION_OVERFLOW_TESTID.startsWith(ACTION_TESTID_PREFIX)).toBe(true);
  });
});

describe("actionTestIdMatches", () => {
  it("matches the exact bare form", () => {
    expect(actionTestIdMatches("action-SAVE", "SAVE")).toBe(true);
  });

  it("matches a qualified form ending in .EVENT", () => {
    expect(actionTestIdMatches("action-Notes.NoteBrowse.SAVE", "SAVE")).toBe(true);
  });

  it("matches a qualified event against its exact qualified id", () => {
    expect(actionTestIdMatches("action-Notes.NoteBrowse.SAVE", "Notes.NoteBrowse.SAVE")).toBe(true);
  });

  it("rejects an event that only shares a prefix", () => {
    expect(actionTestIdMatches("action-SAVE_DRAFT", "SAVE")).toBe(false);
  });

  it("rejects a qualified event that only shares a prefix", () => {
    expect(actionTestIdMatches("action-Notes.Browse.SAVE_DRAFT", "SAVE")).toBe(false);
  });

  it("rejects a suffix match without the dot boundary", () => {
    expect(actionTestIdMatches("action-AUTOSAVE", "SAVE")).toBe(false);
  });

  it("rejects ids outside the action vocabulary", () => {
    expect(actionTestIdMatches("pattern-SAVE", "SAVE")).toBe(false);
    expect(actionTestIdMatches("x.SAVE", "SAVE")).toBe(false);
  });
});

describe("native ids", () => {
  it("prefix pattern, row and field names", () => {
    expect(nativePatternId("data-list")).toBe(`${NATIVE_ID_PREFIX.pattern}data-list`);
    expect(nativeRowId("42")).toBe("row-42");
    expect(nativeFieldId("title")).toBe("field-title");
    expect(nativeSlotId("modal")).toBe("slot-modal");
  });

  it("use prefixes disjoint from the action vocabulary", () => {
    for (const prefix of Object.values(NATIVE_ID_PREFIX)) {
      expect(prefix.startsWith(ACTION_TESTID_PREFIX)).toBe(false);
      expect(actionTestIdMatches(`${prefix}SAVE`, "SAVE")).toBe(false);
    }
  });
});

describe("web DOM attributes", () => {
  it("are data-* attributes", () => {
    for (const attr of Object.values(VERIFICATION_DOM_ATTRS)) {
      expect(attr.startsWith("data-")).toBe(true);
    }
  });

  it("name the form container by its pattern", () => {
    expect(FORM_PATTERN).toBe("form-section");
  });
});
