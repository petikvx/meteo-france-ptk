import { pictoHtml } from "./pictos.js";
import { renderCharts } from "./charts.js";
import { initStations, showStationsView, renderStationFavorites } from "./stations.js";
import {
  getTheme,
  setTheme,
  getFavorites,
  saveFavorite,
  removeFavorite,
  isFavorite,
  saveLastCity,
  getLastCity,
  saveLastWeather,
  getLastWeather,
  getChartRange,
  setChartRange,
} from "./storage.js";

const PHENOMENON_LABELS = {
  1: "Vent violent",
  2: "Pluie-inondation",
  3: "Orages",
  4: "Inondation",
  5: "Neige-verglas",
  6: "Canicule",
  7: "Grand froid",
  8: "Avalanches",
  9: "Vagues-submersion",
};

const COLOR_LABELS = {
  1: "Vert",
  2: "Jaune",
  3: "Orange",
  4: "Rouge",
};

const RAIN_PICTO = { 1: "p1j", 2: "p6j", 3: "p5j", 4: "p5j" };

const $ = (sel) => document.querySelector(sel);

const els = {
  welcome: $("#welcome"),
  skeleton: $("#skeleton"),
  error: $("#error"),
  weather: $("#weather"),
  offlineBanner: $("#offlineBanner"),
  searchForm: $("#searchForm"),
  searchInput: $("#searchInput"),
  suggestions: $("#suggestions"),
  currentCard: $("#currentCard"),
  vigilanceSection: $("#vigilanceSection"),
  alertsDept: $("#alertsDept"),
  alertsList: $("#alertsList"),
  probSection: $("#probSection"),
  probGrid: $("#probGrid"),
  chartsSection: $("#chartsSection"),
  chartsContainer: $("#chartsContainer"),
  rainSection: $("#rainSection"),
  rainTimeline: $("#rainTimeline"),
  dailyGrid: $("#dailyGrid"),
  hourlyScroll: $("#hourlyScroll"),
  themeToggle: $("#themeToggle"),
  geoBtn: $("#geoBtn"),
  favoritesBar: $("#favoritesBar"),
  favoritesList: $("#favoritesList"),
  chartRangeToggle: $("#chartRangeToggle"),
  hourlyRangeLabel: $("#hourlyRangeLabel"),
  mainNav: $("#mainNav"),
  forecastView: $("#forecastView"),
  stationsView: $("#stationsView"),
  stationFavoritesBar: $("#stationFavoritesBar"),
  stationFavoritesList: $("#stationFavoritesList"),
  stationSearchForm: $("#stationSearchForm"),
  stationSearchInput: $("#stationSearchInput"),
  stationDeptFilter: $("#stationDeptFilter"),
  stationGeoBtn: $("#stationGeoBtn"),
  stationApiNotice: $("#stationApiNotice"),
  stationWelcome: $("#stationWelcome"),
  stationResults: $("#stationResults"),
  stationDetailView: $("#stationDetailView"),
  stationLoading: $("#stationLoading"),
  stationError: $("#stationError"),
  stationDetail: $("#stationDetail"),
  stationResultsMapWrap: $("#stationResultsMapWrap"),
  stationResultsMap: $("#stationResultsMap"),
  stationDetailMapWrap: $("#stationDetailMapWrap"),
  stationDetailMap: $("#stationDetailMap"),
  stationOsmLink: $("#stationOsmLink"),
  stationTypeToggle: $("#stationTypeToggle"),
  stationObsCurrent: $("#stationObsCurrent"),
  stationRangeToggle: $("#stationRangeToggle"),
  stationChartContainer: $("#stationChartContainer"),
  stationTopTemps: $("#stationTopTemps"),
  stationObsHistory: $("#stationObsHistory"),
};

let debounceTimer = null;
let selectedPlace = null;
let chartRange = getChartRange();
let hourlyForecast = [];
let currentTimezone = "Europe/Paris";

