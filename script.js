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
  document.getElementById("themeToggle").innerHTML = '<i class="fa-solid fa-sun"></i>';
} else {
  lightTiles.addTo(map);
  document.getElementById("themeToggle").innerHTML = '<i class="fa-solid fa-moon"></i>';
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

    document.getElementById("themeToggle").innerHTML = '<i class="fa-solid fa-moon"></i>';
    localStorage.setItem("theme", "light");
  } else {
    // Switch to dark
    document.body.classList.add("dark-mode");

    map.removeLayer(lightTiles);
    darkTiles.addTo(map);

    document.getElementById("themeToggle").innerHTML = '<i class="fa-solid fa-sun"></i>';
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
      ).addTo(map).bindPopup(popupContent);
      
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
function focusStation(st) {
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

 