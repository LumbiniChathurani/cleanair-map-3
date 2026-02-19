import json
import time
import requests
import os

# -------------------------------------------------------------
# CREATE DATA FOLDER
# -------------------------------------------------------------
os.makedirs("data", exist_ok=True)
print("Current working directory:", os.getcwd())
print("Files:", os.listdir("."))
print("Data folder exists:", os.path.exists("data"))

# -------------------------------------------------------------
# API KEYS
# -------------------------------------------------------------
def require_key(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} not set in environment")
    return value

# -------------------------------------------------------------
# RETRY WRAPPER
# -------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
PURPLEAIR_BUFFER_FILE = os.path.join(DATA_DIR, "purpleair_buffer.json")

def load_history():
    try:
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def save_history(history):
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)

def trim_old_entries(entries, max_hours=168):
    return entries[-max_hours:] if len(entries) > max_hours else entries

def append_hourly_aqi(station_id, aqi, source, timestamp):
    history = load_history()
    if station_id not in history:
        history[station_id] = []
    if not any(e["time"] == timestamp and e["source"] == source for e in history[station_id]):
        history[station_id].append({
            "time": timestamp,
            "aqi": aqi,
            "source": source
        })
    history[station_id] = trim_old_entries(history[station_id])
    save_history(history)

def current_hour_timestamp():
    return time.strftime("%Y-%m-%dT%H:00:00Z", time.gmtime())

def load_buffer():
    try:
        with open(PURPLEAIR_BUFFER_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def save_buffer(buffer):
    with open(PURPLEAIR_BUFFER_FILE, "w") as f:
        json.dump(buffer, f, indent=2)

def flush_purpleair_hourly():
    buffer = load_buffer()
    updated_buffer = {}
    for station_id, hours in buffer.items():
        for hour, values in hours.items():
            if len(values) >= 1:
                avg_aqi = round(sum(values) / len(values))
                append_hourly_aqi(station_id=station_id, aqi=avg_aqi, source="purpleair", timestamp=hour)
            else:
                updated_buffer.setdefault(station_id, {})[hour] = values
    save_buffer(updated_buffer)

def safe_request(url, headers=None, max_attempts=5):
    delay = 1.6
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
    # Western Province
    {"city": "Colombo", "lat": 6.9271, "lon": 79.8612},
    {"city": "Battaramulla", "lat": 6.8990, "lon": 79.9230},
    {"city": "Gampaha", "lat": 7.0860, "lon": 79.9990},

    # Central Province
    {"city": "Digana", "lat": 7.2970, "lon": 80.7600},

    # North Central Province
    {"city": "Anuradhapura", "lat": 8.3114, "lon": 80.4037},

    # Northern Province
    {"city": "Jaffna", "lat": 9.6615, "lon": 80.0255},

    # Eastern Province
    {"city": "Batticaloa", "lat": 7.7170, "lon": 81.7000},

    # Southern Province
    {"city": "Galle", "lat": 6.0535, "lon": 80.2210},

    # North Western Province
    {"city": "Kurunegala", "lat": 7.4867, "lon": 80.3647},

    # Sabaragamuwa Province
    {"city": "Ratnapura", "lat": 6.6828, "lon": 80.3992},

    # Uva Province
    {"city": "Bandarawela", "lat": 6.8289, "lon": 80.9870}
]

# -------------------------------------------------------------
# AQI Helpers
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
    if aqi is None:
        return "N/A"
    if aqi <= 50: return "Good"
    if aqi <= 100: return "Moderate"
    if aqi <= 150: return "Unhealthy for Sensitive Groups"
    if aqi <= 200: return "Unhealthy"
    if aqi <= 300: return "Very Unhealthy"
    return "Hazardous"

# -------------------------------------------------------------
# Fetch PurpleAir
# -------------------------------------------------------------
def get_realtime_aqi_purpleair(sensorid):
    api_key = require_key("PURPLEAIR_API_KEY")
    url = f"https://api.purpleair.com/v1/sensors/{sensorid}?fields=name,pm2.5_10minute"
    headers = {"X-API-Key": api_key}
    response = safe_request(url, headers=headers)
    data = response.json()
    stats = data["sensor"]["stats"]
    pm25 = stats["pm2.5_10minute"]
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
    buffer = load_buffer()
    for s in PURPLEAIR_STATIONS:
        data = get_realtime_aqi_purpleair(s["id"])
        data["lat"] = s["lat"]
        data["lon"] = s["lon"]
        hour = current_hour_timestamp()
        station_id = f"purpleair_{s['id']}"
        buffer.setdefault(station_id, {}).setdefault(hour, []).append(data["aqi"])
        data["stationId"] = station_id
        results.append(data)
    save_buffer(buffer)
    flush_purpleair_hourly()
    return results

