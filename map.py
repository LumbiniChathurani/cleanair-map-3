import json
import time
import requests

# -------------------------------------------------------------
# API KEYS
# -------------------------------------------------------------
#PURPLEAIR_API_KEY = "30417898-B7AF-11F0-BDE5-4201AC1DC121"
#IQAIR_API_KEY = "b50f8e17-d19d-42b1-a087-0d5ad5434d71"

# -------------------------------------------------------------
# RETRY WRAPPER
# -------------------------------------------------------------
def safe_request(url, headers=None, max_attempts=5):
    delay = 1
    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.get(url, headers=headers, timeout=10)

            if response.status_code == 429:
                print(f"[RATE LIMIT] Waiting {delay}s (attempt {attempt}/{max_attempts})")
                time.sleep(delay)
                delay = min(delay * 2, 10)
                continue

            return response

        except requests.exceptions.RequestException as e:
            print(f"[NETWORK ERROR] {e} | retrying in {delay}s...")
            time.sleep(delay)
            delay = min(delay * 2, 10)

    raise Exception("Max retries reached for: " + url)

# -------------------------------------------------------------
# PurpleAir Stations
# -------------------------------------------------------------
PURPLEAIR_STATIONS = [
    {"id": 12451, "name": "FECT Akurana", "lat": 7.718, "lon": 80.633},
    {"id": 157599, "name": "Gregory's Road", "lat": 6.927, "lon": 79.861},
]

# -------------------------------------------------------------
# IQAir Cities
# -------------------------------------------------------------
IQAIR_CITIES = [
    {"city": "Battaramulla", "lat": 6.899, "lon": 79.923},
    {"city": "Colombo", "lat": 6.927, "lon": 79.861},
    {"city": "Gampaha", "lat": 7.086, "lon": 79.999},
    {"city": "Negombo", "lat": 7.208, "lon": 79.835},
    {"city": "Nugegoda", "lat": 6.852, "lon": 79.901},
    # Add other cities as needed
]

# -------------------------------------------------------------
# AQI Conversion (PurpleAir only)
# -------------------------------------------------------------
def pm25_to_aqi(pm25):
    breakpoints = [
        (0.0, 12.0, 0, 50),
        (12.1, 35.4, 51, 100),
        (35.5, 55.4, 101, 150),
        (55.5, 150.4, 151, 200),
        (150.5, 250.4, 201, 300),
        (250.5, 500.4, 301, 500),
    ]
    for c_low, c_high, i_low, i_high in breakpoints:
        if c_low <= pm25 <= c_high:
            return round(((i_high - i_low) / (c_high - c_low)) * (pm25 - c_low) + i_low)
    return None

def get_aqi_category(aqi):
    if aqi <= 50: return "Good"
    if aqi <= 100: return "Moderate"
    if aqi <= 150: return "Unhealthy for Sensitive Groups"
    if aqi <= 200: return "Unhealthy"
    if aqi <= 300: return "Very Unhealthy"
    return "Hazardous"

# -------------------------------------------------------------
# FETCH PURPLEAIR
# -------------------------------------------------------------
def get_realtime_aqi_purpleair(sensorid):
    url = f"https://api.purpleair.com/v1/sensors/{sensorid}?fields=name,pm2.5_10minute"
    headers = {"X-API-Key": PURPLEAIR_API_KEY}
    response = safe_request(url, headers=headers)
    data = response.json()
    if "sensor" not in data:
        raise ValueError("PurpleAir: 'sensor' missing")
    stats = data["sensor"].get("stats", {})
    pm25 = stats.get("pm2.5_10minute")
    if pm25 is None:
        raise ValueError("PurpleAir: pm2.5_10minute not found in stats")
    aqi = pm25_to_aqi(pm25)
    return {
        "source": "PurpleAir",
        "name": data["sensor"]["name"],
        "pm25_10min": pm25,
        "aqi": aqi,
        "category": get_aqi_category(aqi)
    }

def fetch_all_purpleair():
    results = []
    for s in PURPLEAIR_STATIONS:
        try:
            data = get_realtime_aqi_purpleair(s["id"])
            data["lat"] = s["lat"]
            data["lon"] = s["lon"]
            results.append(data)
        except Exception as e:
            print(f"[ERROR] PurpleAir {s['name']}: {e}")
    return results

# -------------------------------------------------------------
# FETCH IQAIR
# -------------------------------------------------------------
def get_realtime_aqi_iqair(city, lat, lon):
    url = f"https://api.airvisual.com/v2/nearest_city?lat={lat}&lon={lon}&key={IQAIR_API_KEY}"
    response = safe_request(url)
    data = response.json()
    if data.get("status") != "success":
        raise ValueError(f"IQAir API error: {data}")
    pollution = data["data"]["current"]["pollution"]
    return {
        "source": "IQAir",
        "name": city,
        "nearest_station": data["data"]["city"],
        "aqi": pollution["aqius"],
        "category": get_aqi_category(pollution["aqius"]),
        "timestamp": pollution["ts"],
        "main_pollutant": pollution["mainus"]
    }

def fetch_all_iqair():
    results = []
    for c in IQAIR_CITIES:
        try:
            data = get_realtime_aqi_iqair(c["city"], c["lat"], c["lon"])
            data["lat"] = c["lat"]
            data["lon"] = c["lon"]
            results.append(data)
        except Exception as e:
            print(f"[ERROR] IQAir {c['city']}: {e}")
    return results

# -------------------------------------------------------------
# SAVE JSON FILE
# -------------------------------------------------------------
def save_to_json(data, filename="aq_stations.json"):
    with open(filename, "w") as f:
        json.dump(data, f, indent=4)
    print(f"[OK] Saved {len(data)} stations to {filename}")

# -------------------------------------------------------------
# MAIN RUN
# -------------------------------------------------------------
if __name__ == "__main__":
    import sys

    mode = sys.argv[1] if len(sys.argv) > 1 else "all"

    if mode == "purpleair":
        all_data = fetch_all_purpleair()
    elif mode == "iqair":
        all_data = fetch_all_iqair()
    else:
        all_data = fetch_all_purpleair() + fetch_all_iqair()

    save_to_json(all_data)