function formatDay(timestamp, timezone) {
  const date = new Date(timestamp * 1000);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sameDay = (a, b) =>
    a.toLocaleDateString("fr-FR", { timeZone: timezone }) ===
    b.toLocaleDateString("fr-FR", { timeZone: timezone });

  if (sameDay(date, today)) return "Aujourd'hui";
  if (sameDay(date, tomorrow)) return "Demain";

  const formatted = date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatHour(timestamp, timezone) {
  return new Date(timestamp * 1000).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function formatTime(timestamp, timezone) {
  return new Date(timestamp * 1000).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function placeVigilanceSection(state) {
  const section = els.vigilanceSection;
  if (!section) return;

  if (state === "weather" && els.currentCard?.parentElement) {
    els.currentCard.insertAdjacentElement("afterend", section);
  } else if (els.forecastView) {
    els.forecastView.insertBefore(section, els.welcome);
  }
}

function showState(state) {
  els.welcome.classList.toggle("hidden", state !== "welcome");
  els.skeleton.classList.toggle("hidden", state !== "loading");
  els.error.classList.toggle("hidden", state !== "error");
  els.weather.classList.toggle("hidden", state !== "weather");
  placeVigilanceSection(state);
}

function showError(message) {
  els.error.textContent = message;
  showState("error");
}

async function api(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur réseau");
  return data;
}

function renderFavorites() {
  const favs = getFavorites();
  if (!favs.length) {
    els.favoritesBar.classList.add("hidden");
    return;
  }

  els.favoritesBar.classList.remove("hidden");
  els.favoritesList.innerHTML = favs
    .map(
      (f) => `
    <button class="fav-chip" data-lat="${f.lat}" data-lon="${f.lon}" data-name="${f.name}" data-dept="${f.dept || ""}">
      ${f.name}
      <span class="remove" data-action="remove" title="Retirer">×</span>
    </button>`
    )
    .join("");

  els.favoritesList.querySelectorAll(".fav-chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      if (e.target.dataset.action === "remove") {
        e.stopPropagation();
        removeFavorite({
          lat: parseFloat(chip.dataset.lat),
          lon: parseFloat(chip.dataset.lon),
        });
        renderFavorites();
        return;
      }
      selectedPlace = {
        name: chip.dataset.name,
        lat: parseFloat(chip.dataset.lat),
        lon: parseFloat(chip.dataset.lon),
        dept: chip.dataset.dept,
      };
      els.searchInput.value = selectedPlace.name;
      loadWeather(selectedPlace);
    });
  });
}

async function searchPlaces(query) {
  if (query.length < 2) {
    els.suggestions.hidden = true;
    return;
  }
  const places = await api(`/api/places?q=${encodeURIComponent(query)}`);
  renderSuggestions(places.slice(0, 8));
}

function renderSuggestions(places) {
  if (!places.length) {
    els.suggestions.hidden = true;
    return;
  }

  els.suggestions.innerHTML = places
    .map(
      (p) => `
    <li data-lat="${p.lat}" data-lon="${p.lon}" data-name="${p.name}" data-dept="${p.admin2 || ""}">
      <strong>${p.name}</strong>
      <span class="place-country">${[p.admin, p.country].filter(Boolean).join(", ")}</span>
    </li>`
    )
    .join("");

  els.suggestions.hidden = false;

  els.suggestions.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", () => {
      selectedPlace = {
        name: li.dataset.name,
        lat: parseFloat(li.dataset.lat),
        lon: parseFloat(li.dataset.lon),
        dept: li.dataset.dept,
      };
      els.searchInput.value = selectedPlace.name;
      els.suggestions.hidden = true;
      loadWeather(selectedPlace);
    });
  });
}

async function loadWeather(place, { offline = false } = {}) {
  showState("loading");
  els.offlineBanner.classList.add("hidden");
  selectedPlace = place;
  saveLastCity(place);

  try {
    const [forecast, observation, rain] = await Promise.all([
      api(`/api/forecast?lat=${place.lat}&lon=${place.lon}`),
      api(`/api/observation?lat=${place.lat}&lon=${place.lon}`),
      api(`/api/rain?lat=${place.lat}&lon=${place.lon}`).catch(() => null),
    ]);

    let warning = null;
    const dept = forecast.position?.dept || place.dept;
    if (dept) {
      warning = await api(`/api/warning?dept=${dept}`).catch(() => null);
    }

    const payload = { forecast, observation, rain, warning, place };
    saveLastWeather(payload);
    renderWeather(payload);
    refreshVigilanceMaps();
    showState("weather");
  } catch (err) {
    const cached = getLastWeather();
    if (cached?.data && cached.data.place?.lat === place.lat) {
      renderWeather(cached.data);
      refreshVigilanceMaps();
      els.offlineBanner.classList.remove("hidden");
      showState("weather");
      return;
    }
    if (offline) {
      showError(`Hors ligne : ${err.message}`);
    } else {
      showError(`Impossible de charger les données : ${err.message}`);
    }
  }
}

