export type InspectorHistory = { ids: string[]; index: number };
export type InspectorAction =
  { type: "open"; id: string } | { type: "back" | "forward" | "close" };
export const emptyHistory: InspectorHistory = { ids: [], index: -1 };
export function inspectorReducer(
  state: InspectorHistory,
  action: InspectorAction,
): InspectorHistory {
  if (action.type === "close") return emptyHistory;
  if (action.type === "back") return { ...state, index: Math.max(0, state.index - 1) };
  if (action.type === "forward")
    return { ...state, index: Math.min(state.ids.length - 1, state.index + 1) };
  if (action.type !== "open") return state;
  if (state.ids[state.index] === action.id) return state;
  const ids = [...state.ids.slice(0, state.index + 1), action.id].slice(-50);
  return { ids, index: ids.length - 1 };
}
export const isWorkspaceSection = (section: string) =>
  ["cases", "tools", "settings", "about"].includes(section);
