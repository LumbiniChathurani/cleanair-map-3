// ---------------------------
// LIGHT & DARK TILE LAYERS
// ---------------------------
const lightTiles = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 18,
  }
);

const darkTiles = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  {
    maxZoom: 18,
  }
);

let populationLayer = null;

let dsPopulationLayer = null;
let dsPopulationData = {};



// ---------------------------
// CREATE MAP
// ---------------------------
const map = L.map("map", {
  zoomControl: false
}).setView([7.8731, 80.7718], 7);

// ---------------------------
// AQI SOURCE LAYERS
// ---------------------------
const purpleAirLayer = L.layerGroup().addTo(map);
const iqAirLayer = L.layerGroup().addTo(map);
const waqiLayer = L.layerGroup().addTo(map);


L.control.zoom({
  position: "topright"
}).addTo(map);

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
    div.innerHTML +=
      `<div>
        <i style="background:${getAQIColor(grades[i])}"></i>
        ${labels[i]}
      </div>`;
  }

  return div;
};

legend.addTo(map);



// Load tile based on saved theme
let savedTheme = localStorage.getItem("theme");

if (savedTheme === "dark") {
  darkTiles.addTo(map);
  document.body.classList.add("dark-mode");
  document.getElementById("themeToggle").innerHTML = '🔆';
} else {
  lightTiles.addTo(map);
  document.getElementById("themeToggle").innerHTML = '🌙';
}


const gnToggle = document.getElementById("gnToggle");
const dsToggle = document.getElementById("dsToggle");

gnToggle.addEventListener("click", () => {
  if (!populationLayer) return;

  const active = map.hasLayer(populationLayer);

  if (active) {
    map.removeLayer(populationLayer);
    gnToggle.classList.remove("active");
  } else {
    populationLayer.addTo(map);
    gnToggle.classList.add("active");
  }
});

dsToggle.addEventListener("click", () => {
  if (!dsPopulationLayer) return;

  const active = map.hasLayer(dsPopulationLayer);

  if (active) {
    map.removeLayer(dsPopulationLayer);
    dsToggle.classList.remove("active");
  } else {
    dsPopulationLayer.addTo(map);
    dsToggle.classList.add("active");
  }
});


// ---------------------------
// THEME TOGGLE BUTTON LOGIC
// ---------------------------
document.getElementById("themeToggle").addEventListener("click", () => {
  if (document.body.classList.contains("dark-mode")) {
    // Switch to light
    document.body.classList.remove("dark-mode");

    map.removeLayer(darkTiles);
    lightTiles.addTo(map);

    document.getElementById("themeToggle").innerHTML = '🌙';
    localStorage.setItem("theme", "light");
  } else {
    // Switch to dark
    document.body.classList.add("dark-mode");

    map.removeLayer(lightTiles);
    darkTiles.addTo(map);

    document.getElementById("themeToggle").innerHTML = '🔆';
    localStorage.setItem("theme", "dark");
  }
});

// ---------------------------
// AQI COLOR FUNCTION
// ---------------------------
function getAQIColor(aqi) {
  if (aqi <= 50) return "#009966"; // Good
  if (aqi <= 100) return "#ffde33"; // Moderate
  if (aqi <= 150) return "#ff9933"; // Unhealthy for SG
  if (aqi <= 200) return "#cc0033"; // Unhealthy
  if (aqi <= 300) return "#660099"; // Very Unhealthy
  return "#7e0023"; // Hazardous
}

function createAQISvgIcon(color) {
  return L.divIcon({
    className: "aqi-svg-marker",
    html: `
      <svg width="18" height="26" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M15 0C7 0 0 7 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 7 23 0 15 0z"
          fill="${color}"
        />
        <circle cx="15" cy="15" r="6" fill="white"/>
      </svg>
    `,
    iconSize: [18, 26],
    iconAnchor: [9, 26],   // bottom center
    popupAnchor: [0, -22],
  });
}


