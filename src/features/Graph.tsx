import type { RecordView } from "../presentation/records";
import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { Maximize, Plus, Minus } from "lucide-react";
import { RelationshipDialog } from "../components/RelationshipDialog";
import {
  graphKinds,
  colors,
  syncGraphElements,
  filterGraph,
  runGraphLayout,
} from "./graph/runtime";
import { definitions, type Relationship } from "../models/schema";
export function Graph({
  records,
  relationships,
  caseId,
  onSelect,
  onError,
  compact = false,
}: {
  records: RecordView[];
  relationships: Relationship[];
  caseId: string;
  onSelect: (r: RecordView) => void;
  onError: (s: string) => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [layout, setLayout] = useState(compact ? "circle" : "cose");
  const [filter, setFilter] = useState("all");
  const [labels, setLabels] = useState(false);
  const [nodeLabels, setNodeLabels] = useState("code");
  const [editing, setEditing] = useState<{ existing?: Relationship }>();
  const [query, setQuery] = useState("");
  const [relationFilter, setRelationFilter] = useState("all");
  const [hover, setHover] = useState("");
  const [focus, setFocus] = useState(false);
  const latest = useRef({ records, relationships, onSelect });
  useEffect(() => {
    latest.current = { records, relationships, onSelect };
  }, [records, relationships, onSelect]);
  const layoutState = useRef<{ caseId: string; layout: string; initialized: boolean }>({
    caseId: "",
    layout: "",
    initialized: false,
  });
  useEffect(() => {
    if (!ref.current) return;
    const cy = cytoscape({
      container: ref.current,
      elements: [],
      style: [
        { selector: 'node[kind="locations"]', style: { shape: "hexagon" } },
        { selector: 'node[kind="sources"]', style: { shape: "rectangle" } },
        { selector: ".dimmed", style: { opacity: 0.15 } },
        {
          selector: "node",
          style: {
            label: "data(code)",
            "background-color": "data(color)",
            color: "#c5ceda",
            "font-size": 14,
            "text-valign": "bottom",
            "text-margin-y": 12,
            width: 38,
            height: 38,
            "text-wrap": "wrap",
            "text-max-width": "150px",
            "border-width": 5,
            "border-color": "#242c36",
          },
        },
        {
          selector: 'node[kind="evidence"]',
          style: { shape: "round-rectangle" },
        },
        { selector: 'node[kind="hypotheses"]', style: { shape: "diamond" } },
        {
          selector: "edge",
          style: {
            width: 1.2,
            "line-color": "#3e4a5b",
            "target-arrow-color": "#3e4a5b",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "",
            "font-size": 12,
            color: "#a4afbf",
            "text-background-color": "#11151b",
            "text-background-opacity": 1,
          },
        },
        { selector: "node.neighbor", style: { "border-color": "#b8a17f" } },
        { selector: "edge.neighbor", style: { "line-color": "#b8a17f", width: 2 } },
        {
          selector: ":selected",
          style: { "border-color": "#d6ac68", "line-color": "#d6ac68" },
        },
      ],
      layout: { name: "preset" },
      minZoom: 0.15,
      maxZoom: 3,
    });
    cyRef.current = cy;
    cy.on("tap", "node", (e) => {
      const r = latest.current.records.find((r) => r.id === e.target.id());
      if (r) latest.current.onSelect(r);
      cy.elements().removeClass("dimmed neighbor");
      const neighbors = e.target.closedNeighborhood();
      cy.elements().not(neighbors).addClass("dimmed");
      neighbors.addClass("neighbor");
    });
    cy.on("tap", "edge", (e) =>
      setEditing({
        existing: latest.current.relationships.find((r) => r.id === e.target.id()),
      }),
    );
    cy.on("tap", (e) => {
      if (e.target === cy) {
        cy.elements().unselect().removeClass("dimmed neighbor");
        setFocus(false);
      }
    });
    cy.on("dbltap", "node", () => setFocus(true));
    cy.on("mouseover", "node", (e) => {
      const r = latest.current.records.find((r) => r.id === e.target.id());
      setHover(r ? `${r.code} · ${r.title}` : "");
    });
    cy.on("mouseout", "node", () => setHover(""));
    let size = { width: ref.current.clientWidth, height: ref.current.clientHeight };
    const observer = new ResizeObserver(() => {
      if (!ref.current) return;
      const next = { width: ref.current.clientWidth, height: ref.current.clientHeight };
      const pan = cy.pan();
      cy.resize();
      cy.pan({
        x: pan.x + (next.width - size.width) / 2,
        y: pan.y + (next.height - size.height) / 2,
      });
      size = next;
    });
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cy.destroy();
      cyRef.current = null;
      layoutState.current = { caseId: "", layout: "", initialized: false };
    };
  }, []);
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    syncGraphElements(
      cy,
      records.map((r) => r.record),
      relationships,
    );
    filterGraph(cy, filter, relationFilter, query, focus);
    const state = layoutState.current;
    if (state.caseId !== caseId) {
      state.caseId = caseId;
      state.initialized = false;
    }
    if (cy.nodes().length && (!state.initialized || state.layout !== layout)) {
      runGraphLayout(cy, layout, !state.initialized);
      state.initialized = true;
      state.layout = layout;
    }
  }, [records, relationships, filter, relationFilter, query, focus, layout, caseId]);
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.style()
      .selector("node")
      .style({
        width: compact ? 28 : 38,
        height: compact ? 28 : 38,
        "font-size": compact ? 12 : 14,
        "text-max-width": compact ? "100px" : "150px",
        label: compact || nodeLabels === "none" ? "" : `data(${nodeLabels})`,
      })
      .selector("edge")
      .style({ label: labels ? "data(label)" : "" })
      .update();
  }, [labels, compact, nodeLabels]);
  return (
    <div className={compact ? "graph-panel compact" : "graph-panel"}>
      {!compact && (
        <div className="toolbar graph-toolbar">
          <div className="tool-group">
            <span className="tool-group-label">DISCOVER</span>
            <input
              className="graph-search"
              aria-label="Search graph nodes"
              placeholder="Find a node…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Graph node types"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All node types</option>
              {graphKinds.map((k) => (
                <option key={k} value={k}>
                  {definitions[k].label}
                </option>
              ))}
            </select>
            <select
              aria-label="Graph relationship filter"
              value={relationFilter}
              onChange={(e) => setRelationFilter(e.target.value)}
            >
              <option value="all">All relationships</option>
              {[...new Set(relationships.map((r) => r.type))].sort().map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="tool-group">
            <span className="tool-group-label">VIEW</span>
            <select
              aria-label="Graph layout"
              value={layout}
              onChange={(e) => setLayout(e.target.value)}
            >
              <option value="cose">Force directed</option>
              <option value="circle">Circle</option>
              <option value="grid">Grid</option>
              <option value="breadthfirst">Hierarchy</option>
              <option value="concentric">Concentric</option>
            </select>
            <select
              aria-label="Node labels"
              value={nodeLabels}
              onChange={(e) => setNodeLabels(e.target.value)}
            >
              <option value="code">Record IDs</option>
              <option value="label">Record titles</option>
              <option value="none">No node labels</option>
            </select>
            <label className="check">
              <input
                type="checkbox"
                checked={labels}
                onChange={(e) => setLabels(e.target.checked)}
              />{" "}
              Edge labels
            </label>
          </div>
          <div className="tool-group">
            <span className="tool-group-label">ANALYZE</span>
            <button
              aria-pressed={focus}
              onClick={() => setFocus(!focus)}
              title="Show the selected node and its neighbors"
            >
              {focus ? "Show all" : "Focus"}
            </button>
            <button
              onClick={() => cyRef.current?.fit(cyRef.current.elements(":visible"), 40)}
            >
              Fit
            </button>
          </div>
          <div className="tool-group tool-group-edit">
            <span className="tool-group-label">EDIT</span>
            <button className="primary" onClick={() => setEditing({})}>
              <Plus size={14} /> Relationship
            </button>
          </div>
        </div>
      )}
      <div
        ref={ref}
        className="graph-canvas"
        role="img"
        aria-label={
          compact
            ? "Investigation graph preview. Open Graph for keyboard node inspection."
            : "Investigation relationship graph. Use the node selector below for keyboard access."
        }
      />
      {hover && <div className="graph-hover">{hover}</div>}
      {!records.some((r) => graphKinds.includes(r.kind)) && (
        <div className="graph-empty">
          <h3>No connections to explore yet</h3>
          <p>Capture evidence or entities, then link records to build this graph.</p>
        </div>
      )}
      {!compact && (
        <div className="graph-accessible">
          <label className="sr-only" htmlFor="graph-node-select">
            Inspect a graph node
          </label>
          <select
            id="graph-node-select"
            value=""
            onChange={(e) => {
              const r = records.find((r) => r.id === e.target.value);
              if (r) {
                cyRef.current?.elements().unselect();
                cyRef.current?.getElementById(r.id).select().emit("tap");
              }
            }}
          >
            <option value="">Inspect a node…</option>
            {records
              .filter((r) => graphKinds.includes(r.kind))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.title}
                </option>
              ))}
          </select>
        </div>
      )}
      <div className="graph-controls">
        <button
          aria-label="Zoom in"
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
        >
          <Plus size={16} />
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() / 1.2)}
        >
          <Minus size={16} />
        </button>
        <button aria-label="Fit graph" onClick={() => cyRef.current?.fit(undefined, 40)}>
          <Maximize size={16} />
        </button>
      </div>
      {!compact && (
        <div className="edge-accessible">
          <select
            aria-label="Inspect a relationship"
            value=""
            onChange={(e) => {
              const existing = relationships.find((r) => r.id === e.target.value);
              if (existing) setEditing({ existing });
            }}
          >
            <option value="">Inspect a relationship…</option>
            {relationships.map((rel) => (
              <option key={rel.id} value={rel.id}>
                {records.find((r) => r.id === rel.from)?.code} →{" "}
                {records.find((r) => r.id === rel.to)?.code} · {rel.type}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="graph-legend">
        {graphKinds.map((k) => (
          <span key={k}>
            <i style={{ background: colors[k] }} />
            {definitions[k].label}
          </span>
        ))}
      </div>
      {editing && (
        <RelationshipDialog
          records={records}
          caseId={caseId}
          existing={editing.existing}
          onClose={() => setEditing(undefined)}
          onError={onError}
        />
      )}
    </div>
  );
}
