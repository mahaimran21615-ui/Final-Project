// Skyline Weather - app.js
// API: Open-Meteo (https://open-meteo.com). No API key needed.
// Flow: city name -> geocoding API (lat/lon) -> forecast API (current weather) -> render.

// ---------- Constants ----------
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const STORAGE_KEY = "skyline-recent-cities";
const MAX_RECENT = 5;

// Open-Meteo returns a WMO weather code. This maps each code to text, an emoji icon and a page theme.
const WEATHER_CODES = {
  0:  { text: "Clear sky",                icon: "☀️", theme: "clear" },
  1:  { text: "Mainly clear",             icon: "🌤️", theme: "clear" },
  2:  { text: "Partly cloudy",            icon: "⛅", theme: "cloud" },
  3:  { text: "Overcast",                 icon: "☁️", theme: "cloud" },
  45: { text: "Fog",                      icon: "🌫️", theme: "cloud" },
  48: { text: "Freezing fog",             icon: "🌫️", theme: "cloud" },
  51: { text: "Light drizzle",            icon: "🌦️", theme: "rain" },
  53: { text: "Drizzle",                  icon: "🌦️", theme: "rain" },
  55: { text: "Heavy drizzle",            icon: "🌧️", theme: "rain" },
  56: { text: "Freezing drizzle",         icon: "🌧️", theme: "rain" },
  57: { text: "Heavy freezing drizzle",   icon: "🌧️", theme: "rain" },
  61: { text: "Light rain",               icon: "🌦️", theme: "rain" },
  63: { text: "Rain",                     icon: "🌧️", theme: "rain" },
  65: { text: "Heavy rain",               icon: "🌧️", theme: "rain" },
  66: { text: "Freezing rain",            icon: "🌧️", theme: "rain" },
  67: { text: "Heavy freezing rain",      icon: "🌧️", theme: "rain" },
  71: { text: "Light snow",               icon: "🌨️", theme: "snow" },
  73: { text: "Snow",                     icon: "❄️", theme: "snow" },
  75: { text: "Heavy snow",               icon: "❄️", theme: "snow" },
  77: { text: "Snow grains",              icon: "🌨️", theme: "snow" },
  80: { text: "Light rain showers",       icon: "🌦️", theme: "rain" },
  81: { text: "Rain showers",             icon: "🌧️", theme: "rain" },
  82: { text: "Violent rain showers",     icon: "🌧️", theme: "rain" },
  85: { text: "Light snow showers",       icon: "🌨️", theme: "snow" },
  86: { text: "Heavy snow showers",       icon: "🌨️", theme: "snow" },
  95: { text: "Thunderstorm",             icon: "⛈️", theme: "storm" },
  96: { text: "Thunderstorm with hail",   icon: "⛈️", theme: "storm" },
  99: { text: "Severe thunderstorm with hail", icon: "⛈️", theme: "storm" }
};

// ---------- DOM references ----------
const form = document.querySelector("#search-form");
const input = document.querySelector("#city-input");
const searchButton = form.querySelector("button[type='submit']");
const statusBox = document.querySelector("#status");
const statusText = statusBox.querySelector(".status-text");
const weatherSection = document.querySelector("#weather");
const unitButtons = document.querySelectorAll(".unit-btn");
const recentNav = document.querySelector("#recent");
const recentList = document.querySelector("#recent-list");

const els = {
  city: document.querySelector("#city-name"),
  region: document.querySelector("#region"),
  description: document.querySelector("#description"),
  icon: document.querySelector("#icon"),
  temp: document.querySelector("#temp"),
  tempUnit: document.querySelector("#temp-unit"),
  updated: document.querySelector("#updated"),
  feels: document.querySelector("#feels"),
  humidity: document.querySelector("#humidity"),
  wind: document.querySelector("#wind"),
  pressure: document.querySelector("#pressure")
};

// ---------- State ----------
let unit = "C";          // "C" or "F"
let lastWeather = null;  // latest result, kept in metric units so the toggle works without a new request

// ---------- Status helpers ----------
function showStatus(message, type = "info") {
  statusText.textContent = message;
  statusBox.className = "status";
  if (type === "error") statusBox.classList.add("is-error");
  if (type === "loading") statusBox.classList.add("is-loading");
}

function hideStatus() {
  statusBox.classList.add("is-hidden");
}

function setLoading(isLoading) {
  searchButton.disabled = isLoading;
  if (isLoading) showStatus("Loading weather…", "loading");
}

// ---------- Unit conversion ----------
function toDisplayTemp(celsius) {
  if (celsius === undefined || celsius === null) return null;
  return Math.round(unit === "C" ? celsius : (celsius * 9) / 5 + 32);
}