// ---------------------------
// LOAD AQI JSON FILE
// ---------------------------
fetch("./aq_stations.json")
  .then((res) => res.json())
  .then((stations) => {
    stations.forEach((st) => {
      const popupContent = `
        <b>${st.name}</b><br>
        Source: ${st.source}<br>
        AQI: <b>${st.aqi}</b><br>
        Category: ${st.category}<br>
      `;

      const marker = L.marker(
        [st.lat, st.lon],
        {
          icon: createAQISvgIcon(getAQIColor(st.aqi)),
        }
      ).bindPopup(popupContent);

      
      
      // ---------------------------
      // Add marker to correct layer
      // ---------------------------
      if (st.source === "PurpleAir") {
        marker.addTo(purpleAirLayer);
      } else if (st.source === "IQAir") {
        marker.addTo(iqAirLayer);
      } else if (st.source === "WAQI") {
        marker.addTo(waqiLayer);
      }
      

      st.marker = marker; 

      // 🔧 Ensure stationId exists for WAQI
if (st.source === "WAQI" && !st.stationId && st.idx) {
  st.stationId = `waqi_${st.idx}`;
}

      
      // Glow pulse on click
      marker.on("click", () => {
        const el = marker.getElement();
        if (!el) return;
      
        el.classList.remove("aqi-glow");
        void el.offsetWidth; // restart animation
        el.classList.add("aqi-glow");
      });
      marker.on("click", () => focusStation(st));

      /* ================= FOCUS ================= */
async function focusStation(st) {
  map.setView([st.lat, st.lon], 13);

  const el = st.marker.getElement();
  if (el) {
    el.classList.remove("glow");
    void el.offsetWidth;
    el.classList.add("glow");
  }

  // --------------------
  // Update AQI details
  // --------------------
  document.getElementById("stationName").textContent = st.name;
  document.getElementById("stationAqi").textContent = st.aqi;
  document.getElementById("stationCategory").textContent = st.category;
  document.getElementById("stationSource").textContent = st.source;

  document.getElementById("sidebar").classList.add("open");

  // --------------------
  // Build stationId SAME as backend and load history
  // --------------------
  let stationId;

if (st.source === "IQAir") {
  stationId = `iqair_${st.name}`;
} else if (st.source === "WAQI") {
  // MUST match Python exactly
  stationId = st.stationId || `waqi_${st.idx}`;
} else {
  stationId = st.stationId;
}



  const history = await loadStationHistory(stationId);

  // --------------------
  // Last Updated
  // --------------------
  const lastUpdatedEl = document.getElementById("stationLastUpdated");
  if (history.length > 0) {
    const lastTime = history[history.length - 1].time;
    lastUpdatedEl.textContent = new Date(lastTime).toLocaleString(); // shows local date & time
  } else {
    lastUpdatedEl.textContent = "N/A";
  }

  // --------------------
  // 🔥 NEW: Load chart
  // --------------------
  const chartContainer = document.querySelector(".aqi-chart-container");

  if (history.length < 3) {
    chartContainer.innerHTML = "<p>No historical data yet</p>";
    return;
  }

  // restore canvas if removed
  chartContainer.innerHTML = `<canvas id="aqiChart"></canvas>`;
  drawAQIChart(history);
}

      

/* ================= SEARCH ================= */
const input = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");
let activeIndex = -1;

input.addEventListener("input", () => {
  const query = input.value.toLowerCase();
  suggestions.innerHTML = "";
  activeIndex = -1;

  if (!query) {
    suggestions.style.display = "none";
    return;
  }

  const matches = stations.filter(s =>
    s.name.toLowerCase().includes(query)
  );

  matches.forEach(st => {
    const li = document.createElement("li");
    li.textContent = st.name;
    li.onclick = () => {
      focusStation(st);
      suggestions.style.display = "none";
    };
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

  items.forEach((el, i) =>
    el.classList.toggle("active", i === activeIndex)
  );
});
      
    });
  })
  .catch(() => {
    alert("Failed to load AQI data.");
  });

  async function loadStationHistory(stationId) {
    const res = await fetch("data/history.json");
    const history = await res.json();
  
    const entries = history[stationId] || [];
  
    // sort by time
    entries.sort((a, b) => new Date(a.time) - new Date(b.time));
  
    // last 7 days (168 hours)
    return entries.slice(-168);
  }

  let aqiChart = null;

function drawAQIChart(entries) {
  const ctx = document.getElementById("aqiChart").getContext("2d");

  if (aqiChart) {
    aqiChart.destroy();
  }

  const labels = entries.map(e =>
    new Date(e.time).toLocaleString([], { hour: "2-digit", day: "numeric" })
  );

  const data = entries.map(e => e.aqi);

  aqiChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "AQI (last 7 days)",
          data,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 300
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `AQI: ${ctx.raw}`
          }
        }
      }
    }
  });
}

// ---------------------------
// SIDEBAR CLOSE HANDLING
// ---------------------------
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeSidebar");

closeBtn.addEventListener("click", (e) => {
  e.stopPropagation();            // 🔥 prevents map click
  sidebar.classList.remove("open");
});

// Prevent sidebar clicks from touching map
sidebar.addEventListener("click", (e) => {
  e.stopPropagation();
});


//Population data
let populationData = {};