function renderWeather({ forecast, observation, rain, warning, place }) {
  const pos = forecast.position;
  const tz = pos.timezone || "Europe/Paris";
  const obs = observation.properties?.gridded || {};
  const current = forecast.forecast?.[0] || {};
  const iconCode = obs.weather_icon || current.weather?.icon;
  const temp = obs.T ?? current.T?.value ?? "—";
  const desc = obs.weather_description || current.weather?.desc || "—";
  const wind = obs.wind_speed ?? current.wind?.speed ?? null;
  const windDir = obs.wind_icon || current.wind?.icon || "";
  const humidity =
    typeof current.humidity === "object"
      ? current.humidity?.value
      : current.humidity ?? "—";
  const today = forecast.daily_forecast?.[0];
  const fav = isFavorite(place || { lat: pos.lat, lon: pos.lon });

  els.currentCard.innerHTML = `
    <div class="current-top">
      <div class="current-location">
        <h2>${pos.name}</h2>
        <p class="meta">${pos.country}${pos.dept ? ` · Département ${pos.dept}` : ""}</p>
        <div class="location-actions">
          <button class="btn-fav ${fav ? "active" : ""}" id="favBtn" type="button">
            ${fav ? "★ Favori" : "☆ Ajouter aux favoris"}
          </button>
        </div>
      </div>
      <div class="current-weather-main">
        <div class="picto-wrap">${pictoHtml(iconCode, 72)}</div>
        <div class="current-temp-block">
          <div class="current-temp">${Math.round(temp)}°</div>
          <div class="current-desc">${desc}</div>
        </div>
      </div>
    </div>
    ${
      today?.sun
        ? `<div class="sun-times">
            <div class="sun-item">
              <span class="icon">🌅</span>
              <div>
                <div class="label">Lever</div>
                <div>${formatTime(today.sun.rise, tz)}</div>
              </div>
            </div>
            <div class="sun-item">
              <span class="icon">🌇</span>
              <div>
                <div class="label">Coucher</div>
                <div>${formatTime(today.sun.set, tz)}</div>
              </div>
            </div>
          </div>`
        : ""
    }
    <div class="current-details">
      <div class="detail-item">
        <div class="label">Min / Max</div>
        <div class="value">${today ? `${Math.round(today.T.min)}° / ${Math.round(today.T.max)}°` : "—"}</div>
      </div>
      <div class="detail-item">
        <div class="label">Humidité</div>
        <div class="value">${humidity !== "—" ? `${humidity}%` : "—"}</div>
      </div>
      <div class="detail-item">
        <div class="label">Vent</div>
        <div class="value">${wind !== null ? `${Math.round(wind * 3.6)} km/h ${windDir}` : "—"}</div>
      </div>
      <div class="detail-item">
        <div class="label">Précipitations</div>
        <div class="value">${today?.precipitation?.["24h"] ?? 0} mm</div>
      </div>
      <div class="detail-item">
        <div class="label">Indice UV</div>
        <div class="value">${today?.uv ?? "—"}</div>
      </div>
    </div>`;

  $("#favBtn")?.addEventListener("click", () => {
    const p = {
      name: pos.name,
      lat: pos.lat,
      lon: pos.lon,
      dept: pos.dept || "",
    };
    if (isFavorite(p)) {
      removeFavorite(p);
    } else {
      saveFavorite(p);
    }
    renderFavorites();
    const btn = $("#favBtn");
    const nowFav = isFavorite(p);
    btn.classList.toggle("active", nowFav);
    btn.textContent = nowFav ? "★ Favori" : "☆ Ajouter aux favoris";
  });

  renderAlerts(warning);
  renderProbabilities(forecast.probability_forecast, forecast.daily_forecast, tz);
  hourlyForecast = forecast.forecast || [];
  currentTimezone = tz;
  applyChartRange(chartRange);
  els.chartsSection.classList.toggle("hidden", !hourlyForecast.length);
  renderRain(rain, tz);
  renderDaily(forecast.daily_forecast?.slice(0, 7) || [], tz);
}

function applyChartRange(range) {
  chartRange = range;
  setChartRange(range);
  updateRangeToggle();
  renderCharts(els.chartsContainer, hourlyForecast, currentTimezone, range);
  renderHourly(hourlyForecast.slice(0, range), currentTimezone, range);
  if (els.hourlyRangeLabel) {
    els.hourlyRangeLabel.textContent = `(${range} h)`;
  }
}

function updateRangeToggle() {
  els.chartRangeToggle?.querySelectorAll(".range-btn").forEach((btn) => {
    btn.classList.toggle("active", parseInt(btn.dataset.range, 10) === chartRange);
  });
}

