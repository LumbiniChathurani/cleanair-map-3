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
  zoomControl: false,
  scrollWheelZoom: false,
  preferCanvas: true
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

map.whenReady(() => {
  loadAQIStations();
});

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

gnToggle.addEventListener("click", async () => {

  await loadGNLayer(); // 🔥 load file only when button clicked

  const active = map.hasLayer(populationLayer);

  if (active) {
    map.removeLayer(populationLayer);
    gnToggle.classList.remove("active");
  } else {
    populationLayer.addTo(map);
    gnToggle.classList.add("active");
  }

});

dsToggle.addEventListener("click", async () => {

  await loadDSLayer(); // 🔥 load file only when button clicked

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
async function loadAQIStations() {
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

      const marker = L.circleMarker(
        [st.lat, st.lon],
        {
          radius: 7,
          fillColor: getAQIColor(st.aqi),
          color: "#222",
          weight: 1,
          fillOpacity: 0.9
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
      marker.on("click", () => 
      focusStation(st));

 


      
    });
    /* ================= FAST SEARCH ================= */
const input = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");
let activeIndex = -1;

// Precompute lowercase names to speed up search
stations.forEach(s => s.lowerName = s.name.toLowerCase());

function updateSuggestions() {
  const query = input.value.toLowerCase();
  suggestions.innerHTML = "";
  activeIndex = -1;

  if (!query) {
    suggestions.style.display = "none";
    return;
  }

  // Filter stations starting with query and limit to top 10
  const matches = stations
    .filter(s => s.lowerName.startsWith(query))
    .slice(0, 10);

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
}

// Run instantly on every input
input.addEventListener("input", updateSuggestions);

// Keyboard navigation
input.addEventListener("keydown", e => {
  const items = suggestions.querySelectorAll("li");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    activeIndex = (activeIndex + 1) % items.length;
  } else if (e.key === "ArrowUp") {
    activeIndex = (activeIndex - 1 + items.length) % items.length;
  } else if (e.key === "Enter") {
    items[activeIndex]?.click();
  }

  items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
});
  })
  .catch(() => {
    alert("Failed to load AQI data.");
  });

}

     /* ================= FOCUS ================= */
     async function focusStation(st) {
      console.log("Station name:", st.name);
      console.log("Station ID:", st.stationId);
      console.log("Frontend stationId:", stationId);
      console.log("Station object:", st);
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
      stationId = `iqair_${st.stationId}`;
    } else if (st.source === "WAQI") {
      // MUST match Python exactly
      stationId = st.stationId || `waqi_${st.idx}`;
    } else {
      stationId = st.stationId;
    }
    
    
    
    let history = await loadStationHistory(stationId);

    // 🔥 fallback to old ID format (temporary support)
    /*if (history.length === 0 && st.source === "IQAir") {
      const fallbackId = `iqair_${st.name}`;
      console.log("Trying fallback ID:", fallbackId);
      history = await loadStationHistory(fallbackId);
    }*/
    
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

  let historyData = null;

  async function loadStationHistory(stationId) {

    // 🔥 Load only once
    if (!historyData) {
      const res = await fetch("data/history.json");
      historyData = await res.json();
    }
  
    const entries = historyData[stationId] || [];
  
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

  // ---------------------------
// LAZY LOAD GN LAYER
// ---------------------------
async function loadGNLayer() {

  if (populationLayer) return;

  // 🔥 Load population data only now
  if (Object.keys(populationData).length === 0) {
    const popRes = await fetch("data/population/population.json");
    populationData = await popRes.json();
  }

  const topoData = await fetch("data/boundaries/lka_admin4.json")
    .then(r => r.json());

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

      layer.bindPopup(`<b>${gn}</b><br>Population: ${pop}`);
    }
  });

}
// ---------------------------
// LAZY LOAD DS LAYER
// ---------------------------
async function loadDSLayer() {

  if (dsPopulationLayer) return;

  // 🔥 Load DS population only now
  if (Object.keys(dsPopulationData).length === 0) {

    const res = await fetch("data/population/DS_Division_Total_Population.json");
    const data = await res.json();

    data.forEach(row => {
      const key = row["DS-Division"].trim().toLowerCase();
      dsPopulationData[key] = Number(row["Total"]);
    });

  }

  const topoData = await fetch("data/boundaries/lka_admin3.json")
    .then(r => r.json());

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

}

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



const filterBtn = document.getElementById("filterBtn");
const filterPopup = document.getElementById("filterPopup");
const closeFilterPopup = document.getElementById("closeFilterPopup");

// Open popup
filterBtn.addEventListener("click", () => {
  filterPopup.style.display = "block";
});

// Close popup
closeFilterPopup.addEventListener("click", () => {
  filterPopup.style.display = "none";
});

// ---------------------------
// MOBILE FILTER POPUP LOGIC
// ---------------------------

const applyFiltersBtn = document.getElementById("applyFilters");


// Division Switches
const gnSwitch = document.getElementById("gnSwitch");
const dsSwitch = document.getElementById("dsSwitch");

// Sync initial state (SAFE)
if (populationLayer && map.hasLayer(populationLayer)) {
  gnSwitch.classList.add("active");
}

if (dsPopulationLayer && map.hasLayer(dsPopulationLayer)) {
  dsSwitch.classList.add("active");
}



gnSwitch.addEventListener("click", () => {
  gnSwitch.classList.toggle("active");
});

dsSwitch.addEventListener("click", () => {
  dsSwitch.classList.toggle("active");
});

// Apply button
applyFiltersBtn.addEventListener("click", async () => {

  // GN division
if (gnSwitch.classList.contains("active")) {

  await loadGNLayer();

  if (!map.hasLayer(populationLayer)) {
    populationLayer.addTo(map);
  }

  gnToggle.classList.add("active");

} else {

  if (populationLayer && map.hasLayer(populationLayer)) {
    map.removeLayer(populationLayer);
  }

  gnToggle.classList.remove("active");

}

// DS division
if (dsSwitch.classList.contains("active")) {

  await loadDSLayer();

  if (!map.hasLayer(dsPopulationLayer)) {
    dsPopulationLayer.addTo(map);
  }

  dsToggle.classList.add("active");

} else {

  if (dsPopulationLayer && map.hasLayer(dsPopulationLayer)) {
    map.removeLayer(dsPopulationLayer);
  }

  dsToggle.classList.remove("active");

}


  // Source filters
  purpleCheckbox.checked =
    document.getElementById("filter-purpleair-mobile").checked;

  iqairCheckbox.checked =
    document.getElementById("filter-iqair-mobile").checked;

  waqiCheckbox.checked =
    document.getElementById("filter-waqi-mobile").checked;

  allCheckbox.checked =
    purpleCheckbox.checked &&
    iqairCheckbox.checked &&
    waqiCheckbox.checked;

  updateSourceLayers();

  // Close popup after applying
  filterPopup.style.display = "none";
});