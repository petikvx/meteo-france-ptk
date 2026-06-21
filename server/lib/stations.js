const STATIONS_CSV_URL =
  "https://static.data.gouv.fr/resources/stations-meteo-france/20250104-124154/stations-meteo-france.csv";

let stations = [];
let loadedAt = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000;

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function normalizeStation(row) {
  const id = String(row.id || "").padStart(8, "0");
  return {
    id,
    name: row.name || "",
    longName: row.long_name || "",
    namedPlace: row.named_place || "",
    type: parseInt(row.station_type, 10) || 0,
    basin: row.basin || "",
    lon: parseFloat(row.lon),
    lat: parseFloat(row.lat),
    alt: parseInt(row.alt, 10) || 0,
    department: row.department_id || "",
    isOpen: row.is_open === "true",
    isPublic: row.is_public === "true",
    isDaily: row.is_daily === "true",
    isHourly: row.is_hourly === "true",
    isMinutely: row.is_minutely === "true",
  };
}

export async function loadStations(force = false) {
  if (!force && stations.length && Date.now() - loadedAt < CACHE_TTL) {
    return stations;
  }

  const response = await fetch(STATIONS_CSV_URL);
  if (!response.ok) {
    throw new Error(`Impossible de charger le catalogue stations (${response.status})`);
  }

  const text = await response.text();
  const lines = text.trim().split("\n");
  const headers = parseCsvLine(lines[0]);

  stations = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
    return normalizeStation(row);
  });

  loadedAt = Date.now();
  return stations;
}

function normalizeDeptCode(dept) {
  const s = String(dept ?? "").trim().toUpperCase();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return s;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function searchStations(query, { dept, lat, lon, limit = 30, openOnly = true } = {}) {
  let results = stations;

  if (openOnly) {
    results = results.filter((s) => s.isOpen);
  }

  if (dept) {
    const d = normalizeDeptCode(dept);
    results = results.filter((s) => normalizeDeptCode(s.department) === d);
  }

  if (query) {
    const q = query.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    results = results.filter((s) => {
      const hay = [s.id, s.name, s.longName, s.namedPlace, s.department]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
      return hay.includes(q);
    });
  }

  if (lat != null && lon != null) {
    results = [...results]
      .map((s) => ({ ...s, distance: haversineKm(lat, lon, s.lat, s.lon) }))
      .sort((a, b) => a.distance - b.distance);
  } else {
    results = [...results].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  return results.slice(0, limit);
}

export function getStationById(id) {
  const padded = String(id).padStart(8, "0");
  return stations.find((s) => s.id === padded) || null;
}

export function getStationTypes() {
  return {
    0: "Synoptique (temps réel)",
    1: "Automatique Radôme-Résomé",
    2: "Automatique",
    3: "Automatique (expertise différée)",
    4: "Climatologique",
    5: "Non expertisée",
  };
}