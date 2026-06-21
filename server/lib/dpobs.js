const DPOBS_BASE = "https://public-api.meteofrance.fr/public/DPObs/v1";

function normalizeObservation(raw) {
  const data = Array.isArray(raw) ? raw[0] : raw?.properties ? raw.properties : raw;
  if (!data) return null;

  const kToC = (k) => (k != null ? Math.round((k - 273.15) * 10) / 10 : null);
  const paToHpa = (p) => (p != null ? Math.round(p / 100) : null);
  const msToKmh = (v) => (v != null ? Math.round(v * 3.6 * 10) / 10 : null);

  return {
    stationId: data.geo_id_insee || data.id_station,
    referenceTime: data.reference_time,
    validityTime: data.validity_time,
    lat: data.lat,
    lon: data.lon,
    temperature: kToC(data.t),
    dewPoint: kToC(data.td),
    humidity: data.u,
    windDirection: data.dd,
    windSpeed: msToKmh(data.ff),
    windGust: msToKmh(data.fxi10 ?? data.fxi),
    precipitation6m: data.rr_per ?? data.rr1,
    pressure: paToHpa(data.pres),
    seaPressure: paToHpa(data.pmer),
    visibility: data.vv,
    sunshine: data.insolh,
    radiation: data.ray_glo01,
    snowDepth: data.sss,
    cloudCover: data.n,
    raw: data,
  };
}

async function fetchDPObs(path, apiKey, params = {}) {
  const url = new URL(`${DPOBS_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      apikey: apiKey,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.message || json.description || json.error || text;
    } catch {
      /* keep text */
    }
    throw new Error(`DPObs (${response.status}): ${message}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("json")) {
    return response.json();
  }
  return response.text();
}

export function isDpobsConfigured(apiKey) {
  return Boolean(apiKey && apiKey.length > 10);
}

export async function getLatestObservation(stationId, apiKey, type = "6m") {
  const paddedId = String(stationId).padStart(8, "0");
  const endpoint =
    type === "hourly"
      ? "/station/horaire"
      : "/station/infrahoraire-6m";

  const raw = await fetchDPObs(endpoint, apiKey, {
    id_station: paddedId,
    format: "json",
  });

  const list = Array.isArray(raw) ? raw : [raw];
  return normalizeObservation(list[0]);
}

export async function getObservationHistory(stationId, apiKey, { type = "hourly", hours = 24 } = {}) {
  const paddedId = String(stationId).padStart(8, "0");
  const endpoint =
    type === "hourly"
      ? "/station/horaire"
      : "/station/infrahoraire-6m";
  const stepMs = type === "hourly" ? 3600000 : 360000;

  const now = new Date();
  const dates = [];

  for (let i = 0; i < hours; i++) {
    const d = new Date(now.getTime() - i * stepMs);
    if (type === "hourly") {
      d.setUTCMinutes(0, 0, 0);
    } else {
      const mins = d.getUTCMinutes();
      d.setUTCMinutes(mins - (mins % 6), 0, 0);
    }
    dates.push(d.toISOString().replace(/\.\d{3}Z/, "Z"));
  }

  const results = await Promise.allSettled(
    dates.map((date) =>
      fetchDPObs(endpoint, apiKey, {
        id_station: paddedId,
        date,
        format: "json",
      }).then((raw) => {
        const item = Array.isArray(raw) ? raw[0] : raw;
        return normalizeObservation(item);
      })
    )
  );

  const observations = results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value)
    .sort((a, b) => new Date(a.validityTime) - new Date(b.validityTime));

  const unique = [];
  const seen = new Set();
  for (const obs of observations) {
    const key = obs.validityTime;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(obs);
    }
  }

  return unique;
}