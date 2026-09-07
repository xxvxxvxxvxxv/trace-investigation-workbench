import { describe, it, expect } from "vitest";
import cytoscape from "cytoscape";
import { syncGraphElements } from "./runtime";
import type { RecordItem, Relationship } from "../../models/schema";
import { nowUTC } from "../../models/time";
describe("incremental graph reconciliation", () => {
  it("retains core, node identity, positions, pan, zoom and selection during record changes", () => {
    const cy = cytoscape({ headless: true });
    try {
      const time = nowUTC();
      const a: RecordItem = {
        id: crypto.randomUUID(),
        kind: "entities",
        caseId: crypto.randomUUID(),
        code: "ENT001",
        title: "A",
        createdAt: time,
        updatedAt: time,
        values: {},
      };
      const b = { ...a, id: crypto.randomUUID(), code: "ENT002", title: "B" };
      const edge: Relationship = {
        id: crypto.randomUUID(),
        caseId: a.caseId,
        from: a.id,
        to: b.id,
        type: "USES",
        createdAt: time,
        updatedAt: time,
      };
      syncGraphElements(cy, [a, b], [edge]);
      const node = cy.getElementById(a.id);
      node.position({ x: 123, y: 456 });
      node.select();
      cy.zoom(1.7);
      cy.pan({ x: 22, y: 33 });
      syncGraphElements(cy, [{ ...a, title: "Renamed" }, b], [edge]);
      expect(cy.getElementById(a.id)[0]).toBe(node[0]);
      expect(node.position()).toEqual({ x: 123, y: 456 });
      expect(node.selected()).toBe(true);
      expect(cy.zoom()).toBe(1.7);
      expect(cy.pan()).toEqual({ x: 22, y: 33 });
      expect(node.data("label")).toBe("Renamed");
      syncGraphElements(cy, [a], []);
      expect(cy.nodes()).toHaveLength(1);
      expect(cy.edges()).toHaveLength(0);
    } finally {
      cy.destroy();
    }
  });
});

it("filters a neighborhood without removing nodes or changing positions", async () => {
  const { filterGraph } = await import("./runtime");
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    elements: [
      { data: { id: "a", kind: "entities", code: "ENT001", label: "Alpha" } },
      { data: { id: "b", kind: "evidence", code: "E001", label: "Bulletin" } },
      { data: { id: "c", kind: "sources", code: "S001", label: "Catalog" } },
      { data: { id: "ab", source: "a", target: "b", label: "MENTIONS" } },
    ],
  });
  try {
    const node = cy.getElementById("a");
    node.select();
    node.position({ x: 10, y: 20 });
    filterGraph(cy, "all", "all", "", true);
    expect(cy.getElementById("c").style("display")).toBe("none");
    expect(cy.getElementById("b").style("display")).toBe("element");
    filterGraph(cy, "all", "USES");
    expect(cy.getElementById("ab").style("display")).toBe("none");
    filterGraph(cy, "all", "all", "ENT001");
    expect(node.style("display")).toBe("element");
    expect(cy.getElementById("b").style("display")).toBe("none");
    filterGraph(cy, "all");
    expect(cy.nodes()).toHaveLength(3);
    expect(node.position()).toEqual({ x: 10, y: 20 });
  } finally {
    cy.destroy();
  }
});
