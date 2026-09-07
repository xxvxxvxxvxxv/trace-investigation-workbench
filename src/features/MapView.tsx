import type { DraftValues } from "../presentation/records";
import type { RecordView } from "../presentation/records";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RelationshipDialog } from "../components/RelationshipDialog";
import { updateMarkers, updateRoutes } from "./map/layers";
import type { Relationship } from "../models/schema";
export function MapView({
  records,
  relationships,
  caseId,
  onAdd,
  onSelect,
  onError,
}: {
  records: RecordView[];
  relationships: Relationship[];
  caseId: string;
  onAdd: (v: DraftValues) => void;
  onSelect: (r: RecordView) => void;
  onError: (s: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tiles, setTiles] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [category, setCategory] = useState("all");
  const [routeOpen, setRouteOpen] = useState(false);
  const [showLocations, setShowLocations] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [coordinates, setCoordinates] = useState("LAT 50.80200 · LON −1.09800 · Z13");
  const locations = records.filter((r) => r.kind === "locations");
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    markers: L.LayerGroup;
    routes: L.LayerGroup;
    basemap: L.LayerGroup;
    tiles?: L.TileLayer;
  } | null>(null);
  const markersRef = useRef(new Map<string, L.CircleMarker>());
  const routesRef = useRef(new Map<string, L.Polyline>());
  const viewport = useRef({ caseId: "", fitted: false });
  const latest = useRef({ placing, onAdd });
  useEffect(() => {
    latest.current = { placing, onAdd };
  }, [placing, onAdd]);
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current).setView([50.802, -1.098], 13);
    mapRef.current = map;
    layersRef.current = {
      markers: L.layerGroup().addTo(map),
      routes: L.layerGroup().addTo(map),
      basemap: L.layerGroup().addTo(map),
    };
    map.on("click", (event: L.LeafletMouseEvent) => {
      if (latest.current.placing) {
        latest.current.onAdd({
          latitude: event.latlng.lat.toFixed(6),
          longitude: event.latlng.lng.toFixed(6),
        });
        setPlacing(false);
      }
    });
    map.on("moveend zoomend", () => {
      const center = map.getCenter();
      setCoordinates(
        `LAT ${center.lat.toFixed(5)} · LON ${center.lng.toFixed(5)} · Z${map.getZoom()}`,
      );
    });
    const observer = new ResizeObserver(() =>
      map.invalidateSize({ pan: true, animate: false }),
    );
    observer.observe(ref.current);
    const markers = markersRef.current;
    const routes = routesRef.current;
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
      markers.clear();
      routes.clear();
      viewport.current = { caseId: "", fitted: false };
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current,
      layers = layersRef.current;
    if (!map || !layers) return;
    const points = updateMarkers(
      layers.markers,
      markersRef.current,
      records,
      category,
      (r) => {
        setSelectedId(r.id);
        onSelect(r);
      },
      selectedId,
    );
    updateRoutes(layers.routes, routesRef.current, records, relationships, category);
    if (viewport.current.caseId !== caseId) viewport.current = { caseId, fitted: false };
    if (!viewport.current.fitted && points.length) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 14 });
      viewport.current.fitted = true;
    }
  }, [records, relationships, category, caseId, onSelect, selectedId]);
  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    if (tiles) {
      layers.tiles ??= L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      });
      layers.basemap.addLayer(layers.tiles);
    } else layers.basemap.clearLayers();
  }, [tiles]);
  useEffect(() => {
    const map = mapRef.current,
      layers = layersRef.current;
    if (!map || !layers) return;
    for (const [layer, visible] of [
      [layers.markers, showLocations],
      [layers.routes, showRoutes],
    ] as const) {
      if (visible) layer.addTo(map);
      else map.removeLayer(layer);
    }
  }, [showLocations, showRoutes]);
  const fit = () => {
    const points = [...markersRef.current.values()].map((marker) => marker.getLatLng());
    if (points.length)
      mapRef.current?.fitBounds(L.latLngBounds(points), {
        padding: [60, 60],
        maxZoom: 16,
      });
  };
  return (
    <>
      <div className="map-workspace">
        <div className="toolbar">
          <button
            className={placing ? "primary" : ""}
            onClick={() => setPlacing(!placing)}
          >
            {placing ? "Click map to place · Cancel" : "Place marker"}
          </button>
          <button onClick={() => onAdd({})}>Enter coordinates</button>
          <button onClick={fit}>Fit locations</button>
          <button onClick={() => setRouteOpen(true)}>Connect locations</button>
          <select
            aria-label="Marker category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              "all",
              "observation",
              "infrastructure",
              "route point",
              "area of interest",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <label className="check">
            <input
              type="checkbox"
              checked={tiles}
              onChange={(e) => setTiles(e.target.checked)}
            />{" "}
            Online basemap
          </label>
        </div>
        <div className="map-stage">
          <div
            className={`map-canvas ${placing ? "placing" : ""}`}
            ref={ref}
            aria-label="Location map"
          />
          <div className="map-layers">
            <h3>Map layers</h3>
            <label className="check">
              <input
                type="checkbox"
                checked={showLocations}
                onChange={(e) => setShowLocations(e.target.checked)}
              />
              Locations · {locations.length}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={showRoutes}
                onChange={(e) => setShowRoutes(e.target.checked)}
              />
              Routes · {relationships.filter((r) => r.type === "ROUTE").length}
            </label>
          </div>
          <span className="map-mode">
            {tiles ? "OpenStreetMap" : "OFFLINE COORDINATES"}
          </span>
          <span className="map-coordinates">{coordinates}</span>
          {!locations.length && (
            <div className="map-empty">
              <h3>No mapped observations yet</h3>
              <p>
                Place a marker or enter coordinates to give this case geographic context.
              </p>
            </div>
          )}
        </div>
        <p className="map-disclosure">
          Enabling online tiles sends tile requests, including your IP and viewed map
          area, to OpenStreetMap infrastructure. TRACE does not send case records.
        </p>
      </div>
      {routeOpen && (
        <RelationshipDialog
          route
          records={records}
          caseId={caseId}
          onClose={() => setRouteOpen(false)}
          onError={onError}
        />
      )}
      <p className="muted route-note">
        Route lines are analyst-defined connections, not verified travel paths. Edit them
        in Graph.
      </p>
      <div className="location-list">
        {locations.map((r) => (
          <button
            key={r.id}
            className={selectedId === r.id ? "selected" : ""}
            title={`${r.code} · ${r.title}`}
            onClick={() => {
              setSelectedId(r.id);
              onSelect(r);
              mapRef.current?.panTo([
                r.record.values.latitude!,
                r.record.values.longitude!,
              ]);
            }}
          >
            <span className="mono">{r.code}</span> {r.title}
            <small>
              {r.values.latitude}, {r.values.longitude}
            </small>
          </button>
        ))}
      </div>
    </>
  );
}
