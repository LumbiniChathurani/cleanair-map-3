// ---------------------------
// LIGHT & DARK TILE LAYERS
// ---------------------------
const lightTiles = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { maxZoom: 18 }
);

const darkTiles = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  { maxZoom: 18 }
);

// ---------------------------
// CREATE MAP
// ---------------------------
const map = L.map("map", { zoomControl: false }).setView([7.8731, 80.7718], 8);

L.control.zoom({ position: "topright" }).addTo(map);

// ---------------------------
// AQI LEGEND (BOTTOM RIGHT)
// ---------------------------
const legend = L.control({ position: "bottomright" });
legend.onAdd = function () {
  const div = L.DomUtil.create("div", "aqi-legend");
  const grades = [0, 51, 101, 151, 201, 301];
  const labels = [
    "Good (0–50)",
    "Moderate (51–100)",
    "Unhealthy for SG (101–150)",
    "Unhealthy (151–200)",
    "Very Unhealthy (201–300)",
    "Hazardous (300+)"
  ];
  div.innerHTML = "<h4>AQI Scale</h4>";
  for (let i = 0; i < grades.length; i++) {
    div.innerHTML += `<div><i style="background:${getAQIColor(grades[i])}"></i>${labels[i]}</div>`;
  }
  return div;
};
legend.addTo(map);

// ---------------------------
// LOAD TILE BASED ON THEME
// ---------------------------
let savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  darkTiles.addTo(map);
  document.body.classList.add("dark-mode");
  document.getElementById("themeToggle").innerHTML = '<i class="fa-solid fa-sun"></i>';
} else {
  lightTiles.addTo(map);
  document.getElementById("themeToggle").innerHTML = '<i class="fa-solid fa-moon"></i>';
}

// ---------------------------
// THEME TOGGLE BUTTON
// ---------------------------
document.getElementById("themeToggle").addEventListener("click", () => {
  if (document.body.classList.contains("dark-mode")) {
    document.body.classList.remove("dark-mode");
    map.removeLayer(darkTiles);
    lightTiles.addTo(map);
    document.getElementById("themeToggle").innerHTML = '<i class="fa-solid fa-moon"></i>';
    localStorage.setItem("theme", "light");
  } else {
    document.body.classList.add("dark-mode");
    map.removeLayer(lightTiles);
    darkTiles.addTo(map);
    document.getElementById("themeToggle").innerHTML = '<i class="fa-solid fa-sun"></i>';
    localStorage.setItem("theme", "dark");
  }
});

// ---------------------------
// AQI COLOR FUNCTIONS
// ---------------------------
function getAQIColor(aqi) {
  if (aqi <= 50) return "#009966";   // Good
  if (aqi <= 100) return "#ffde33";  // Moderate
  if (aqi <= 150) return "#ff9933";  // Unhealthy for SG
  if (aqi <= 200) return "#cc0033";  // Unhealthy
  if (aqi <= 300) return "#660099";  // Very Unhealthy
  return "#7e0023";                  // Hazardous
}

function createAQISvgIcon(color) {
  return L.divIcon({
    className: "aqi-svg-marker",
    html: `
      <svg width="18" height="26" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C7 0 0 7 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 7 23 0 15 0z" fill="${color}" />
        <circle cx="15" cy="15" r="6" fill="white"/>
      </svg>
    `,
    iconSize: [18, 26],
    iconAnchor: [9, 26],
    popupAnchor: [0, -22],
  });
}

