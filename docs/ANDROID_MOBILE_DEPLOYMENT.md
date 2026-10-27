# Xerova CRDMS — Android Mobile Application Deployment Guide

This document provides complete instructions for installing, configuring, testing, updating, and maintaining the **Xerova Crime Record and Data Management System (CRDMS)** Android mobile application (`.apk`).

---

## 1. System Architecture & Packaging Strategy

### Architecture Model
The Android distribution uses a **Capacitor Mobile Hybrid Shell Architecture**:
1. **Presentation Layer (React 19 + TypeScript + Vite + Tailwind CSS)**:
   - Reuses 100% of the proven CRDMS frontend business logic, RBAC checks, modals, dashboards, and responsive styling.
   - Compiled with relative asset links into `dist/` and packaged into native Android assets (`android/app/src/main/assets/public/`).
   - Runs in a secure, sandboxed Android WebView with modern JavaScript APIs.
2. **Native Runtime Bridge (Capacitor 8 + Android SDK 36)**:
   - Wraps the application into a native Android APK (`com.xerova.crdms`).
   - Manages native hardware permissions (Camera, Media Images, Network State).
   - Handles network security policies and file provider integrations.
3. **Backend Node Connection**:
   - The APK acts as a thin client connecting to the enterprise FastAPI backend via secure HTTPS (or intranet IP/loopback during development).
   - **Zero Secrets Policy**: No database passwords, JWT secrets, or administrative credentials are embedded inside the APK.
   - **Dynamic Server Configuration**: Officers or technicians can adjust their backend server URL directly from the login screen settings panel or via `localStorage` (`crms_api_base_url`).

---

## 2. Generated Android Build Artifacts

Both Release and Debug APKs have been assembled, cryptographically signed, and staged in the project's distribution directory:

| Build Deliverable | Exact Output Path | Size | SHA256 Checksum |
| :--- | :--- | :--- | :--- |
| **Signed Release APK** | `dist-android/xerova-crdms-release-1.0.0.apk` | ~3.61 MB | `A6C081726AEE3F36E2F37E095588F4DF7570BBFD9EDFF55B8BBFC8FF2ACE8C08` |
| **Debug APK** | `dist-android/xerova-crdms-debug-1.0.0.apk` | ~4.65 MB | `2F64A87E879DFC218A131D87BD928AAED7084CD7B70AA434DC75E01049F94ADF` |

*(Internal Gradle outputs: `android/app/build/outputs/apk/release/app-release.apk` and `android/app/build/outputs/apk/debug/app-debug.apk`)*

---

## 3. Package Identity & Manifest Metadata

Verified via Android Asset Packaging Tool (`aapt2 dump badging`):

- **Application ID / Package Name**: `com.xerova.crdms`
- **Application Label**: `Xerova CRDMS`
- **Version Code**: `1`
- **Version Name**: `1.0`
- **Minimum SDK Version**: `24` (Android 7.0 Nougat)
- **Target SDK Version**: `36` (Android 16)
- **Compile SDK Version**: `36`
- **Launchable Activity**: `com.xerova.crdms.MainActivity`
- **Brand Icons**: Multi-density launcher icons in `mipmap-mdpi` (48x48), `mipmap-hdpi` (72x72), `mipmap-xhdpi` (96x96), `mipmap-xxhdpi` (144x144), and `mipmap-xxxhdpi` (192x192).

---

## 4. Hardware Permissions & Security Profile

The application declares strictly necessary permissions in `android/app/src/main/AndroidManifest.xml`:

| Permission | Purpose |
| :--- | :--- |
| `android.permission.INTERNET` | Communicates with the secure CRDMS REST API endpoints. |
| `android.permission.ACCESS_NETWORK_STATE` | Detects offline/online states and triggers transient network retry behavior. |
| `android.permission.CAMERA` | Allows capturing live field photos of suspects or physical evidence. *(Marked optional `uses-feature android:required="false"` so devices without rear cameras can still operate).* |
| `android.permission.READ_MEDIA_IMAGES` | Allows selecting criminal mugshots or crime-scene documents on Android 13+ (API 33+). |
| `android.permission.READ_EXTERNAL_STORAGE` | Backward-compatibility storage access for Android 12 and below (`maxSdkVersion="32"`). |

