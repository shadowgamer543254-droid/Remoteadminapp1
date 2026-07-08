# Android APK Build Guide

## Prerequisites

### Option A: Android Studio (Recommended)
1. Download and install [Android Studio](https://developer.android.com/studio)
2. During setup, install:
   - Android SDK (API 34)
   - Android SDK Build-Tools
   - Android SDK Platform-Tools

### Option B: Command Line Only
1. Install JDK 17: `winget install Microsoft.OpenJDK.17` (Windows) or `brew install openjdk@17` (Mac)
2. Download Android command-line tools from https://developer.android.com/studio#command-line-tools-only
3. Set ANDROID_HOME environment variable

## Build Steps

### Using Android Studio (Easiest)

1. Open Android Studio
2. Click "Open an Existing Project"
3. Navigate to `RemoteAdminApp/android/` and select it
4. Wait for Gradle sync to complete (may take 5-10 minutes first time)
5. If prompted about SDK versions, click "Install" to accept
6. To build debug APK:
   - Menu: Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Output: `android/app/build/outputs/apk/debug/app-debug.apk`

7. To build signed release APK:
   - Menu: Build → Generate Signed Bundle / APK
   - Select "APK" → Next
   - Create or select a keystore (password: remember this!)
   - Set key alias and password
   - Select "release" build variant
   - Click "Create" if new keystore, then "OK"
   - Click "Finish"
   - Output: `android/app/build/outputs/apk/release/app-release.apk`

### Using Command Line

```bash
cd RemoteAdminApp/android

# Debug APK
./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk

# Release APK (unsigned)
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release-unsigned.apk
```

### Signing the Release APK

```bash
# Generate keystore (one-time)
keytool -genkey -v -keystore remoteadmin.keystore \
  -alias remoteadmin -keyalg RSA -keysize 2048 -validity 10000

# Align the APK
zipalign -v 4 app-release-unsigned.apk app-release-aligned.apk

# Sign the APK
apksigner sign --ks remoteadmin.keystore --ks-key-alias remoteadmin \
  --out app-release-signed.apk app-release-aligned.apk
```

## Installing on Device

### Via USB
1. Enable "Developer Options" on your phone (tap Build Number 7 times)
2. Enable "USB Debugging" in Developer Options
3. Connect phone via USB
4. Run: `adb install app-debug.apk`

### Via APK File
1. Copy `app-debug.apk` to your phone (via USB, email, or cloud storage)
2. On the phone, open the APK file
3. Allow "Install from Unknown Sources" if prompted
4. Tap "Install"

## After Installation

1. Open the RemoteAdmin app
2. Tap "CONTINUE" on the welcome screen
3. Grant all permissions when prompted
4. Enable the Accessibility Service when prompted
5. Enter the server URL (e.g., `http://YOUR-SERVER-IP:3001`)
6. Enter a device name
7. Tap "CONNECT & FINISH"
8. The app now runs in the background — you can close it
9. The device will appear in the admin panel website

## Production Configuration

Before building for production, update:

1. **Server URL**: Change from `http://your-server.com:3001` to your actual server address
2. **Admin Password**: Change `admin123` in `server/.env`
3. **JWT Secret**: Change the JWT secret in `server/.env`
4. **HTTPS**: For production, use HTTPS/WSS instead of HTTP/WS
