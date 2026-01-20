import json
import time
import requests
import os

# -------------------------------------------------------------
# Directories
# -------------------------------------------------------------
os.makedirs("data", exist_ok=True)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
PURPLEAIR_BUFFER_FILE = os.path.join(DATA_DIR, "purpleair_buffer.json")

# -------------------------------------------------------------
# API Keys
# -------------------------------------------------------------
def require_key(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} not set in environment")
    return value

# -------------------------------------------------------------
# Retry Wrapper
# -------------------------------------------------------------
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
# Utility functions
# -------------------------------------------------------------
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
    if len(entries) > max_hours:
        return entries[-max_hours:]
    return entries

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

# -------------------------------------------------------------
# PurpleAir Logic
# -------------------------------------------------------------
PURPLEAIR_STATIONS = [
    {"id": 12451, "name": "FECT Akurana", "lat": 7.718, "lon": 80.633},
    {"id": 157599, "name": "Gregory's Road", "lat": 6.927, "lon": 79.861},
]

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
            if len(values) >= 4:
                avg_aqi = round(sum(values) / len(values))
                append_hourly_aqi(station_id=station_id, aqi=avg_aqi, source="purpleair", timestamp=hour)
            else:
                updated_buffer.setdefault(station_id, {})[hour] = values
    save_buffer(updated_buffer)

def get_realtime_aqi_purpleair(sensorid):
    api_key = require_key("PURPLEAIR_API_KEY")
    url = f"https://api.purpleair.com/v1/sensors/{sensorid}?fields=name,pm2.5_10minute"
    headers = {"X-API-Key": api_key}
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
        "source": "purpleair",
        "name": data["sensor"]["name"],
        "pm25_10min": pm25,
        "aqi": aqi,
        "category": get_aqi_category(aqi)
    }

def fetch_all_purpleair():
    results = []
    buffer = load_buffer()
    for s in PURPLEAIR_STATIONS:
        try:
            data = get_realtime_aqi_purpleair(s["id"])
            data["lat"] = s["lat"]
            data["lon"] = s["lon"]
            hour = current_hour_timestamp()
            station_id = f"purpleair_{s['id']}"
            buffer.setdefault(station_id, {}).setdefault(hour, []).append(data["aqi"])
            data["stationId"] = station_id
            results.append(data)
        except Exception as e:
            print(f"[ERROR] PurpleAir {s['name']}: {e}")
    save_buffer(buffer)
    flush_purpleair_hourly()
    return results

# -------------------------------------------------------------
# IQAir Logic
# -------------------------------------------------------------
IQAIR_CITIES = [
    {"city": "Colombo", "lat": 6.9271, "lon": 79.8612},
    {"city": "Battaramulla", "lat": 6.8990, "lon": 79.9230},
    {"city": "Gampaha", "lat": 7.0860, "lon": 79.9990},
    {"city": "Digana", "lat": 7.2970, "lon": 80.7600},
    {"city": "Anuradhapura", "lat": 8.3114, "lon": 80.4037},
    {"city": "Jaffna", "lat": 9.6615, "lon": 80.0255},
    {"city": "Batticaloa", "lat": 7.7170, "lon": 81.7000},
    {"city": "Galle", "lat": 6.0535, "lon": 80.2210},
    {"city": "Kurunegala", "lat": 7.4867, "lon": 80.3647},
    {"city": "Ratnapura", "lat": 6.6828, "lon": 80.3992},
    {"city": "Bandarawela", "lat": 6.8289, "lon": 80.9870}
]

def get_realtime_aqi_iqair(city, lat, lon):
    api_key = require_key("IQAIR_API_KEY")
    url = f"https://api.airvisual.com/v2/nearest_city?lat={lat}&lon={lon}&key={api_key}"
    response = safe_request(url)
    data = response.json()
    if data.get("status") != "success":
        raise ValueError(f"IQAir API error: {data}")
    pollution = data["data"]["current"]["pollution"]
    return {
        "source": "iqair",
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
            append_hourly_aqi(station_id=f"iqair_{c['city']}", aqi=data["aqi"], source="iqair", timestamp=current_hour_timestamp())
            results.append(data)
        except Exception as e:
            print(f"[ERROR] IQAir {c['city']}: {e}")
    return results

# -------------------------------------------------------------
# WAQI Logic (NEW)
# -------------------------------------------------------------
WAQI_STATIONS = [
    {"city": "Colombo US Embassy", "lat": 6.913047, "lon": 79.84807, "idx": 9571, "name": "Colombo US Embassy"},
    {"city": "Kilinochchi", "lat": 9.38333, "lon": 80.41333, "idx": "A581482", "name": "Kilinochchi"},
    {"city": "Galle", "lat": 6.0535, "lon": 80.2210, "idx": "A562177", "name": "Galle – Karapitiya"},
    {"city": "Jaffna (Chunnakam)", "lat": 9.6667, "lon": 80.0167, "idx": "A???", "name": "Jaffna – Chunnakam"},
    {"city": "Matara", "lat": 5.9487, "lon": 80.5355, "idx": "A???", "name": "Matara"},
    {"city": "Anuradhapura", "lat": 8.3114, "lon": 80.4037, "idx": "A???", "name": "Anuradhapura"},
]


def get_realtime_aqi_waqi(station):
    token = require_key("WAQI_API_KEY")
    url = f"https://api.waqi.info/feed/geo:{station['lat']};{station['lon']}/?token={token}"
    response = safe_request(url)
    data = response.json()
    if data.get("status") != "ok":
        raise ValueError(f"WAQI API error: {data}")
    aqi = data["data"]["aqi"]
    return {
        "source": "waqi",
        "name": station["name"],
        "aqi": aqi,
        "category": get_aqi_category(aqi),
        "lat": station["lat"],
        "lon": station["lon"],
        "stationId": f"waqi_{station['idx']}"
    }

def fetch_all_waqi():
    results = []
    for s in WAQI_STATIONS:
        try:
            results.append(get_realtime_aqi_waqi(s))
        except Exception as e:
            print(f"[ERROR] WAQI {s['name']}: {e}")
    return results

# -------------------------------------------------------------
# Save JSON
# -------------------------------------------------------------
def save_to_json(new_data, filename="aq_stations.json"):
    try:
        with open(filename, "r") as f:
            existing_data = json.load(f)
    except FileNotFoundError:
        existing_data = []

    combined = {}
    for item in existing_data:
        key = (item["source"], item["name"])
        combined[key] = item

    for item in new_data:
        key = (item["source"], item["name"])
        combined[key] = item

    with open(filename, "w") as f:
        json.dump(list(combined.values()), f, indent=4)

    print(f"[OK] Saved {len(combined)} stations to {filename}")

# -------------------------------------------------------------
# Main
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
