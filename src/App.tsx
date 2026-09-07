import { recordView } from "./presentation/records";
import type { DraftValues } from "./presentation/records";
import type { RecordView } from "./presentation/records";
import { useCallback, useMemo, useState, useEffect, useRef, useReducer } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Users,
  Clock,
  Network,
  Map,
  Compass,
  Lightbulb,
  HelpCircle,
  Link,
  BookOpen,
  ClipboardList,
  Settings as SettingsIcon,
  ShieldCheck,
  Search,
  Plus,
  ChevronRight,
  HardDrive,
  Menu,
  StickyNote,
  X,
} from "lucide-react";
import { db } from "./db/database";
import { definitions, kinds, type Kind } from "./models/schema";
import { RecordEditor } from "./components/RecordEditor";
import { RecordInspector } from "./components/RecordInspector";
import { TraceBrand } from "./components/TraceBrand";
import {
  inspectorReducer,
  emptyHistory,
  isWorkspaceSection,
} from "./hooks/inspectorHistory";
import { Badge } from "./pages/RecordList";
import { RecordList } from "./pages/RecordList";
import { Dashboard } from "./pages/Dashboard";
import { Graph } from "./features/Graph";
import { MapView } from "./features/MapView";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";
import { About } from "./pages/About";
const nav = [
  ["dashboard", "Overview", LayoutDashboard],
  ["cases", "Cases", FolderOpen],
  ["evidence", "Evidence", FileText],
  ["entities", "Entities", Users],
  ["timeline", "Timeline", Clock],
  ["graph", "Graph", Network],
  ["map", "Map", Map],
  ["leads", "Leads", Compass],
  ["hypotheses", "Hypotheses", Lightbulb],
  ["gaps", "Information Gaps", HelpCircle],
  ["sources", "Sources", Link],
  ["notes", "Notes", StickyNote],
  ["tools", "OSINT Tools", BookOpen],
  ["reports", "Reports", ClipboardList],
  ["settings", "Settings", SettingsIcon],
  ["about", "About / Ethics", ShieldCheck],
] as const;
export function App() {
  const navigate = useNavigate();
  const section = useLocation().pathname.slice(1) || "dashboard";
  const data = useLiveQuery(async () => ({
    records: await db.records.toArray(),
    relationships: await db.relationships.toArray(),
    activity: await db.activity.orderBy("timestamp").reverse().toArray(),
    active: (await db.meta.get("activeCase"))?.value,
  }));
  const [editor, setEditor] = useState<{
    kind: Kind;
    existing?: RecordView;
    initial?: DraftValues;
  }>();
  const [history, dispatch] = useReducer(inspectorReducer, emptyHistory);
  const selectedId = history.ids[history.index];
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("trace.sidebarCollapsed") === "true",
  );
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    localStorage.setItem("trace.sidebarCollapsed", String(collapsed));
  }, [collapsed]);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; error: boolean }>();
  const [mobile, setMobile] = useState(false);
  const [quick, setQuick] = useState(false);
  const onError = useCallback(
    (message: string) => setToast({ message, error: true }),
    [setToast],
  );
  const onSelect = useCallback(
    (r: RecordView) => dispatch({ type: "open", id: r.id }),
    [dispatch],
  );
  const addLocation = useCallback(
    (initial: DraftValues) => setEditor({ kind: "locations", initial }),
    [setEditor],
  );
  const all = useMemo(
    () =>
      data
        ? data.records.map((record) =>
            recordView(record, data.records, data.relationships),
          )
        : [],
    [data],
  );
  if (!data)
    return (
      <div className="boot">
        <TraceBrand />
        Opening local workspace…
      </div>
    );
  const cases = all.filter((r) => r.kind === "cases");
  const activeCase =
    cases.find((r) => r.id === data.active) ??
    cases.find((r) => r.values.status !== "archived") ??
    cases[0];
  const caseId = activeCase?.id ?? "";
  const records = all.filter((r) => r.caseId === caseId && r.kind !== "cases");
  const relationships = data.relationships.filter((r) => r.caseId === caseId);
  const selected = all.find((r) => r.id === selectedId);
  const currentNav = nav.find((n) => n[0] === section);
  const title = currentNav?.[1] ?? "Not found";
  const global = isWorkspaceSection(section);
  const kind = kinds.includes(section as Kind) ? (section as Kind) : undefined;
  const results = search.trim()
    ? all
        .filter((r) =>
          `${r.title} ${r.code} ${Object.values(r.values).join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .slice(0, 20)
    : [];
  const add = (k: Kind) => {
    setQuick(false);
    if (k !== "cases" && k !== "tools" && !caseId) {
      onError("Create a case first.");
      setEditor({ kind: "cases" });
    } else setEditor({ kind: k });
  };
  return (
    <div
      className={`app ${collapsed ? "nav-collapsed" : ""} ${selected ? "has-inspector" : ""}`}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to workspace
      </a>
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <TraceBrand compact={collapsed} />
          <span className="version">BETA</span>
        </div>
        <button
          className="collapse-toggle"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
        >
          <Menu size={17} />
          <span>Collapse navigation</span>
        </button>
        <nav aria-label="Main navigation">
          {[
            ["CASE", ["dashboard", "cases"]],
            ["COLLECTION", ["evidence", "sources", "notes"]],
            ["ANALYSIS", ["entities", "graph", "timeline", "map", "hypotheses", "gaps"]],
            ["OPERATIONS", ["leads", "tools", "reports"]],
            ["SYSTEM", ["settings", "about"]],
          ].map(([group, paths]) => (
            <div className="nav-group" key={String(group)}>
              <span className="nav-group-label">{group}</span>
              {nav
                .filter(([path]) => paths.includes(path))
                .sort((a, b) => paths.indexOf(a[0]) - paths.indexOf(b[0]))
                .map(([path, label, Icon]) => (
                  <NavLink
                    key={path}
                    to={`/${path}`}
                    title={label}
                    aria-label={label}
                    className={({ isActive }) =>
                      isActive || (section === "dashboard" && path === "dashboard")
                        ? "active"
                        : ""
                    }
                    onClick={() => setMobile(false)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                    {["evidence", "entities", "leads", "gaps"].includes(path) && (
                      <small>{records.filter((r) => r.kind === path).length}</small>
                    )}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <HardDrive size={17} />
          <div>
            Local workspace<small>Stored on this device</small>
          </div>
          <ShieldCheck size={15} />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={20} />
          </button>
          <TraceBrand compact />
          <div className="case-selector">
            <span className="eyebrow">
              {global ? "WORKSPACE / CASE SWITCHER" : "ACTIVE INVESTIGATION"}
            </span>
            <select
              aria-label="Active case"
              value={caseId}
              onChange={(e) => {
                void db.meta.put({ id: "activeCase", value: e.target.value });
                dispatch({ type: "close" });
              }}
            >
              {!cases.length && <option value="">No case selected</option>}
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.values.caseNumber || c.code} / {c.title}
                  {c.values.status === "archived" ? " [archived]" : ""}
                </option>
              ))}
            </select>
          </div>
          {!global && activeCase && (
            <div className="context-badges" aria-label="Active investigation status">
              <Badge value={activeCase.values.status} />
              <Badge value={activeCase.values.priority} />
              <span className="context-secondary muted">
                {activeCase.values.type} · {activeCase.values.jurisdiction}
              </span>
            </div>
          )}
          <div className="global-search">
            <Search size={16} />
            <input
              ref={searchRef}
              aria-label="Global search"
              placeholder="Search workspace… (⌘ / Ctrl K)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearch("");
              }}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            )}
            {search && (
              <div className="search-results">
                <span className="eyebrow">
                  ALL CASES ·{" "}
                  {results.length === 20
                    ? "FIRST 20 RESULTS"
                    : `${results.length} RESULTS`}
                </span>
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      if (r.kind !== "tools")
                        void db.meta.put({ id: "activeCase", value: r.caseId });
                      onSelect(r);
                      setSearch("");
                    }}
                  >
                    <small>
                      {r.code} · {definitions[r.kind].singular}
                    </small>
                    <strong>{r.title}</strong>
                    <small>
                      {r.kind === "tools"
                        ? "Workspace library"
                        : cases.find((c) => c.id === r.caseId)?.title || r.title}
                    </small>
                  </button>
                ))}
                {!results.length && <p>No matching records.</p>}
              </div>
            )}
          </div>
          <div className="quick-add">
            <button
              className="primary"
              aria-expanded={quick}
              onClick={() => setQuick(!quick)}
            >
              <Plus size={16} />
              <span>Capture</span>
            </button>
            {quick && (
              <div className="quick-menu">
                {kinds
                  .filter((k) => k !== "cases" && k !== "tools")
                  .map((k) => (
                    <button key={k} onClick={() => add(k)}>
                      {k === "timeline" ? "Timeline event" : definitions[k].singular}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="breadcrumb">
            {global ? "Workspace" : activeCase?.code || "Investigation"}{" "}
            <ChevronRight size={12} /> {title}
          </div>
          <div
            className={`page-heading ${section === "dashboard" ? "overview-heading" : ""}`}
          >
            <div>
              <span className="eyebrow">
                {global
                  ? "WORKSPACE"
                  : section === "dashboard"
                    ? "ACTIVE INVESTIGATION"
                    : activeCase?.values.caseNumber || "CASE WORKSPACE"}
              </span>
              <h1>{section === "dashboard" ? "Investigation overview" : title}</h1>
              <p>
                {kind
                  ? definitions[kind].subtitle
                  : section === "dashboard"
                    ? "Evidence, connections, and the next questions to resolve."
                    : section === "graph"
                      ? "Explore relationships and trace the evidence behind each connection."
                      : section === "map"
                        ? "Place evidence and events in their geographic context."
                        : section === "reports"
                          ? "Compile a structured, printable account of your investigation."
                          : section === "settings"
                            ? "Manage local storage, backups, and workspace preferences."
                            : ""}
              </p>
            </div>
            {kind && (
              <button className="primary" onClick={() => add(kind)}>
                <Plus size={16} /> Add {definitions[kind].singular.toLowerCase()}
              </button>
            )}
            {section === "dashboard" && (
              <button onClick={() => add("cases")}>
                <Plus size={16} /> New case
              </button>
            )}
          </div>
          {!global &&
            activeCase?.values.tags
              ?.split(",")
              .map((t) => t.trim())
              .includes("demo") && (
              <div className="demo-notice">
                <span>FICTIONAL CASE</span> Harbor Signal is fictional. Create a new case
                for your own research.
              </div>
            )}
          {section === "dashboard" ? (
            <Dashboard
              all={all}
              records={records}
              activeCase={activeCase}
              relationships={relationships}
              activity={data.activity.filter((a) => a.caseId === caseId)}
              onSelect={onSelect}
              onNavigate={(s) => navigate(`/${s}`)}
              onError={onError}
            />
          ) : kind ? (
            <RecordList
              key={`${kind}:${global ? "workspace" : caseId}`}
              kind={kind}
              records={kind === "cases" || kind === "tools" ? all : records}
              onSelect={onSelect}
              selectedId={selectedId}
              onAdd={() => add(kind)}
              relationships={data.relationships}
              onError={onError}
            />
          ) : section === "graph" ? (
            <Graph
              records={records}
              relationships={relationships}
              caseId={caseId}
              onSelect={onSelect}
              onError={onError}
            />
          ) : section === "map" ? (
            <MapView
              records={records}
              relationships={relationships}
              caseId={caseId}
              onAdd={addLocation}
              onSelect={onSelect}
              onError={onError}
            />
          ) : section === "reports" ? (
            <Reports key={caseId} activeCase={activeCase} records={records} />
          ) : section === "settings" ? (
            <Settings
              caseId={caseId}
              onError={onError}
              onSuccess={(message) => setToast({ message, error: false })}
            />
          ) : section === "about" ? (
            <About />
          ) : (
            <div className="empty">
              <h2>Page not found</h2>
              <button onClick={() => navigate("/dashboard")}>Return to dashboard</button>
            </div>
          )}
          <div className="page-footer">
            <span>TRACE / Open-Source Investigation Workbench</span>
            <span>v0.2.1-beta · Local-first</span>
          </div>
        </main>
      </div>
      {selected && !editor && (
        <RecordInspector
          key={selected.id}
          record={selected}
          records={all}
          onSelect={onSelect}
          onClose={() => dispatch({ type: "close" })}
          back={history.index > 0 ? () => dispatch({ type: "back" }) : undefined}
          forward={
            history.index < history.ids.length - 1
              ? () => dispatch({ type: "forward" })
              : undefined
          }
          onEdit={() => {
            setEditor({ kind: selected.kind, existing: selected });
          }}
          onError={onError}
        />
      )}
      {editor && (
        <RecordEditor
          kind={editor.kind}
          caseId={editor.existing?.caseId ?? caseId}
          existing={editor.existing}
          initial={editor.initial}
          records={all}
          onClose={() => setEditor(undefined)}
          onSaved={(r) => {
            setEditor(undefined);
            if (r.kind === "cases") void db.meta.put({ id: "activeCase", value: r.id });
            setToast({ message: `${r.code} saved locally.`, error: false });
          }}
        />
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.message}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(undefined)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
