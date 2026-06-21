import { renderCharts } from "./charts.js";
import {
  getStationFavorites,
  saveStationFavorite,
  removeStationFavorite,
  isStationFavorite,
} from "./storage.js";
import {
  renderDetailMap,
  renderResultsMap,
  showDetailMap,
  hideDetailMap,
  showResultsMap,
  hideResultsMap,
  refreshMaps,
  osmLink,
} from "./map.js";
import { populateDeptFilter } from "./departments.js";

const STATION_TYPES = {
  0: "Synoptique",
  1: "Radôme-Résomé",
  2: "Automatique",
  3: "Auto. (expertise différée)",
  4: "Climatologique",
  5: "Non expertisée",
};

let dpobsReady = false;
let selectedStation = null;
let stationRange = 24;

export function initStations(els) {
  populateDeptFilter(els.stationDeptFilter);
  bindStationEvents(els);
  checkDpobsStatus(els);
  renderStationFavorites(els);
}

export function renderStationFavorites(els) {
  const favs = getStationFavorites();
  if (!favs.length) {
    els.stationFavoritesBar?.classList.add("hidden");
    return false;
  }

  els.stationFavoritesBar?.classList.remove("hidden");
  els.stationFavoritesList.innerHTML = favs
    .map(
      (f) => `
    <button class="fav-chip" data-id="${f.id}" title="#${f.id}">
      ${f.name}
      <span class="remove" data-action="remove" title="Retirer">×</span>
    </button>`
    )
    .join("");

  els.stationFavoritesList.querySelectorAll(".fav-chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      if (e.target.dataset.action === "remove") {
        e.stopPropagation();
        removeStationFavorite(chip.dataset.id);
        renderStationFavorites(els);
        if (selectedStation && chip.dataset.id === selectedStation.id) {
          updateStationFavButton(els, selectedStation);
        }
        return;
      }
      selectStation(els, chip.dataset.id);
    });
  });

  return true;
}

function updateStationFavButton(els, station) {
  const btn = els.stationDetail?.querySelector("#stationFavBtn");
  if (!btn) return;
  const fav = isStationFavorite(station.id);
  btn.classList.toggle("active", fav);
  btn.textContent = fav ? "★ Favori" : "☆ Ajouter aux favoris";
}

async function checkDpobsStatus(els) {
  try {
    const status = await stationApi("/api/stations/status");
    dpobsReady = status.dpobsConfigured;
    if (!dpobsReady) {
      els.stationApiNotice?.classList.remove("hidden");
    }
  } catch {
    els.stationApiNotice?.classList.remove("hidden");
  }
}

function bindStationEvents(els) {
  let debounce = null;

  els.stationSearchInput?.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => searchStations(els), 300);
  });

  els.stationSearchForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    searchStations(els);
  });

  els.stationDeptFilter?.addEventListener("change", () => searchStations(els));

  els.stationGeoBtn?.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => searchStations(els, pos.coords.latitude, pos.coords.longitude),
      () => showStationError(els, "Géolocalisation refusée")
    );
  });

  els.stationTypeToggle?.addEventListener("click", (e) => {
    const btn = e.target.closest(".range-btn");
    if (!btn || !selectedStation) return;
    loadStationObservations(els, selectedStation, btn.dataset.type);
  });

  els.stationRangeToggle?.addEventListener("click", (e) => {
    const btn = e.target.closest(".range-btn");
    if (!btn || !selectedStation) return;
    stationRange = parseInt(btn.dataset.range, 10);
    els.stationRangeToggle.querySelectorAll(".range-btn").forEach((b) => {
      b.classList.toggle("active", parseInt(b.dataset.range, 10) === stationRange);
    });
    loadStationHistory(els, selectedStation);
  });
}

async function stationApi(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur réseau");
  return data;
}

async function searchStations(els, lat, lon) {
  const q = els.stationSearchInput?.value.trim() || "";
  const dept = els.stationDeptFilter?.value || "";

  if (!q && !dept && lat == null) {
    els.stationResults.innerHTML =
      '<p class="station-hint">Saisissez un nom, un département ou utilisez 📍 pour trouver les stations proches.</p>';
    hideResultsMap(els.stationResultsMapWrap);
    return;
  }

  try {
    const params = new URLSearchParams({ limit: "25" });
    if (q) params.set("q", q);
    if (dept) params.set("dept", dept);
    if (lat != null) {
      params.set("lat", lat);
      params.set("lon", lon);
    }

    const results = await stationApi(`/api/stations?${params}`);
    renderStationList(els, results);
  } catch (err) {
    showStationError(els, err.message);
  }
}