function renderAlerts(warning) {
  if (!warning?.phenomenons_max_colors?.length) {
    els.alertsDept?.classList.add("hidden");
    return;
  }

  const active = warning.phenomenons_max_colors.filter(
    (p) => p.phenomenon_max_color_id > 1
  );
  if (!active.length) {
    els.alertsDept?.classList.add("hidden");
    return;
  }

  els.alertsDept?.classList.remove("hidden");
  els.alertsList.innerHTML = active
    .map((p) => {
      const label =
        PHENOMENON_LABELS[p.phenomenon_id] || `Phénomène ${p.phenomenon_id}`;
      const color = COLOR_LABELS[p.phenomenon_max_color_id] || "";
      return `<div class="alert-item color-${p.phenomenon_max_color_id}">⚠ ${label} — ${color}</div>`;
    })
    .join("");
}

function renderProbabilities(probForecast, dailyForecast, tz) {
  if (!probForecast?.length) {
    els.probSection.classList.add("hidden");
    return;
  }

  const withData = probForecast.filter(
    (p) =>
      p.rain?.["6h"] != null ||
      p.snow?.["6h"] != null ||
      p.freezing > 0
  );

  if (!withData.length) {
    els.probSection.classList.add("hidden");
    return;
  }

  els.probSection.classList.remove("hidden");
  els.probGrid.innerHTML = withData.slice(0, 5).map((p) => {
    const dayLabel = formatDay(p.dt, tz);
    const rain = p.rain?.["6h"] ?? p.rain?.["3h"] ?? 0;
    const snow = p.snow?.["6h"] ?? p.snow?.["3h"] ?? 0;
    const freeze = p.freezing ?? 0;

    return `
    <div class="prob-card">
      <div class="day">${dayLabel}</div>
      <div class="prob-bar-group">
        <div class="prob-label"><span>Pluie</span><span>${rain}%</span></div>
        <div class="prob-bar"><div class="prob-fill rain" style="width:${rain}%"></div></div>
      </div>
      <div class="prob-bar-group">
        <div class="prob-label"><span>Neige</span><span>${snow}%</span></div>
        <div class="prob-bar"><div class="prob-fill snow" style="width:${snow}%"></div></div>
      </div>
      ${
        freeze > 0
          ? `<div class="prob-bar-group">
              <div class="prob-label"><span>Gel</span><span>${freeze}%</span></div>
              <div class="prob-bar"><div class="prob-fill freeze" style="width:${freeze}%"></div></div>
            </div>`
          : ""
      }
    </div>`;
  }).join("");
}

function renderRain(rain, tz) {
  if (!rain?.forecast?.length) {
    els.rainSection.classList.add("hidden");
    return;
  }

  els.rainSection.classList.remove("hidden");
  els.rainTimeline.innerHTML = rain.forecast
    .slice(0, 12)
    .map(
      (slot) => `
    <div class="rain-slot">
      <div class="time">${formatHour(slot.dt, tz)}</div>
      <div class="picto-wrap">${pictoHtml(RAIN_PICTO[slot.rain] || "p1j", 28)}</div>
      <div class="desc">${slot.desc}</div>
    </div>`
    )
    .join("");
}

function renderDaily(days, tz) {
  els.dailyGrid.innerHTML = days
    .map((day) => {
      const w = day.weather12H || {};
      return `
    <div class="daily-card">
      <div class="day">${formatDay(day.dt, tz)}</div>
      <div class="picto-wrap">${pictoHtml(w.icon, 40)}</div>
      <div class="desc">${w.desc || ""}</div>
      <div class="temps">
        <span class="max">${Math.round(day.T.max)}°</span>
        <span class="min"> / ${Math.round(day.T.min)}°</span>
      </div>
      ${
        day.sun
          ? `<div class="sun-mini">🌅 ${formatTime(day.sun.rise, tz)} · 🌇 ${formatTime(day.sun.set, tz)}</div>`
          : ""
      }
    </div>`;
    })
    .join("");
}

function renderHourly(hours, tz, range = 24) {
  els.hourlyScroll.innerHTML = hours
    .map((h) => {
      const rain = h.rain?.["1h"];
      const hourLabel =
        range === 48
          ? new Date(h.dt * 1000).toLocaleString("fr-FR", {
              weekday: "short",
              hour: "2-digit",
              timeZone: tz,
            })
          : formatHour(h.dt, tz);
      return `
    <div class="hourly-card">
      <div class="hour">${hourLabel}</div>
      <div class="picto-wrap">${pictoHtml(h.weather?.icon, 32)}</div>
      <div class="temp">${Math.round(h.T?.value ?? 0)}°</div>
      ${rain ? `<div class="rain">${rain} mm</div>` : ""}
    </div>`;
    })
    .join("");
}

