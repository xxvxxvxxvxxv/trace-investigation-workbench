import type cytoscape from "cytoscape";
import type { RecordItem, Relationship, Kind } from "../../models/schema";
export const graphKinds: Kind[] = [
  "entities",
  "evidence",
  "locations",
  "sources",
  "timeline",
  "hypotheses",
];
export const colors: Partial<Record<Kind, string>> = {
  entities: "#96adcb",
  evidence: "#cea967",
  locations: "#8aa796",
  sources: "#a69cc8",
  timeline: "#81929f",
  hypotheses: "#c78e88",
};
export function syncGraphElements(
  cy: cytoscape.Core,
  records: RecordItem[],
  relationships: Relationship[],
) {
  const nodes = records.filter((r) => graphKinds.includes(r.kind));
  const nodeIds = new Set(nodes.map((r) => r.id));
  const edges = relationships.filter((r) => nodeIds.has(r.from) && nodeIds.has(r.to));
  const allIds = new Set([...nodeIds, ...edges.map((r) => r.id)]);
  cy.batch(() => {
    cy.elements()
      .filter((e) => !allIds.has(e.id()))
      .remove();
    nodes.forEach((r, index) => {
      const data = {
        id: r.id,
        label: r.title,
        code: r.code,
        kind: r.kind,
        color: colors[r.kind],
      };
      const node = cy.getElementById(r.id);
      if (node.empty()) {
        const extent = cy.extent();
        cy.add({
          group: "nodes",
          data,
          position: {
            x: (extent.x1 + extent.x2) / 2 + (index % 5) * 30,
            y: (extent.y1 + extent.y2) / 2 + Math.floor(index / 5) * 30,
          },
        });
      } else node.data(data);
    });
    for (const r of edges) {
      const data = { id: r.id, source: r.from, target: r.to, label: r.type };
      const edge = cy.getElementById(r.id);
      if (edge.empty()) cy.add({ group: "edges", data });
      else {
        if (edge.source().id() !== r.from || edge.target().id() !== r.to)
          edge.move({ source: r.from, target: r.to });
        edge.data(data);
      }
    }
  });
}
export function filterGraph(
  cy: cytoscape.Core,
  type: string,
  relation = "all",
  query = "",
  focus = false,
) {
  const neighborhood = cy.nodes(":selected").closedNeighborhood();
  cy.batch(() => {
    cy.nodes().forEach((node) => {
      node.style(
        "display",
        (type === "all" || node.data("kind") === type) &&
          (!query ||
            `${node.data("label")} ${node.data("code")}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (!focus || !neighborhood.length || neighborhood.contains(node))
          ? "element"
          : "none",
      );
    });
    cy.edges().forEach((edge) => {
      edge.style(
        "display",
        (relation === "all" || edge.data("label") === relation) &&
          edge.source().style("display") !== "none" &&
          edge.target().style("display") !== "none"
          ? "element"
          : "none",
      );
    });
  });
}
export function runGraphLayout(cy: cytoscape.Core, name: string, fit = false) {
  cy.elements(":visible")
    .layout({
      name,
      animate: false,
      fit,
      padding: 50,
      nodeRepulsion: 120000,
      idealEdgeLength: 150,
      nodeOverlap: 30,
      gravity: 0.15,
      componentSpacing: 100,
      spacingFactor: 1.4,
    } as cytoscape.LayoutOptions)
    .run();
}
