# Run OpenAlerts on a Windows 10 PC (firehouse)

Use a **Windows 10 PC at the station** as the main OpenAlerts server when the Raspberry Pi is overloaded. The Pi stays on the network for **displays** and **GPIO relays** only.

```
Windows 10 PC (always on)              Raspberry Pis
┌──────────────────────────┐           ┌─────────────────────────────┐
│ OpenAlerts backend :3000 │           │ Kiosk browser → PC:3000     │
│ SQLite (alerts.db)       │  LAN      │ room-gpio-service :4000     │
│ Admin / CAD webhooks     │◄─────────►│ Relays, amp, radio, LEDs    │
└──────────────────────────┘           └─────────────────────────────┘
```

## What moves vs what stays

| Runs on the Windows 10 PC | Stays on each Raspberry Pi |
| --- | --- |
| Main backend (`npm start` / `start-openalerts.bat`) | Kiosk browser pointed at the PC |
| Database (`alerts.db`) | `room-gpio-service` on port 4000 |
| Serving the dashboard to every display | Speaker / amp / radio relays |
| Discord, Slack, Resgrid, TwoToneDetect POSTs | LED rings (if wired to that Pi) |

Do **not** copy `node_modules` from the Pi. Install on Windows with `npm install` so native modules (`better-sqlite3`) match Windows.

## 1. Prepare the PC

1. Give the PC a **static LAN IP** (Control Panel → Network → IPv4 → Use the following address). Write it down, e.g. `192.168.1.50`.
2. Optional but easiest cutover: **reuse the Pi’s old IP** on this PC, then give the Pi a new IP. Displays and CAD webhooks keep working without URL changes.
3. Install **[Node.js 22 LTS](https://nodejs.org/)** (Windows Installer). Leave **Add to PATH** checked.
4. Confirm in a **new** Command Prompt:
   ```bat
   node -v
   npm -v
   ```
5. Copy the OpenAlerts folder onto the PC (Git clone, USB, or network share), e.g. `C:\OpenAlerts`.

## 2. Install and build

In Command Prompt or PowerShell:

```bat
cd C:\OpenAlerts
npm install
cd frontend
npm install
npm run build
cd ..
npm run build
```

`onoff` is Raspberry Pi GPIO only. On Windows it is optional and may print a warning during `npm install`. That is expected.

If `better-sqlite3` fails to install, install **Visual Studio Build Tools** with the “Desktop development with C++” workload, then run `npm install` again.

## 3. Configure `.env`

Copy `.env.example` to `.env` in the project root (or copy `.env` from the Pi). Then add GPIO proxies so this PC can still mute room relays:

```env
PORT=3000
API_KEY=your-secret-api-key-here
ADMIN_PASSWORD=your-admin-password

# Each room Pi running room-gpio-service:
ROOM_GPIO_URLS=mens_bunk:http://192.168.68.140:4000,engine_bay:http://192.168.68.141:4000

# Pi that still has amplifier / radio relays (GPIO 18 / 23):
AMPLIFIER_GPIO_URL=http://192.168.68.141:4000
RADIO_GPIO_PIN=23
```

Replace room IDs and Pi IPs with the station’s real values. Keep Discord / Slack / Resgrid settings the same as on the Pi.

Copy `alerts.db` from the Pi into this folder so history, units, rooms, and notices carry over. Stop the Pi backend **before** copying so the file is not mid-write.

## 4. Open the firewall

PowerShell **as Administrator**:

```powershell
powershell -ExecutionPolicy Bypass -File C:\OpenAlerts\scripts\windows\open-firewall.ps1
```

Or manually: Windows Defender Firewall → Inbound rule → TCP port **3000**.

## 5. Start the server

**Manual (first test):** double-click `start-openalerts.bat` in `C:\OpenAlerts`.

Then on this PC open:

```
http://localhost:3000/health
```

You should see `"status":"ok"` and `"platform":"win32"`.

From another device on the station LAN:

```
http://192.168.1.50:3000/health
```

(Use the PC’s real IP.)

**Auto-start at boot** (PowerShell as Administrator):

```powershell
powershell -ExecutionPolicy Bypass -File C:\OpenAlerts\scripts\windows\install-service.ps1
Start-ScheduledTask -TaskName OpenAlerts
```

Logs: `C:\OpenAlerts\logs\openalerts.log`

To remove auto-start:

```powershell
powershell -ExecutionPolicy Bypass -File C:\OpenAlerts\scripts\windows\uninstall-service.ps1
```

Keep the station user logged in (or set Windows auto-logon) so the task can keep the server running.

## 6. Stop the heavy process on the Pi

On the old backend Pi:

```bash
pm2 stop mvfd-backend
pm2 delete mvfd-backend
pm2 save
```

Leave **kiosk Chromium** and **room-gpio-service** running:

```bash
sudo systemctl enable --now room-gpio-service
sudo systemctl status room-gpio-service
```

Each display Pi’s browser should open the **Windows PC**, not localhost on the Pi:

```
http://192.168.1.50:3000
http://192.168.1.50:3000/#room
http://192.168.1.50:3000/#station
```

If kiosk autostart still points at the Pi, edit `~/.config/autostart/kiosk.desktop` (or the kiosk systemd unit) and reboot that Pi.

## 7. Point CAD / TwoToneDetect at the PC

If TwoToneDetect already runs on this Windows PC, `scripts/twotonedetect-alert.ps1` can keep:

```powershell
$serverUrl = "http://localhost:3000"
```

If TwoToneDetect or a CAD webhook still targets the Pi IP, change it to the Windows PC IP (unless you reused the Pi’s IP in step 1).

Send a test alert:

```powershell
powershell -ExecutionPolicy Bypass -File C:\OpenAlerts\test-alert.ps1
```

Confirm the main display, room displays, and room speakers all fire.

## 8. Keep the Pi from overloading

On each Pi, do **not** run the full Node backend. Only:

1. `room-gpio-service` (small, port 4000)
2. Chromium kiosk to `http://WINDOWS_PC_IP:3000`

If a Pi still feels slow, disable the old PM2 backend and any extra desktop apps. Wired Ethernet is more reliable than Wi‑Fi for both the PC and the display Pis.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Displays cannot connect | Firewall port 3000; PC and Pis on the same LAN; `ipconfig` on the PC |
| Relays never click | `room-gpio-service` running on that Pi; `ROOM_GPIO_URLS` uses that Pi’s IP; room IDs match admin |
| Radio/amp mute does nothing | Set `AMPLIFIER_GPIO_URL` to the engine-bay Pi GPIO service |
| `npm install` mentions `onoff` / `epoll` | Ignore on Windows. GPIO is on the Pi. |
| Server dies after reboot | Run `install-service.ps1`; confirm the station user auto-logs on; read `logs\openalerts.log` |
| Two backends fighting | Only **one** OpenAlerts backend should listen on 3000. Stop PM2 on the Pi. |
| Lost alerts after move | Copy `alerts.db` from the Pi before starting Windows, then do not start both at once |

## Related docs

- [Raspberry Pi Setup](RASPBERRY_PI_SETUP.md) — OS, kiosk, and GPIO on the Pi
- [Room GPIO service](room-gpio-service/README.md) — per-room relay process
- [Multi-display](MULTI_DISPLAY_SETUP.md) — pointing browsers at the backend
- [Installation Guide](INSTALLATION_GUIDE.md) — full station install
