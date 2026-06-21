import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  loadStations,
  searchStations,
  getStationById,
  getStationTypes,
} from "./lib/stations.js";
import {
  isDpobsConfigured,
  getLatestObservation,
  getObservationHistory,
} from "./lib/dpobs.js";
import { fetchVigilanceThumbnail } from "./lib/vigilance.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN =
  process.env.METEOFRANCE_TOKEN ||
  "__Wj7dVSTjV9YGu1guveLyDq0g7S7TfTjaHBTPTpO0kj8__";
const API_KEY = process.env.METEOFRANCE_API_KEY || "";
const API_BASE = "https://webservice.meteofrance.com";

app.use(express.static(path.join(__dirname, "../public"), {
  setHeaders(res, filePath) {
    if (filePath.endsWith("sw.js")) {
      res.setHeader("Service-Worker-Allowed", "/");
      res.setHeader("Cache-Control", "no-cache");
    }
  },
}));

async function fetchMeteo(endpoint, params = {}) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set("token", TOKEN);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Météo France (${response.status}): ${text}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

app.get("/api/places", async (req, res) => {
  try {
    const { q, lat, lon } = req.query;
    if (!q) return res.status(400).json({ error: "Paramètre 'q' requis" });
    const data = await fetchMeteo("places", { q, lat, lon, lang: "fr" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/forecast", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "Paramètres 'lat' et 'lon' requis" });
    }
    const data = await fetchMeteo("forecast", { lat, lon, lang: "fr" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/observation", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "Paramètres 'lat' et 'lon' requis" });
    }
    const data = await fetchMeteo("v2/observation", { lat, lon, lang: "fr" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/rain", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "Paramètres 'lat' et 'lon' requis" });
    }
    const data = await fetchMeteo("rain", { lat, lon, lang: "fr" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/vigilance/thumbnail", async (req, res) => {
  try {
    const day = req.query.day === "tomorrow" ? "tomorrow" : "today";
    const png = await fetchVigilanceThumbnail(TOKEN, day);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/warning", async (req, res) => {
  try {
    const { dept } = req.query;
    if (!dept) {
      return res.status(400).json({ error: "Paramètre 'dept' requis" });
    }
    const data = await fetchMeteo("v3/warning/currentphenomenons", {
      domain: dept,
      depth: 0,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stations/status", (_req, res) => {
  res.json({
    catalogueLoaded: true,
    dpobsConfigured: isDpobsConfigured(API_KEY),
    stationCount: searchStations("", { limit: 99999, openOnly: false }).length,
  });
});

app.get("/api/stations/types", (_req, res) => {
  res.json(getStationTypes());
});

app.get("/api/stations", async (req, res) => {
  try {
    await loadStations();
    const { q, dept, lat, lon, limit } = req.query;
    const results = searchStations(q || "", {
      dept,
      lat: lat != null ? parseFloat(lat) : undefined,
      lon: lon != null ? parseFloat(lon) : undefined,
      limit: limit ? parseInt(limit, 10) : 30,
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stations/:id", async (req, res) => {
  try {
    await loadStations();
    const station = getStationById(req.params.id);
    if (!station) {
      return res.status(404).json({ error: "Station introuvable" });
    }
    res.json(station);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stations/:id/observations", async (req, res) => {
  try {
    if (!isDpobsConfigured(API_KEY)) {
      return res.status(503).json({
        error:
          "Clé API DPObs non configurée. Abonnez-vous à « Données d'observation » sur portail-api.meteofrance.fr et ajoutez METEOFRANCE_API_KEY dans .env",
      });
    }

    await loadStations();
    const station = getStationById(req.params.id);
    if (!station) {
      return res.status(404).json({ error: "Station introuvable" });
    }

    const type = req.query.type === "6m" ? "6m" : "hourly";
    const history = req.query.history === "1";
    const hours = Math.min(parseInt(req.query.hours, 10) || 24, 48);

    if (history) {
      const observations = await getObservationHistory(station.id, API_KEY, {
        type,
        hours: type === "6m" ? Math.min(hours * 10, 24) : hours,
      });
      return res.json({ station, type, observations });
    }

    const latest = await getLatestObservation(station.id, API_KEY, type);
    res.json({ station, type, observation: latest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

loadStations()
  .then((list) => console.log(`Catalogue stations chargé : ${list.length} stations`))
  .catch((err) => console.warn("Catalogue stations non chargé :", err.message));

app.listen(PORT, () => {
  console.log(`Météo France — http://localhost:${PORT}`);
  if (!isDpobsConfigured(API_KEY)) {
    console.warn(
      "METEOFRANCE_API_KEY absent — les observations stations nécessitent une clé DPObs"
    );
  }
});