// ---------------------------
// LOAD AQI JSON FILE
// ---------------------------
fetch("./aq_stations.json")
  .then(res => res.json())
  .then(stations => {
    stations.forEach(st => {
      const popupContent = `
        <b>${st.name}</b><br>
        Source: ${st.source}<br>
        AQI: <b>${st.aqi}</b><br>
        Category: ${st.category}<br>
      `;

      const marker = L.marker([st.lat, st.lon], { icon: createAQISvgIcon(getAQIColor(st.aqi)) })
        .addTo(map)
        .bindPopup(popupContent);

      st.marker = marker;

      marker.on("click", () => {
        const el = marker.getElement();
        if (!el) return;
        el.classList.remove("aqi-glow");
        void el.offsetWidth;
        el.classList.add("aqi-glow");
      });
      marker.on("click", () => focusStation(st));

      async function focusStation(st) {
        map.setView([st.lat, st.lon], 13);
        const el = st.marker.getElement();
        if (el) {
          el.classList.remove("glow");
          void el.offsetWidth;
          el.classList.add("glow");
        }

        document.getElementById("stationName").textContent = st.name;
        document.getElementById("stationAqi").textContent = st.aqi;
        document.getElementById("stationCategory").textContent = st.category;
        document.getElementById("stationSource").textContent = st.source;
        document.getElementById("sidebar").classList.add("open");

        const stationId = st.source === "IQAir"
          ? `iqair_${st.name}`
          : st.source === "WAQI"
            ? `waqi_${st.idx}`
            : st.stationId; // PurpleAir

        const history = await loadStationHistory(stationId);

        const lastUpdatedEl = document.getElementById("stationLastUpdated");
        lastUpdatedEl.textContent = history.length > 0 ? new Date(history[history.length - 1].time).toLocaleString() : "N/A";

        const chartContainer = document.querySelector(".aqi-chart-container");
        if (history.length < 3) {
          chartContainer.innerHTML = "<p>No historical data yet</p>";
          return;
        }

        chartContainer.innerHTML = `<canvas id="aqiChart"></canvas>`;
        drawAQIChart(history);
      }
    });
  })
  .catch(() => alert("Failed to load AQI data."));

// ---------------------------
// SEARCH FUNCTIONALITY
// ---------------------------
const input = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");
let activeIndex = -1;

input.addEventListener("input", () => {
  const query = input.value.toLowerCase();
  suggestions.innerHTML = "";
  activeIndex = -1;
  if (!query) { suggestions.style.display = "none"; return; }

  const matches = stations.filter(s => s.name.toLowerCase().includes(query));
  matches.forEach(st => {
    const li = document.createElement("li");
    li.textContent = st.name;
    li.onclick = () => { focusStation(st); suggestions.style.display = "none"; };
    suggestions.appendChild(li);
  });
  suggestions.style.display = matches.length ? "block" : "none";
});

input.addEventListener("keydown", e => {
  const items = suggestions.querySelectorAll("li");
  if (!items.length) return;
  if (e.key === "ArrowDown") activeIndex = (activeIndex + 1) % items.length;
  if (e.key === "ArrowUp") activeIndex = (activeIndex - 1 + items.length) % items.length;
  if (e.key === "Enter") items[activeIndex]?.click();
  items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
});

// ---------------------------
// HISTORY CHART
// ---------------------------
let aqiChart = null;
function drawAQIChart(entries) {
  const ctx = document.getElementById("aqiChart").getContext("2d");
  if (aqiChart) aqiChart.destroy();

  const labels = entries.map(e => new Date(e.time).toLocaleString([], { hour: "2-digit", day: "numeric" }));
  const data = entries.map(e => e.aqi);

  aqiChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: "AQI (last 7 days)", data, borderWidth: 2, tension: 0.3, pointRadius: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 300 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `AQI: ${ctx.raw}` } } } }
  });
}

// ---------------------------
// SIDEBAR CLOSE
// ---------------------------
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeSidebar");
closeBtn.addEventListener("click", e => { e.stopPropagation(); sidebar.classList.remove("open"); });
sidebar.addEventListener("click", e => e.stopPropagation());

// ---------------------------
// POPULATION LAYER
// ---------------------------
let populationData = {};
fetch("data/population/population.json").then(r => r.json()).then(data => { populationData = data; });

function getColor(pop) {
  if (pop > 3000) return "#800026";
  if (pop > 2000) return "#BD0026";
  if (pop > 1000) return "#E31A1C";
  return "#FED976";
}

fetch("data/boundaries/lka_admin4.json")
  .then(r => r.json())
  .then(topoData => {
    const geojson = topojson.feature(topoData, topoData.objects.lka_admin4);
    L.geoJSON(geojson, {
      style: feature => {
        const gn = feature.properties.adm4_name;
        const pop = populationData[gn] || 0;
        return { fillColor: getColor(pop), weight: 1, color: "#555", fillOpacity: 0.6 };
      },
      onEachFeature: (feature, layer) => {
        const gn = feature.properties.adm4_name;
        const pop = populationData[gn] || "No data";
        layer.bindPopup(`<b>${gn}</b><br>Population: ${pop}`);
      }
    }).addTo(map);
  });



 
  