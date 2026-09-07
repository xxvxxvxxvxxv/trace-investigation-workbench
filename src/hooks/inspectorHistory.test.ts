import { describe, expect, it } from "vitest";
import { emptyHistory, inspectorReducer, isWorkspaceSection } from "./inspectorHistory";
describe("inspector navigation", () => {
  it("keeps linked navigation reversible and replaces forward history on a new branch", () => {
    let state = inspectorReducer(emptyHistory, { type: "open", id: "evidence" });
    state = inspectorReducer(state, { type: "open", id: "source" });
    state = inspectorReducer(state, { type: "back" });
    expect(state.ids[state.index]).toBe("evidence");
    state = inspectorReducer(state, { type: "open", id: "entity" });
    expect(state.ids).toEqual(["evidence", "entity"]);
    expect(inspectorReducer(state, { type: "forward" })).toEqual(state);
    expect(inspectorReducer(state, { type: "close" })).toEqual(emptyHistory);
  });
  it("does not duplicate the current record and caps session history", () => {
    let state = inspectorReducer(emptyHistory, { type: "open", id: "same" });
    expect(inspectorReducer(state, { type: "open", id: "same" })).toBe(state);
    for (let i = 0; i < 60; i++)
      state = inspectorReducer(state, { type: "open", id: String(i) });
    expect(state.ids).toHaveLength(50);
    expect(state.ids[state.index]).toBe("59");
  });
  it("separates global library pages from case workspaces", () => {
    for (const page of ["cases", "tools", "settings", "about"])
      expect(isWorkspaceSection(page)).toBe(true);
    for (const page of [
      "dashboard",
      "reports",
      "evidence",
      "sources",
      "graph",
      "map",
      "timeline",
    ])
      expect(isWorkspaceSection(page)).toBe(false);
  });
});
