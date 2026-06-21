const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

let detailMap = null;
let detailMarker = null;
let resultsMap = null;
let resultsLayer = null;

function leaflet() {
  if (!window.L) return null;
  return window.L;
}

function createMap(el) {
  const L = leaflet();
  if (!L) return null;

  const map = L.map(el, { scrollWheelZoom: false });
  L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
  return map;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function osmLink(lat, lon) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`;
}

export function renderDetailMap(container, station, linkEl) {
  const L = leaflet();
  if (!L || !container || station?.lat == null || station?.lon == null) return;

  const { lat, lon } = station;

  if (!detailMap) {
    detailMap = createMap(container);
  }
  if (!detailMap) return;

  detailMap.setView([lat, lon], 13);

  if (detailMarker) detailMarker.remove();
  detailMarker = L.marker([lat, lon])
    .addTo(detailMap)
    .bindPopup(`<strong>${escapeHtml(station.name)}</strong>`)
    .openPopup();

  if (linkEl) {
    linkEl.href = osmLink(lat, lon);
    linkEl.textContent = "Ouvrir dans OpenStreetMap";
  }

  requestAnimationFrame(() => detailMap.invalidateSize());
}

export function renderResultsMap(container, stations, onSelect) {
  const L = leaflet();
  if (!L || !container || !stations?.length) return false;

  const withCoords = stations.filter((s) => s.lat != null && s.lon != null);
  if (!withCoords.length) return false;

  if (!resultsMap) {
    resultsMap = createMap(container);
  }
  if (!resultsMap) return false;

  if (resultsLayer) {
    resultsLayer.clearLayers();
  } else {
    resultsLayer = L.layerGroup().addTo(resultsMap);
  }

  const bounds = [];

  for (const station of withCoords) {
    const marker = L.marker([station.lat, station.lon]);
    marker.bindPopup(`<strong>${escapeHtml(station.name)}</strong>`);
    marker.on("click", () => onSelect?.(station.id));
    resultsLayer.addLayer(marker);
    bounds.push([station.lat, station.lon]);
  }

  if (bounds.length === 1) {
    resultsMap.setView(bounds[0], 11);
  } else {
    resultsMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
  }

  requestAnimationFrame(() => resultsMap.invalidateSize());
  return true;
}

export function showDetailMap(wrapEl) {
  wrapEl?.classList.remove("hidden");
  requestAnimationFrame(() => detailMap?.invalidateSize());
}

export function hideDetailMap(wrapEl) {
  wrapEl?.classList.add("hidden");
}

export function showResultsMap(wrapEl) {
  wrapEl?.classList.remove("hidden");
  requestAnimationFrame(() => resultsMap?.invalidateSize());
}

export function hideResultsMap(wrapEl) {
  wrapEl?.classList.add("hidden");
}

export function refreshMaps() {
  requestAnimationFrame(() => {
    detailMap?.invalidateSize();
    resultsMap?.invalidateSize();
  });
}