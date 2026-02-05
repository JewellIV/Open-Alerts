# Project Specification: OpenAlerts (Free Edition)

## 1. Project Overview
A self-hosted, zero-cost Fire Station Alerting System.
**Goal:** Detect dispatch triggers, display incidents on a station dashboard, play audio alerts, and send mobile notifications using 100% free tools.

## 2. Tech Stack (The "Free" Tier)
* **Runtime:** Node.js (v18+)
* **Backend:** Express.js
* **Frontend:** React (Vite) + Tailwind CSS
* **Database:** SQLite (Local file-based DB, no cloud costs).
* **Real-time:** Socket.io.
* **Maps (Free):** `React-Leaflet` using OpenStreetMap (OSM) tiles.
* **Geocoding (Free):** Nominatim API (OpenStreetMap) for converting addresses to coordinates.
* **Audio (Free):** Web Speech API (`window.speechSynthesis`) running natively in the browser.
* **Mobile Alerts (Free):** Discord Webhooks (pushes alerts to a private department server).

## 3. Data Flow
1.  **Ingest:** A `POST` request hits `/api/alert` (simulating a TwoToneDetect webhook).
2.  **Process:** Server saves to SQLite, formats the message, and posts to Discord.
3.  **Broadcast:** Server emits `socket.io` event to the Dashboard Client.
4.  **Display:** Dashboard wakes up, plays TTS audio, and plots the map location.

## 4. Implementation Phases

### Phase 1: The Local Backend
1.  Initialize a standard Express app with TypeScript.
2.  Set up **SQLite** using `better-sqlite3`.
3.  Create the `alerts` table:
    * `id` (integer, PK)
    * `timestamp` (datetime)
    * `call_type` (string)
    * `address` (string)
    * `units` (string)
    * `narrative` (text)
4.  Create the ingestion endpoint `POST /api/alert`.
5.  **Test:** Use `curl` or Postman to send a fake JSON payload and ensure it saves to the DB.

### Phase 2: The "Offline" Dashboard
1.  Initialize React + Vite.
2.  Create a "Status Board" layout (Dark Mode default).
3.  **Idle Screen:** Display a large digital clock and date.
4.  **Active Screen:** Create a visually distinct "Alert Mode" (Red flashing borders, large text).
5.  Integrate **Socket.io-client**.
6.  **Logic:** When the socket receives `dispatch_alert`, switch from Idle to Active screen.

### Phase 3: Free Mapping (Leaflet)
1.  Install `react-leaflet` and `leaflet`.
2.  Create a `MapComponent` that takes an `address` prop.
3.  **Geocoding Utility:** Create a helper function that fetches coordinates from Nominatim:
    * Endpoint: `https://nominatim.openstreetmap.org/search?q={address}&format=json`
    * **Important:** Add a `User-Agent` header to the request (required by Nominatim terms of use).
4.  Render the map with a marker at the returned coordinates.

### Phase 4: Free Audio (Browser TTS)
1.  **No Server Audio:** We will move audio generation to the *client* (the browser) to avoid API costs.
2.  Create a `SpeechManager` utility in React.
3.  Use `const synth = window.speechSynthesis;`.
4.  On Alert:
    * Construct text: "Attention Station. [Call Type]. [Address]. [Units]."
    * Create `new SpeechSynthesisUtterance(text)`.
    * Set volume to 1.0, rate to 0.9 (slightly slower for clarity).
    * Call `synth.speak(utterance)`.
5.  **Browser Policy Fix:** Add a "Start System" button on the dashboard that the user must click once to unlock "Auto-Play" permissions in Chrome.

### Phase 5: Free Mobile Alerts (Discord)
1.  Create a `DiscordService` in the backend.
2.  Logic: When `POST /api/alert` is successful, send the data to a Discord Webhook URL (store URL in `.env`).
3.  Format: Use a Discord "Embed" with Red color for fire, Blue for EMS.

## 5. Development Rules for AI
* **Do not** suggest paid APIs (Google Maps, AWS).
* **Do not** overcomplicate the folder structure. Keep it simple for a local station PC.
* **Error Handling:** If Nominatim geocoding fails, strictly default the map to the Station's home coordinates (store in config).