function formatValue(value, suffix) {
  // Handles missing properties gracefully
  return value === undefined || value === null ? "Not available" : `${value}${suffix}`;
}

// ---------- API calls ----------
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API_ERROR_${response.status}`);
  }
  return response.json();
}

async function getCoordinates(city) {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const data = await fetchJson(url);

  // If nothing matched, "results" is missing entirely
  if (!data.results || data.results.length === 0) {
    throw new Error("CITY_NOT_FOUND");
  }
  return data.results[0];
}

async function getCurrentWeather(latitude, longitude) {
  const fields = [
    "temperature_2m", "apparent_temperature", "relative_humidity_2m",
    "weather_code", "wind_speed_10m", "surface_pressure", "is_day"
  ].join(",");
  const url = `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
              `&current=${fields}&timezone=auto`;
  const data = await fetchJson(url);

  if (!data.current) throw new Error("NO_WEATHER_DATA");
  return data.current;
}

// ---------- Rendering ----------
function renderWeather() {
  if (!lastWeather) return;
  const { place, current } = lastWeather;

  const info = WEATHER_CODES[current.weather_code] ||
               { text: "Unknown conditions", icon: "🌡️", theme: "default" };
  const isNight = current.is_day === 0;
  const icon = isNight && current.weather_code <= 1 ? "🌙" : info.icon;

  const temp = toDisplayTemp(current.temperature_2m);
  const feels = toDisplayTemp(current.apparent_temperature);

  els.city.textContent = place.name;
  els.region.textContent = [place.admin1, place.country].filter(Boolean).join(", ");
  els.description.textContent = info.text;
  els.icon.textContent = icon;
  els.icon.setAttribute("aria-label", info.text);

  els.temp.textContent = temp === null ? "--" : temp;
  els.tempUnit.textContent = `°${unit}`;
  els.feels.textContent = feels === null ? "Not available" : `${feels}°${unit}`;
  els.humidity.textContent = formatValue(current.relative_humidity_2m, "%");
  els.wind.textContent = formatValue(
    current.wind_speed_10m === undefined ? undefined : Math.round(current.wind_speed_10m), " km/h"
  );
  els.pressure.textContent = formatValue(
    current.surface_pressure === undefined ? undefined : Math.round(current.surface_pressure), " hPa"
  );
  els.updated.textContent = current.time ? `Local time at this city: ${current.time.replace("T", " ")}` : "";

  document.body.dataset.theme = isNight ? "night" : info.theme;
  weatherSection.hidden = false;
  hideStatus();
}

// ---------- Recent searches (localStorage) ----------
function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecent(cityName) {
  const list = loadRecent().filter(c => c.toLowerCase() !== cityName.toLowerCase());
  list.unshift(cityName);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* storage may be blocked; the app still works */
  }
  renderRecent();
}

function renderRecent() {
  const list = loadRecent();
  recentList.innerHTML = "";
  recentNav.hidden = list.length === 0;

  list.forEach(city => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = city;
    btn.addEventListener("click", () => {
      input.value = city;
      searchCity(city);
    });
    li.appendChild(btn);
    recentList.appendChild(li);
  });
}

// ---------- Main search flow ----------
function friendlyError(error) {
  if (error.message === "CITY_NOT_FOUND") {
    return "We couldn't find that city. Check the spelling or try adding the country.";
  }
  if (error.message.startsWith("API_ERROR")) {
    return "The weather service had a problem. Please try again in a moment.";
  }
  if (error.message === "NO_WEATHER_DATA") {
    return "The weather service returned no data for this location. Try another city.";
  }
  // fetch() throws a TypeError when there is no connection
  return "Can't reach the weather service. Check your internet connection and try again.";
}

async function searchCity(city) {
  setLoading(true);
  weatherSection.hidden = true;

  try {
    const place = await getCoordinates(city);
    const current = await getCurrentWeather(place.latitude, place.longitude);
    lastWeather = { place, current };
    renderWeather();
    saveRecent(place.name);
  } catch (error) {
    showStatus(friendlyError(error), "error");
    console.warn("Weather lookup failed:", error.message);
  } finally {
    searchButton.disabled = false;  // loading state is always cleared
  }
}

// ---------- Events ----------
form.addEventListener("submit", event => {
  event.preventDefault();               // stop the page from reloading
  const city = input.value.trim();

  if (city === "") {
    weatherSection.hidden = true;
    showStatus("Enter a city name to search.", "error");
    input.focus();
    return;
  }
  searchCity(city);
});

unitButtons.forEach(button => {
  button.addEventListener("click", () => {
    unit = button.dataset.unit;
    unitButtons.forEach(b => {
      const active = b === button;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    renderWeather();
  });
});

// ---------- Start ----------
renderRecent();