function renderStationList(els, stations) {
  if (!stations.length) {
    els.stationResults.innerHTML =
      '<p class="station-hint">Aucune station trouvée.</p>';
    hideResultsMap(els.stationResultsMapWrap);
    return;
  }

  if (
    renderResultsMap(els.stationResultsMap, stations, (id) =>
      selectStation(els, id)
    )
  ) {
    showResultsMap(els.stationResultsMapWrap);
  } else {
    hideResultsMap(els.stationResultsMapWrap);
  }

  els.stationResults.innerHTML = stations
    .map(
      (s) => `
    <button class="station-item" data-id="${s.id}">
      <div class="station-item-top">
        <strong>${s.name}</strong>
        ${s.distance != null ? `<span class="station-dist">${s.distance.toFixed(1)} km</span>` : ""}
      </div>
      <div class="station-item-meta">
        <span>#${s.id}</span>
        <span>Dép. ${s.department}</span>
        <span>${STATION_TYPES[s.type] || "Type " + s.type}</span>
        ${s.isMinutely ? '<span class="badge">6 min</span>' : ""}
        ${s.isHourly ? '<span class="badge">Horaire</span>' : ""}
      </div>
    </button>`
    )
    .join("");

  els.stationResults.querySelectorAll(".station-item").forEach((btn) => {
    btn.addEventListener("click", () => selectStation(els, btn.dataset.id));
  });
}

async function selectStation(els, id) {
  showStationState(els, "loading");
  try {
    const station = await stationApi(`/api/stations/${id}`);
    selectedStation = station;
    els.stationResults.querySelectorAll(".station-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.id === id);
    });
    renderStationDetail(els, station);
    await loadStationObservations(els, station, "hourly");
    showStationState(els, "detail");
  } catch (err) {
    showStationError(els, err.message);
  }
}

function renderStationDetail(els, station) {
  const fav = isStationFavorite(station.id);

  els.stationDetail.innerHTML = `
    <div class="station-detail-header">
      <div>
        <div class="station-title-row">
          <h2>${station.name}</h2>
          <button class="btn-fav ${fav ? "active" : ""}" id="stationFavBtn" type="button">
            ${fav ? "★ Favori" : "☆ Ajouter aux favoris"}
          </button>
        </div>
        <p class="meta">
          ${station.longName || station.namedPlace || ""}
          · #${station.id} · ${station.alt} m
        </p>
      </div>
      <div class="station-coords">
        <a href="${osmLink(station.lat, station.lon)}" target="_blank" rel="noopener noreferrer">
          ${station.lat.toFixed(4)}°N, ${station.lon.toFixed(4)}°E
        </a>
      </div>
    </div>
    <div class="station-meta-grid">
      <div class="meta-card"><span class="label">Département</span><span class="value">${station.department}</span></div>
      <div class="meta-card"><span class="label">Type</span><span class="value">${STATION_TYPES[station.type] || station.type}</span></div>
      <div class="meta-card"><span class="label">Statut</span><span class="value">${station.isOpen ? "Ouverte" : "Fermée"}</span></div>
      <div class="meta-card"><span class="label">Fréquences</span><span class="value">${[
        station.isMinutely && "6 min",
        station.isHourly && "Horaire",
        station.isDaily && "Quotidien",
      ].filter(Boolean).join(", ") || "—"}</span></div>
    </div>`;

  renderDetailMap(els.stationDetailMap, station, els.stationOsmLink);
  showDetailMap(els.stationDetailMapWrap);

  els.stationDetail.querySelector("#stationFavBtn")?.addEventListener("click", () => {
    if (isStationFavorite(station.id)) {
      removeStationFavorite(station.id);
    } else {
      saveStationFavorite(station);
    }
    renderStationFavorites(els);
    updateStationFavButton(els, station);
  });
}

