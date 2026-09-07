import L from "leaflet";
import type { RecordView } from "../../presentation/records";
import type { Relationship } from "../../models/schema";
export function updateMarkers(
  layer: L.LayerGroup,
  cache: Map<string, L.CircleMarker>,
  records: RecordView[],
  category: string,
  onSelect: (r: RecordView) => void,
  selectedId?: string,
) {
  const visible = records.filter(
    (r) =>
      r.kind === "locations" && (category === "all" || r.values.category === category),
  );
  const ids = new Set(visible.map((r) => r.id));
  for (const [id, marker] of cache)
    if (!ids.has(id)) {
      layer.removeLayer(marker);
      cache.delete(id);
    }
  for (const r of visible) {
    const location = r.record.values;
    const point: L.LatLngTuple = [location.latitude!, location.longitude!];
    let marker = cache.get(r.id);
    if (!marker) {
      marker = L.circleMarker(point, {
        radius: 9,
        color: "#d7b278",
        fillColor: "#a07843",
        fillOpacity: 0.8,
        weight: 2,
      }).addTo(layer);
      cache.set(r.id, marker);
    } else marker.setLatLng(point);
    marker.setStyle({
      radius: selectedId === r.id ? 13 : 9,
      color: selectedId === r.id ? "#ffe0ad" : "#d7b278",
      weight: selectedId === r.id ? 4 : 2,
    });
    marker.off("click");
    marker.on("click", () => onSelect(r));
    const tooltip = document.createElement("span");
    tooltip.textContent = `${r.code} · ${r.title}`;
    if (marker.getTooltip()) marker.setTooltipContent(tooltip);
    else marker.bindTooltip(tooltip);
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = r.title;
    content.append(title);
    const description = document.createElement("p");
    description.textContent = `${r.code} · ${r.values.category ?? "Location"}`;
    content.append(description);
    const button = document.createElement("button");
    button.textContent = "Open record";
    button.onclick = () => onSelect(r);
    content.append(button);
    if (marker.getPopup()) marker.setPopupContent(content);
    else marker.bindPopup(content);
  }
  return visible.map(
    (r) => [r.record.values.latitude!, r.record.values.longitude!] as L.LatLngTuple,
  );
}
export function updateRoutes(
  layer: L.LayerGroup,
  cache: Map<string, L.Polyline>,
  records: RecordView[],
  relationships: Relationship[],
  category: string,
) {
  const locations = new Map(
    records
      .filter(
        (r) =>
          r.kind === "locations" &&
          (category === "all" || r.values.category === category),
      )
      .map((r) => [r.id, r.record.values]),
  );
  const ids = new Set<string>();
  for (const r of relationships.filter((r) => r.type === "ROUTE")) {
    const a = locations.get(r.from),
      b = locations.get(r.to);
    if (!a || !b) continue;
    ids.add(r.id);
    const points: L.LatLngTuple[] = [
      [a.latitude!, a.longitude!],
      [b.latitude!, b.longitude!],
    ];
    const route = cache.get(r.id);
    if (route) route.setLatLngs(points);
    else
      cache.set(
        r.id,
        L.polyline(points, {
          color: "#d7b278",
          weight: 2.5,
          opacity: 0.72,
          dashArray: "6 8",
        }).addTo(layer),
      );
  }
  for (const [id, route] of cache)
    if (!ids.has(id)) {
      layer.removeLayer(route);
      cache.delete(id);
    }
}
