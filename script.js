// ---------------------------
// Leaflet base map
// ---------------------------
const map = L.map("map").setView([7.8731, 80.7718], 8); // Sri Lanka center

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
}).addTo(map);

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
fetch("/aq_stations.json")
  .then((res) => res.json())
  .then((stations) => {
    stations.forEach((st) => {
      // Popup content
      const popupContent = `
                <b>${st.name}</b><br>
                Source: ${st.source}<br>
                AQI: <b>${st.aqi}</b><br>
                Category: ${st.category}<br>
            `;

      // Marker
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
