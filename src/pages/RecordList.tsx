import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { Timeline } from "../components/Timeline";
import { EmptyState } from "../components/EmptyState";
import { recordColumns } from "../presentation/columns";
import type { Relationship } from "../models/schema";
import {
  Globe,
  MapPin,
  Image,
  Archive,
  Search as SearchIcon,
  Network,
  FileText,
} from "lucide-react";
import type { RecordView } from "../presentation/records";
import { useState } from "react";
import { Search, Download, ArrowUpRight, Star } from "lucide-react";
import { definitions, type Kind } from "../models/schema";
import { csv, download } from "../utils/backup";
import { saveDraft } from "../presentation/saveDraft";
export function Badge({ value }: { value?: string }) {
  return value ? (
    <span className={`badge ${value.toLowerCase().split(" ")[0]}`}>{value}</span>
  ) : (
    <span className="muted">—</span>
  );
}
export function RecordList({
  kind,
  records,
  onSelect,
  onError,
  selectedId,
  onAdd,
  relationships,
}: {
  kind: Kind;
  selectedId?: string;
  onAdd: () => void;
  relationships: Relationship[];
  records: RecordView[];
  onSelect: (r: RecordView) => void;
  onError: (s: string) => void;
}) {
  const files = useLiveQuery(() => db.attachments.toArray()) ?? [];
  const [favorites, setFavorites] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState(kind === "timeline" ? "chronological" : "recent");
  const field =
    definitions[kind].fields.find((f) => f.key === "status") ??
    definitions[kind].fields.find((f) => f.key === "type") ??
    definitions[kind].fields.find((f) => f.key === "category") ??
    definitions[kind].fields.find((f) => f.key === "confidence") ??
    definitions[kind].fields.find((f) => f.key === "reliability");
  const data = records
    .filter(
      (r) =>
        r.kind === kind &&
        (!favorites || r.values.favorite === "yes") &&
        (!query ||
          `${r.title} ${r.code} ${Object.values(r.values).join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (filter === "all" || r.values[field?.key ?? ""] === filter),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "chronological"
          ? (a.values.timestamp ?? "").localeCompare(b.values.timestamp ?? "")
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const columns = recordColumns[kind] ?? [
    { label: "Category", key: "category" },
    { label: "Updated · UTC", key: "updated" },
  ];
  const cell = (r: RecordView, key: string): string => {
    const relations = relationships.filter((rel) => rel.from === r.id || rel.to === r.id);
    if (key === "relations") return String(relations.length);
    if (key === "counts")
      return `${files.filter((f) => f.recordId === r.id).length} files / ${relations.length} links`;
    if (key.endsWith("Count"))
      return String(r.links[key.replace("Count", "")]?.length ?? 0);
    if (key === "publisherDomain") {
      try {
        return r.values.publisher || new URL(r.values.url).hostname;
      } catch {
        return r.values.publisher || "—";
      }
    }
    if (key === "sourceDates")
      return `${r.values.publicationDate || "—"} / ${r.values.accessDate || "—"}`;
    if (key === "updated") return r.updatedAt.slice(0, 10);
    if (key === "observed") return r.values.observed?.replace("T", " ") || "—";
    return r.values[key] || "—";
  };
  return (
    <>
      <div className="toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label={`Search ${definitions[kind].label}`}
            placeholder={`Search ${definitions[kind].label.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {field && (
          <select
            aria-label={`Filter by ${field.label}`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All {field.label.toLowerCase()}</option>
            {field.options?.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        )}
        <select
          aria-label="Sort records"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {kind === "timeline" ? (
            <>
              <option value="chronological">Oldest event first</option>
              <option value="reverseChronological">Newest event first</option>
            </>
          ) : (
            <>
              <option value="recent">Recently updated</option>
              <option value="title">Title A–Z</option>
            </>
          )}
        </select>
        <span className="muted count">{data.length} records</span>
        {["evidence", "timeline"].includes(kind) && (
          <button
            onClick={() =>
              download(
                csv(
                  data.map((r) => r.record),
                  kind,
                  data,
                ),
                `TRACE-${kind}.csv`,
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download size={14} /> CSV
          </button>
        )}
      </div>
      {kind === "tools" && (
        <div className="filter-chips">
          <button
            className={favorites ? "active" : ""}
            aria-pressed={favorites}
            onClick={() => setFavorites(!favorites)}
          >
            <Star size={14} /> Favorites
          </button>
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            All categories
          </button>
          {[
            ...new Set(
              records.filter((r) => r.kind === "tools").map((r) => r.values.category),
            ),
          ].map((category) => (
            <button
              key={category}
              className={filter === category ? "active" : ""}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
      )}
      {!data.length ? (
        <EmptyState
          title={
            records.some((r) => r.kind === kind)
              ? "No matching records"
              : `No ${definitions[kind].label.toLowerCase()} yet`
          }
          description={
            records.some((r) => r.kind === kind)
              ? "Clear the search or change a filter to show more records."
              : kind === "evidence"
                ? "Capture an observation, document, screenshot or archive, then record its source and your assessment."
                : kind === "notes"
                  ? "Write an analytical note and link it to the evidence or entities it concerns."
                  : kind === "sources"
                    ? "Record an original source, its publisher and when you accessed it."
                    : kind === "entities"
                      ? "Add a person, organization, account or object, then connect it to supporting evidence."
                      : kind === "cases"
                        ? "Create a case with a clear objective to organize your investigation."
                        : `Create a ${definitions[kind].singular.toLowerCase()} to begin. ${definitions[kind].subtitle}`
          }
          action={
            records.some((r) => r.kind === kind)
              ? "Clear filters"
              : `Create first ${definitions[kind].singular.toLowerCase()}`
          }
          onAction={
            records.some((r) => r.kind === kind)
              ? () => {
                  setQuery("");
                  setFilter("all");
                  setFavorites(false);
                }
              : onAdd
          }
        />
      ) : kind === "tools" ? (
        <div className="tool-grid">
          {data.map((r) => {
            const Icon = /Map|Geo|Satellite/.test(r.values.category)
              ? MapPin
              : /Image/.test(r.values.category)
                ? Image
                : /Archive/.test(r.values.category)
                  ? Archive
                  : /DNS|IP|Cyber/.test(r.values.category)
                    ? Network
                    : /Document|Metadata/.test(r.values.category)
                      ? FileText
                      : /Search/.test(r.values.category)
                        ? SearchIcon
                        : Globe;
            return (
              <article
                className={`panel tool-card ${selectedId === r.id ? "selected" : ""}`}
                key={r.id}
              >
                <Icon className="tool-category-icon" size={26} />
                <div className="section-heading">
                  <span className="eyebrow">{r.values.category}</span>
                  <button
                    className="icon-button"
                    aria-label={`${r.values.favorite === "yes" ? "Unfavorite" : "Favorite"} ${r.title}`}
                    onClick={async () => {
                      try {
                        await saveDraft(
                          "tools",
                          "",
                          r.title,
                          {
                            ...r.values,
                            favorite: r.values.favorite === "yes" ? "no" : "yes",
                          },
                          r,
                        );
                      } catch (e) {
                        onError(String(e));
                      }
                    }}
                  >
                    <Star
                      size={16}
                      fill={r.values.favorite === "yes" ? "currentColor" : "none"}
                    />
                  </button>
                </div>
                <button className="text-button" onClick={() => onSelect(r)}>
                  <h3>{r.title}</h3>
                </button>
                <p>{r.values.description}</p>
                <div className="section-heading">
                  <span className="muted">
                    {r.values.pricing} · account {r.values.account}
                  </span>
                  <a
                    className="button"
                    href={r.values.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      void saveDraft(
                        "tools",
                        "",
                        r.title,
                        {
                          ...r.values,
                          lastUsed: new Date().toISOString().slice(0, 16),
                        },
                        r,
                      ).catch((e) => onError(String(e)));
                    }}
                  >
                    Open <ArrowUpRight size={14} />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : kind === "timeline" ? (
        <Timeline
          records={data}
          onSelect={onSelect}
          selectedId={selectedId}
          descending={sort === "reverseChronological"}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>
                  {kind === "hypotheses"
                    ? "Statement"
                    : kind === "gaps"
                      ? "Question"
                      : "Title"}
                </th>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>
                  <span className="sr-only">Inspect</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className={selectedId === r.id ? "selected" : ""}>
                  <td className="mono">
                    {r.kind === "cases" ? r.values.caseNumber || r.code : r.code}
                  </td>
                  <td>
                    <button
                      className="record-link"
                      onClick={() => onSelect(r)}
                      aria-pressed={selectedId === r.id}
                    >
                      {r.title}
                    </button>
                    <small className="row-description">
                      {r.values.description || r.values.summary || r.values.notes}
                    </small>
                  </td>
                  {columns.map((c) => (
                    <td key={c.key}>
                      {c.badge ? (
                        <Badge value={cell(r, c.key)} />
                      ) : (
                        <span
                          className={
                            /date|observed|updated/i.test(c.key) ? "mono" : "cell-content"
                          }
                        >
                          {cell(r, c.key)}
                        </span>
                      )}
                    </td>
                  ))}
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Open ${r.title}`}
                      onClick={() => onSelect(r)}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