# -------------------------------------------------------------
# Fetch IQAir
# -------------------------------------------------------------
def get_realtime_aqi_iqair(city, lat, lon):
    api_key = require_key("IQAIR_API_KEY")
    url = f"https://api.airvisual.com/v2/nearest_city?lat={lat}&lon={lon}&key={api_key}"
    response = safe_request(url)
    data = response.json()
    if data.get("status") != "success":
        raise ValueError(f"IQAir API error: {data}")
    pollution = data["data"]["current"]["pollution"]

    station_id = f"iqair_{city.lower().replace(' ', '_')}_{lat:.4f}_{lon:.4f}"

    return {
        "stationId": station_id,
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

            # ✅ APPEND IQAIR HOURLY AQI TO HISTORY
            append_hourly_aqi(
                station_id=f"iqair_{c['city']}",
                aqi=data["aqi"],
                source="iqair",
                timestamp=current_hour_timestamp()
            )

            results.append(data)
        except Exception as e:
            print(f"[ERROR] IQAir {c['city']}: {e}")
    return results


# -------------------------------------------------------------
# Fetch WAQI
# -------------------------------------------------------------
def get_waqi_stations_in_bounds():
    token = require_key("WAQI_TOKEN")
    bounds = "9.866040,79.425659,5.845545,82.001953"  # Sri Lanka
    url = f"https://api.waqi.info/map/bounds/?latlng={bounds}&networks=all&token={token}"

    response = safe_request(url)
    payload = response.json()

    if payload.get("status") != "ok":
        return []

    stations = []
    for s in payload["data"]:
        stations.append({
            "idx": s["uid"],
            "name": s.get("station", {}).get("name", "Unknown"),
            "lat": s["lat"],
            "lon": s["lon"],
        })

    return stations


def get_realtime_aqi_waqi(station):
    token = require_key("WAQI_TOKEN")
    url = f"https://api.waqi.info/feed/@{station['idx']}/?token={token}"
    response = safe_request(url)
    payload = response.json()

    aqi_value = None
    pm25 = None

    if payload.get("status") == "ok":
        data = payload.get("data", {})

        raw_aqi = data.get("aqi")
        if isinstance(raw_aqi, int):
            aqi_value = raw_aqi
        else:
            pm25 = data.get("iaqi", {}).get("pm25", {}).get("v")
            if isinstance(pm25, (int, float)):
                aqi_value = pm25_to_aqi(pm25)

    if aqi_value is None:
        print(f"[WAQI INFO] {station['name']} has no valid AQI")

    return {
        "source": "WAQI",
        "name": station["name"],
        "aqi": aqi_value,
        "pm25": pm25,
        "category": get_aqi_category(aqi_value),
        "lat": station["lat"],
        "lon": station["lon"],
        "stationId": f"waqi_{station['idx']}"
    }


def fetch_all_waqi():
    results = []
    stations = get_waqi_stations_in_bounds()

    for s in stations:
        data = get_realtime_aqi_waqi(s)

        if data["aqi"] is not None:
            append_hourly_aqi(
                station_id=data["stationId"],
                aqi=data["aqi"],
                source="waqi",
                timestamp=current_hour_timestamp()
            )
            results.append(data)

        time.sleep(0.2)  # prevent WAQI rate limiting

    return results


# -------------------------------------------------------------
# Save to JSON
# -------------------------------------------------------------
def save_to_json(new_data, filename="aq_stations.json"):
    try:
        with open(filename, "r") as f:
            existing_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        existing_data = []

    combined = {}
    for item in existing_data:
        if "stationId" in item:
            combined[item["stationId"]] = item
    for item in new_data:
        if not isinstance(item, dict):
           continue
        if "stationId" not in item:
            print("[SKIPPED] Missing stationId:", item)
            continue
        combined[item["stationId"]] = item


    with open(filename, "w") as f:
        json.dump(list(combined.values()), f, indent=4)

# -------------------------------------------------------------
# MAIN
# -------------------------------------------------------------
if __name__ == "__main__":
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"

    if mode == "purpleair":
        all_data = fetch_all_purpleair()
    elif mode == "iqair":
        all_data = fetch_all_iqair()
    elif mode == "waqi":
        all_data = fetch_all_waqi()
    else:
        all_data = fetch_all_purpleair() + fetch_all_iqair() + fetch_all_waqi()

    save_to_json(all_data)
