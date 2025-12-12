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

// ---------------------------
// CREATE MAP
// ---------------------------
const map = L.map("map").setView([7.8731, 80.7718], 8);

// Load tile based on saved theme
let savedTheme = localStorage.getItem("theme");

if (savedTheme === "dark") {
  darkTiles.addTo(map);
  document.body.classList.add("dark-mode");
  document.getElementById("themeToggle").textContent = "🔆";
} else {
  lightTiles.addTo(map);
  document.getElementById("themeToggle").textContent = "🌙";
}

// ---------------------------
// THEME TOGGLE BUTTON LOGIC
// ---------------------------
document.getElementById("themeToggle").addEventListener("click", () => {
  if (document.body.classList.contains("dark-mode")) {
    // Switch to light
    document.body.classList.remove("dark-mode");

    map.removeLayer(darkTiles);
    lightTiles.addTo(map);

    document.getElementById("themeToggle").textContent = "🌙";
    localStorage.setItem("theme", "light");
  } else {
    // Switch to dark
    document.body.classList.add("dark-mode");

    map.removeLayer(lightTiles);
    darkTiles.addTo(map);

    document.getElementById("themeToggle").textContent = "🔆";
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

      L.circleMarker([st.lat, st.lon], {
        radius: 8,
        fillColor: getAQIColor(st.aqi),
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9,
      })
        .addTo(map)
        .bindPopup(popupContent);
    });
  })
  .catch(() => {
    alert("Failed to load AQI data.");
  });
