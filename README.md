🌍 CleanAir Sri Lanka – Real-Time Air Quality Map


An interactive web application that visualizes real-time Air Quality Index (AQI) data across Sri Lanka. The map combines data from multiple air quality providers and displays live AQI values through an intuitive, interactive interface.
To overcome the request limitations of free APIs, the application uses GitHub Actions workflows to periodically fetch air quality data and cache it in JSON files, providing fast page loads while staying within API usage limits.


________________________________________

✨ Features

🌍 Interactive Air Quality Map

•	Displays real-time AQI values for monitoring stations across Sri Lanka.

•	Interactive Leaflet.js map with zoom and pan support.

•	Responsive design for desktop and mobile devices.

<img width="400" height="350" alt="map1" src="https://github.com/user-attachments/assets/b8d27660-cf70-4aa4-be50-ea3c5d10113f" />
 
📡 Multiple Air Quality Data Sources

The application collects AQI data from:

•	IQAir API

•	PurpleAir API

•	World Air Quality Index (WAQI) API

Users can filter stations by data source using built-in source selection checkboxes.

________________________________________

⚡ Smart Data Fetching Architecture

Free API plans have strict request limits. Instead of requesting data every time a user opens the website, this project uses scheduled GitHub Actions workflows.

GitHub Workflows

Three independent workflows automatically fetch data from:

•	IQAir

•	PurpleAir

•	WAQI

These workflows run at scheduled intervals and update local JSON files used by the website.

Secure API Management

API credentials are securely stored using GitHub Secrets.

•	IQAir API Key

•	PurpleAir API Key

•	WAQI Access Token

This keeps sensitive credentials out of the source code.

________________________________________

📁 Data Storage

Two primary JSON files are used.

aq_stations.json

Stores:

•	Current AQI

•	Station information

•	Latest update time

This file is refreshed whenever a scheduled workflow runs.

history.json

Stores historical AQI values.

•	Previous readings are automatically moved here.

•	Stores hourly data for the previous 7 days.

•	Older records are automatically removed after seven days.

This lightweight approach avoids using a backend database while maintaining recent historical data.

________________________________________

📍 Interactive Station Markers

Each monitoring station is represented by a colored marker.
Marker colors automatically change according to the current AQI category.
Inactive stations are displayed using grey markers.

Clicking a station opens:

Popup

Displays:

•	Station name

•	Current AQI

Sidebar

Displays:

•	Station name

•	Current AQI

•	Last updated time

•	Interactive 7-day hourly AQI history chart

 <img width="400" height="350" alt="map3" src="https://github.com/user-attachments/assets/7640406d-b29f-4685-9e87-df38713efcad" />

________________________________________

🗺 Additional Map Layers

The application includes multiple optional layers.

Administrative Population Layers

•	GN Division Population Layer

•	DS Division Population Layer

These layers use compressed TopoJSON files to improve loading performance.
Users can enable or disable each layer using map controls.

<img width="800" height="350" alt="map6" src="https://github.com/user-attachments/assets/1e89d7ab-9efd-4218-90c1-e0f477ebdd7a" />
  
________________________________________

🎨 User Interface Features

•	Light Mode / Dark Mode

•	AQI Color Scale Legend

•	Reset View button

•	Responsive layout

•	Interactive side panel

•	Source filtering controls

________________________________________

📊 Real-Time AQ Information Widget

Along with the map, the project includes a real-time dashboard widget powered by aq_stations.json.

The widget displays:

•	🌿 Cleanest AQI station

•	⚠️ Highest AQI station

•	📍 Number of online monitoring stations

•	🌤 Current location weather information

<img width="1398" height="350" alt="aqwidget" src="https://github.com/user-attachments/assets/bef3731f-7f29-4c61-bef2-e42a5a9f0bc3" />

 
Selecting the widget opens a detailed page listing every monitoring station and its current AQI.

<img width="1902" height="913" alt="aqwidget2" src="https://github.com/user-attachments/assets/40104b7e-84fe-4810-b9e7-f391055bb529" />

 
Both the map and the widget are integrated into the CleanAir.lk homepage.
________________________________________

⚙️ Performance Optimizations

Several optimizations were implemented to improve loading speed.

•	Lazy loading of large JSON datasets

•	Compressed TopoJSON layers

•	Client-side caching through scheduled data generation

•	Optimized Leaflet rendering

•	Reduced API requests by serving cached data

Performance was evaluated using GTmetrix.

________________________________________


🛠 Technologies Used

•	Python

•	HTML5

•	CSS3

•	JavaScript

•	Leaflet.js

•	GitHub Actions

•	GitHub Pages

•	TopoJSON

•	Chart.js

•	IQAir API

•	PurpleAir API

•	WAQI API
________________________________________


🚀 Running the Project


Clone the repository:
git clone https://github.com/LumbiniChathurani/cleanair-map-3.git
Navigate into the project:
cd cleanair-map-3
Open index.html using a local web server (recommended) or deploy to GitHub Pages.

________________________________________

<img width="232" height="433" alt="repostructure" src="https://github.com/user-attachments/assets/4ac25451-35bc-44b1-aa21-429d3afbdb69" />


________________________________________

🌐 Deployment

The project is deployed using GitHub Pages.
It is also integrated into the CleanAir.lk homepage to provide visitors with real-time air quality information.

<img width="433" height="465" alt="architecture" src="https://github.com/user-attachments/assets/2d6fff23-14db-4fc6-93e0-ed1dbc336e24" />

 
________________________________________

Future Improvements

•	Air quality forecasting

•	Additional environmental data layers

•	Historical trend comparisons

•	Station search and filtering

•	Push notifications for unhealthy AQI levels


