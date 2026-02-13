# Map layers: Stations & hydrants

Edit `hydrants-stations.json` to show stations and hydrants on the alert map and the **closest 2** to the incident.

- **stations** – Fire stations (Maltese cross on map)
- **dryHydrants** – Dry hydrants (red fire hydrant icon)
- **countyHydrants** – County hydrants (blue fire hydrant icon)
- **privateHydrants** – Private hydrants (orange hydrant icon)

Each item: `id` (required), `name` (optional label), `lat`, `lon` (decimal degrees).

Example:

```json
{
  "stations": [
    { "id": "mvfd", "name": "Mangohick VFD", "lat": 37.8015866, "lon": -77.2585322 }
  ],
  "dryHydrants": [
    { "id": "dh1", "name": "Meadow Ln", "lat": 37.765, "lon": -77.14 }
  ],
  "countyHydrants": [
    { "id": "ch1", "name": "Rt 360", "lat": 37.77, "lon": -77.13 }
  ],
  "privateHydrants": [
    { "id": "ph1", "name": "Meadow Ln", "lat": 37.76, "lon": -77.12 }
  ]
}
```

After editing, rebuild the frontend (or refresh the kiosk). The map will show all points and a “Closest 2 to incident” panel when an alert has a location.