fetch("data/population/population.json")
  .then(r => r.json())
  .then(data => {
    populationData = data;
  });

  fetch("data/population/DS_Division_Total_Population.json")
  .then(r => r.json())
  .then(data => {
  data.forEach(row => {
  const key = row["DS-Division"]
  .trim()
  .toLowerCase();
  
  
  dsPopulationData[key] = Number(row["Total"]);
  });
  
  
  console.log("DS population lookup:", dsPopulationData);
  });

  function getColor(pop) {
    if (pop > 3000) return "#800026";
    if (pop > 2000) return "#BD0026";
    if (pop > 1000) return "#E31A1C";
    return "#FED976";
  }

  function getDSColor(pop) {
    if (pop > 150000) return "#08306b";
    if (pop > 100000) return "#2171b5";
    if (pop > 50000)  return "#6baed6";
    if (pop > 20000)  return "#bdd7e7";
    return "#eff3ff";
  }

  fetch("data/boundaries/lka_admin4.json")
  .then(r => r.json())
  .then(topoData => {

    // 🔁 Convert TopoJSON → GeoJSON
    const geojson = topojson.feature(
      topoData,
      topoData.objects.lka_admin4
    );

    populationLayer = L.geoJSON(geojson, {
      style: feature => {
        const gn = feature.properties.adm4_name;
        const pop = populationData[gn] || 0;

        return {
          fillColor: getColor(pop),
          weight: 1,
          color: "#555",
          fillOpacity: 0.6
        };
      },
      onEachFeature: (feature, layer) => {
        const gn = feature.properties.adm4_name;
        const pop = populationData[gn] || "No data";

        layer.bindPopup(
          `<b>${gn}</b><br>Population: ${pop}`
        );
      }
    })
  });

  fetch("data/boundaries/lka_admin3.json")
  .then(r => r.json())
  .then(topoData => {

    const geojson = topojson.feature(
      topoData,
      topoData.objects.lka_admin3
    );

    dsPopulationLayer = L.geoJSON(geojson, {
      style: feature => {
        const ds = feature.properties.adm3_name
  .trim()
  .toLowerCase();
        const pop = dsPopulationData[ds] || 0;

        return {
          fillColor: getDSColor(pop),
          weight: 1.5,
          color: "#003366",
          fillOpacity: 0.5
        };
      },
      onEachFeature: (feature, layer) => {
        const ds = feature.properties.adm3_name
          .trim()
          .toLowerCase();
      
        const pop = dsPopulationData[ds];
      
        layer.bindPopup(
          `<b>${feature.properties.adm3_name} DS Division</b><br>
           Population: ${pop ?? "No data"}`
        );
      }
    });

  });

  // ---------------------------
// SOURCE FILTER CHECKBOXES
// ---------------------------
const allCheckbox = document.getElementById("filter-all");
const purpleCheckbox = document.getElementById("filter-purpleair");
const iqairCheckbox = document.getElementById("filter-iqair");
const waqiCheckbox = document.getElementById("filter-waqi");

function updateSourceLayers() {
  map.removeLayer(purpleAirLayer);
  map.removeLayer(iqAirLayer);
  map.removeLayer(waqiLayer);

  if (allCheckbox.checked) {
    purpleAirLayer.addTo(map);
    iqAirLayer.addTo(map);
    waqiLayer.addTo(map);
    return;
  }

  if (purpleCheckbox.checked) purpleAirLayer.addTo(map);
  if (iqairCheckbox.checked) iqAirLayer.addTo(map);
  if (waqiCheckbox.checked) waqiLayer.addTo(map);
}

// ALL checkbox
allCheckbox.addEventListener("change", () => {
  const checked = allCheckbox.checked;
  purpleCheckbox.checked = checked;
  iqairCheckbox.checked = checked;
  waqiCheckbox.checked = checked;
  updateSourceLayers();
});

// Individual checkboxes
[purpleCheckbox, iqairCheckbox, waqiCheckbox].forEach(cb => {
  cb.addEventListener("change", () => {
    allCheckbox.checked =
      purpleCheckbox.checked &&
      iqairCheckbox.checked &&
      waqiCheckbox.checked;
    updateSourceLayers();
  });
});

const DEFAULT_CENTER = [7.8731, 80.7718]; // same as your map init
const DEFAULT_ZOOM = 7;

document.getElementById("refreshBtn").addEventListener("click", () => {

  
  // 1️⃣ Close sidebar
  /*const sidebar = document.getElementById("sidebar");
  sidebar.classList.remove("open");*/

  // 2️⃣ Reset map zoom and center
  map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  // 3️⃣ Optional: remove glow from any markers
  document.querySelectorAll(".aqi-glow").forEach(el => {
   // el.classList.remove("aqi-glow");
   el.classList.add("glow");
  });

  
});