async function loadStationObservations(els, station, type = "hourly") {
  els.stationTypeToggle?.querySelectorAll(".range-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });

  if (!dpobsReady) {
    els.stationObsCurrent.innerHTML =
      '<p class="station-hint">Configurez METEOFRANCE_API_KEY pour afficher les mesures en direct.</p>';
    els.stationTopTemps.innerHTML = "";
    els.stationObsHistory.innerHTML = "";
    return;
  }

  try {
    const { observation } = await stationApi(
      `/api/stations/${station.id}/observations?type=${type}`
    );

    if (!observation) {
      els.stationObsCurrent.innerHTML =
        '<p class="station-hint">Aucune mesure disponible pour cette station.</p>';
      return;
    }

    els.stationObsCurrent.innerHTML = renderObservationCard(observation, type);
    await loadStationHistory(els, station, type);
  } catch (err) {
    els.stationObsCurrent.innerHTML = `<p class="station-error">${err.message}</p>`;
  }
}

async function loadStationHistory(els, station, type) {
  const activeType =
    type ||
    els.stationTypeToggle?.querySelector(".range-btn.active")?.dataset.type ||
    "hourly";

  if (!dpobsReady) return;

  try {
    const { observations } = await stationApi(
      `/api/stations/${station.id}/observations?history=1&type=${activeType}&hours=${stationRange}`
    );

    if (!observations?.length) {
      els.stationObsHistory.innerHTML =
        '<p class="station-hint">Pas d\'historique disponible sur cette période.</p>';
      els.stationChartContainer.innerHTML = "";
      els.stationTopTemps.innerHTML = "";
      return;
    }

    const hourlyFormat = observations.map((o) => ({
      dt: Math.floor(new Date(o.validityTime).getTime() / 1000),
      T: { value: o.temperature },
      humidity: o.humidity,
    }));

    renderCharts(els.stationChartContainer, hourlyFormat, "Europe/Paris", stationRange);
    els.stationTopTemps.innerHTML = renderTopTemperatures(observations, {
      range: stationRange,
      type: activeType,
    });
    els.stationObsHistory.innerHTML = `
      <h4>Dernières mesures</h4>
      <div class="obs-table-wrap">
        <table class="obs-table">
          <thead>
            <tr>
              <th>Heure</th>
              <th>Temp.</th>
              <th>Humid.</th>
              <th>Vent</th>
              <th>Précip.</th>
            </tr>
          </thead>
          <tbody>
            ${observations
              .slice()
              .reverse()
              .slice(0, 20)
              .map(
                (o) => `
              <tr>
                <td>${formatObsTime(o.validityTime)}</td>
                <td>${o.temperature ?? "—"}°</td>
                <td>${o.humidity ?? "—"}%</td>
                <td>${o.windSpeed != null ? `${o.windSpeed} km/h` : "—"}</td>
                <td>${o.precipitation6m != null ? `${o.precipitation6m} mm` : "—"}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    els.stationTopTemps.innerHTML = "";
    els.stationObsHistory.innerHTML = `<p class="station-error">${err.message}</p>`;
  }
}

function getTopTemperatures(observations, limit = 3) {
  return [...observations]
    .filter((o) => o.temperature != null)
    .sort((a, b) => b.temperature - a.temperature)
    .slice(0, limit);
}

function renderTopTemperatures(observations, { range, type }) {
  const top = getTopTemperatures(observations);
  if (!top.length) {
    return '<p class="station-hint">Pas assez de mesures de température sur cette période.</p>';
  }

  const stepLabel = type === "6m" ? "6 min" : "horaire";

  return `
    <div class="top-temps-section">
      <h4>Top 3 températures <span class="range-label">(${range} h · pas ${stepLabel})</span></h4>
      <ol class="top-temps-list">
        ${top
          .map(
            (o, i) => `
          <li class="top-temp-item">
            <span class="top-temp-rank">${i + 1}</span>
            <span class="top-temp-value">${o.temperature}°C</span>
            <span class="top-temp-time">${formatObsTime(o.validityTime)}</span>
          </li>`
          )
          .join("")}
      </ol>
    </div>`;
}

function renderObservationCard(obs, type) {
  const time = formatObsTime(obs.validityTime);
  return `
    <div class="obs-current-grid">
      <div class="obs-metric main">
        <span class="label">Température</span>
        <span class="value">${obs.temperature ?? "—"}°C</span>
      </div>
      <div class="obs-metric">
        <span class="label">Humidité</span>
        <span class="value">${obs.humidity ?? "—"}%</span>
      </div>
      <div class="obs-metric">
        <span class="label">Vent</span>
        <span class="value">${obs.windSpeed != null ? `${obs.windSpeed} km/h` : "—"}</span>
      </div>
      <div class="obs-metric">
        <span class="label">Rafales</span>
        <span class="value">${obs.windGust != null ? `${obs.windGust} km/h` : "—"}</span>
      </div>
      <div class="obs-metric">
        <span class="label">Précip. ${type === "6m" ? "6 min" : "1 h"}</span>
        <span class="value">${obs.precipitation6m ?? 0} mm</span>
      </div>
      <div class="obs-metric">
        <span class="label">Pression</span>
        <span class="value">${obs.pressure ?? obs.seaPressure ?? "—"} ${obs.pressure ? "hPa" : ""}</span>
      </div>
      <div class="obs-metric">
        <span class="label">Visibilité</span>
        <span class="value">${obs.visibility != null ? `${obs.visibility} m` : "—"}</span>
      </div>
      <div class="obs-metric">
        <span class="label">Mesure de</span>
        <span class="value">${time}</span>
      </div>
    </div>`;
}

function formatObsTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

function showStationState(els, state) {
  els.stationWelcome?.classList.toggle("hidden", state !== "welcome");
  els.stationLoading?.classList.toggle("hidden", state !== "loading");
  els.stationError?.classList.toggle("hidden", state !== "error");
  els.stationDetailView?.classList.toggle("hidden", state === "welcome");

  const showDetail = state === "detail";
  els.stationDetail?.classList.toggle("hidden", !showDetail);
  els.stationDetailMapWrap?.classList.toggle("hidden", !showDetail);
  els.stationObsCurrent?.parentElement?.classList.toggle("hidden", !showDetail);
  els.stationChartContainer?.parentElement?.classList.toggle("hidden", !showDetail);

  if (showDetail) refreshMaps();
}

function showStationError(els, message) {
  if (els.stationError) {
    els.stationError.textContent = message;
    showStationState(els, "error");
  }
}

export function showStationsView(els) {
  showStationState(els, selectedStation ? "detail" : "welcome");
  refreshMaps();
}