### Network Security
- Configured with `android/app/src/main/res/xml/network_security_config.xml`.
- Enforces HTTPS by default while permitting system and user certificates for enterprise departmental root CAs.
- Supports cleartext traffic for local intranet police station nodes (`10.0.2.2`, `192.168.x.x`).

---

## 5. Mobile Network Optimization & Error Resilience

1. **Request Timeouts**:
   - All mobile API requests in `frontend/src/api/client.ts` include an automated 25-second `AbortController` timeout to prevent UI freezes on weak cellular connections.
2. **Transient Network Retries**:
   - Idempotent GET requests automatically retry up to 2 times with exponential backoff on transient connection drops (`Failed to fetch` / `NetworkError`).
3. **Session Refresh & Expiration**:
   - In case of access token expiration (HTTP 401), the client automatically exchanges the refresh token via `POST /auth/refresh` and transparently replays the original request.
   - If the refresh token is revoked or expired, the client clears credentials and dispatches an unauthorized event, redirecting safely to the login screen.
4. **Dynamic Backend Switcher**:
   - The login screen includes a Server Settings panel allowing field officers or network administrators to point the mobile app to any departmental URL without rebuilding the APK.

---

## 6. Cryptographic Signing & Authenticode Information

The release APK is signed using **Android APK Signature Scheme v2** with a 2048-bit RSA key:

- **Key Alias**: `crdms_release_key`
- **Algorithm**: RSA 2048-bit with SHA-384
- **Certificate DN**: `CN=Xerova CRDMS, OU=Security Engineering, O=Xerova Softwares, L=Chennai, ST=TN, C=IN`
- **Certificate SHA-256 Digest**: `F7:84:5B:B1:45:EC:9D:50:9D:62:59:0B:3C:5C:87:6E:91:94:A2:8C:9A:E2:14:11:55:8C:9A:DC:4F:CD:1E:74`
- **Signing Scheme Verification**:
  ```text
  Verifies: true
  Verified using v2 scheme (APK Signature Scheme v2): true
  ```
- **Keystore Protection**:
  The signing keystore (`release-key.jks`) and credential files are strictly excluded from git tracking in `.gitignore` and `android/.gitignore`. Build environments inject passwords via `CRDMS_KEYSTORE_PASSWORD`, `CRDMS_KEY_ALIAS`, and `CRDMS_KEY_PASSWORD`.

---

## 7. Installation & Deployment Instructions

### Method A: Direct Sideloading (Physical Device)
1. Transfer `xerova-crdms-release-1.0.0.apk` to the Android device (via USB, email, or department MDM).
2. On Android, tap the APK file.
3. If prompted, allow "Install unknown apps" for your file manager.
4. Tap **Install** and then **Open**.

### Method B: ADB Installation (Emulator or USB Debugging)
```powershell
# Verify connected device
& "C:\Users\Dhina\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices

# Install release APK
& "C:\Users\Dhina\AppData\Local\Android\Sdk\platform-tools\adb.exe" install -r "dist-android\xerova-crdms-release-1.0.0.apk"

# Launch main activity
& "C:\Users\Dhina\AppData\Local\Android\Sdk\platform-tools\adb.exe" shell am start -n com.xerova.crdms/.MainActivity
```

---

## 8. Backend Prerequisites

To process live investigations on mobile:
1. **Backend Server**: Ensure FastAPI is running on an accessible IP or domain:
   ```powershell
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
2. **Android Emulator Access**: In Android Studio emulator, connect to `http://10.0.2.2:8000/api/v1`.
3. **Physical Device Access**: Connect device to the same Wi-Fi network and point server URL to your machine's LAN IP (e.g., `http://192.168.1.100:8000/api/v1`), or deploy behind an HTTPS reverse proxy (e.g. Nginx / Caddy).
