const KEYS = {
  theme: "mf_theme",
  favorites: "mf_favorites",
  stationFavorites: "mf_station_favorites",
  lastCity: "mf_last_city",
  lastWeather: "mf_last_weather",
  chartRange: "mf_chart_range",
};

export function getTheme() {
  return localStorage.getItem(KEYS.theme) || "dark";
}

export function setTheme(theme) {
  localStorage.setItem(KEYS.theme, theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.favorites) || "[]");
  } catch {
    return [];
  }
}

export function saveFavorite(place) {
  const favs = getFavorites().filter(
    (f) => !(f.lat === place.lat && f.lon === place.lon)
  );
  favs.unshift({
    name: place.name,
    lat: place.lat,
    lon: place.lon,
    dept: place.dept || "",
  });
  localStorage.setItem(KEYS.favorites, JSON.stringify(favs.slice(0, 8)));
}

export function removeFavorite(place) {
  const favs = getFavorites().filter(
    (f) => !(f.lat === place.lat && f.lon === place.lon)
  );
  localStorage.setItem(KEYS.favorites, JSON.stringify(favs));
}

export function isFavorite(place) {
  return getFavorites().some(
    (f) => f.lat === place.lat && f.lon === place.lon
  );
}

export function getStationFavorites() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.stationFavorites) || "[]");
  } catch {
    return [];
  }
}

export function saveStationFavorite(station) {
  const id = String(station.id).padStart(8, "0");
  const favs = getStationFavorites().filter((f) => f.id !== id);
  favs.unshift({
    id,
    name: station.name,
    department: station.department || "",
    lat: station.lat,
    lon: station.lon,
  });
  localStorage.setItem(
    KEYS.stationFavorites,
    JSON.stringify(favs.slice(0, 8))
  );
}

export function removeStationFavorite(id) {
  const normalizedId = String(id).padStart(8, "0");
  const favs = getStationFavorites().filter((f) => f.id !== normalizedId);
  localStorage.setItem(KEYS.stationFavorites, JSON.stringify(favs));
}

export function isStationFavorite(id) {
  const normalizedId = String(id).padStart(8, "0");
  return getStationFavorites().some((f) => f.id === normalizedId);
}

export function saveLastCity(place) {
  localStorage.setItem(KEYS.lastCity, JSON.stringify(place));
}

export function getLastCity() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.lastCity));
  } catch {
    return null;
  }
}

export function saveLastWeather(data) {
  localStorage.setItem(
    KEYS.lastWeather,
    JSON.stringify({ savedAt: Date.now(), data })
  );
}

export function getLastWeather() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.lastWeather));
  } catch {
    return null;
  }
}

export function getChartRange() {
  const value = parseInt(localStorage.getItem(KEYS.chartRange), 10);
  return value === 48 ? 48 : 24;
}

export function setChartRange(range) {
  localStorage.setItem(KEYS.chartRange, String(range === 48 ? 48 : 24));
}