async function searchAndLoad(query, preferFrance = false) {
  const places = await api(`/api/places?q=${encodeURIComponent(query)}`);
  if (!places.length) {
    showError(`Aucune ville trouvée pour « ${query} »`);
    return;
  }
  const place = preferFrance
    ? places.find((p) => p.country === "FR") || places[0]
    : places[0];
  selectedPlace = {
    name: place.name,
    lat: place.lat,
    lon: place.lon,
    dept: place.admin2,
  };
  els.searchInput.value = selectedPlace.name;
  loadWeather(selectedPlace);
}

function useGeolocation() {
  if (!navigator.geolocation) {
    showError("La géolocalisation n'est pas supportée par votre navigateur.");
    return;
  }

  showState("loading");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      selectedPlace = {
        name: "Ma position",
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        dept: "",
      };
      els.searchInput.value = selectedPlace.name;
      loadWeather(selectedPlace);
    },
    () => showError("Impossible d'accéder à votre position. Vérifiez les permissions."),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function initTheme() {
  const theme = getTheme();
  setTheme(theme);
  els.themeToggle.textContent = theme === "dark" ? "🌙" : "☀️";
}

els.themeToggle.addEventListener("click", () => {
  const next = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  els.themeToggle.textContent = next === "dark" ? "🌙" : "☀️";
});

els.geoBtn.addEventListener("click", () => {
  if (els.stationsView && !els.stationsView.classList.contains("hidden")) return;
  useGeolocation();
});

els.mainNav?.addEventListener("click", (e) => {
  const tab = e.target.closest(".nav-tab");
  if (!tab) return;
  switchView(tab.dataset.view);
});

function switchView(view) {
  const isForecast = view === "forecast";
  els.mainNav?.querySelectorAll(".nav-tab").forEach((t) => {
    const active = t.dataset.view === view;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active);
  });
  els.forecastView?.classList.toggle("hidden", !isForecast);
  els.stationsView?.classList.toggle("hidden", isForecast);
  els.searchForm?.classList.toggle("hidden", !isForecast);
  els.favoritesBar?.classList.toggle("hidden", !isForecast || !getFavorites().length);
  els.stationFavoritesBar?.classList.toggle(
    "hidden",
    isForecast || !renderStationFavorites(els)
  );
  els.geoBtn?.classList.toggle("hidden", !isForecast);
  if (!isForecast) showStationsView(els);
  else refreshVigilanceMaps();
}

els.chartRangeToggle?.addEventListener("click", (e) => {
  const btn = e.target.closest(".range-btn");
  if (!btn || !hourlyForecast.length) return;
  const range = parseInt(btn.dataset.range, 10);
  if (range === chartRange) return;
  applyChartRange(range);
});

els.searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(
    () => searchPlaces(els.searchInput.value.trim()),
    300
  );
});

els.searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = els.searchInput.value.trim();
  if (!query) return;

  if (
    selectedPlace &&
    selectedPlace.name.toLowerCase() === query.toLowerCase()
  ) {
    loadWeather(selectedPlace);
    return;
  }

  try {
    await searchAndLoad(query);
  } catch (err) {
    showError(err.message);
  }
});

document.addEventListener("click", (e) => {
  if (
    !els.searchInput.contains(e.target) &&
    !els.suggestions.contains(e.target)
  ) {
    els.suggestions.hidden = true;
  }
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", async () => {
    try {
      await searchAndLoad(chip.dataset.city, true);
    } catch (err) {
      showError(err.message);
    }
  });
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

function refreshVigilanceMaps() {
  const ts = Date.now();
  els.vigilanceSection?.querySelectorAll(".js-vigilance-today").forEach((img) => {
    img.removeAttribute("hidden");
    img.alt = "Vigilance aujourd'hui";
    img.src = `/api/vigilance/thumbnail?day=today&_=${ts}`;
  });
  els.vigilanceSection?.querySelectorAll(".js-vigilance-tomorrow").forEach((img) => {
    img.removeAttribute("hidden");
    img.alt = "Vigilance demain";
    img.src = `/api/vigilance/thumbnail?day=tomorrow&_=${ts}`;
  });
}

initTheme();
updateRangeToggle();
renderFavorites();
initStations(els);
refreshVigilanceMaps();

const lastCity = getLastCity();
if (lastCity) {
  loadWeather(lastCity);
} else {
  showState("welcome");
}