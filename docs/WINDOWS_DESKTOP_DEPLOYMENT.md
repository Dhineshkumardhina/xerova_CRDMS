# Xerova CRDMS - Windows Desktop Deployment Guide

This document provides complete instructions for installing, configuring, running, updating, and maintaining the **Xerova Crime Record and Data Management System (CRDMS)** Windows desktop client.

---

## 1. System Architecture & Packaging Approach

### Architecture Model
The desktop distribution utilizes a **Secure Thin-Client / Micro-Service Shell Architecture**:
1. **Desktop Client (Electron + React 19 + Vite)**:
   - Built into a standalone Windows NSIS Installer and Portable Executable.
   - Embeds the Chromium presentation engine and Node.js lifecycle supervisor.
   - Contains all compiled UI components, assets, icons, and client-side encryption workflows.
   - Runs in isolated security context (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`).
2. **Backend Services & Database Node (FastAPI + SQLAlchemy + SQLite/PostgreSQL)**:
   - Hosts the REST API (`/api/v1`), SQLite/PostgreSQL database, file storage, and biometric face recognition pipeline (`dlib`, `opencv-python`, ResNet embeddings).
   - **Deployment Model**: Can run as:
     - A local Windows background service / daemon on workstation (`http://127.0.0.1:8000/api/v1`), OR
     - A centralized department intranet / cloud server (e.g. `https://crdms.police-dept.internal/api/v1`).
3. **Rationale**:
   - The biometric face-recognition engine requires native C++ runtimes (`dlib`, CMake, MSVC C++ Redistributable, Python 3.10-3.14, and large deep-learning model weights `dlib_face_recognition_resnet_model_v1.dat`).
   - Packaging high-privilege database passwords or raw SQLite WAL database files inside an unpackable `.exe` client is a severe security vulnerability.
   - Separating the desktop client from the backend node allows field officers and station workstations to connect securely to a shared department database without requiring local Python development toolchains or local database synchronization drift.

---

## 2. Windows Build Artifacts

The desktop build produces standard Windows executables in the `dist-electron/` directory:

| Artifact | Output Path | Type | Description |
| :--- | :--- | :--- | :--- |
| **Windows NSIS Installer** | `dist-electron/Xerova CRDMS Setup 1.0.0.exe` | Installer (`.exe`) | Full Windows installer with Start Menu shortcut, Desktop shortcut, and Add/Remove Programs integration. |
| **Portable Executable** | `dist-electron/Xerova CRDMS 1.0.0.exe` | Portable (`.exe`) | Single-file zero-install executable that runs directly from USB drive or local disk without administrator privileges. |
| **Unpacked Directory** | `dist-electron/win-unpacked/Xerova CRDMS.exe` | Unpacked Executable | Pre-extracted application bundle for direct execution or manual enterprise software distribution (SCCM / Intune). |

---

## 3. Security, Credentials & Secret Handling

### Zero Hardcoded Secrets Policy
- **No Privileged Keys**: The executable contains **NO** embedded database passwords, JWT private secret keys, administrative credentials, or master encryption keys.
- **Dynamic API Base URL**:
  - The desktop client connects to the backend dynamically.
  - Default URL: `http://localhost:8000/api/v1`.
  - The backend URL can be configured at runtime via:
    1. The desktop application settings modal / configuration prompt.
    2. Local storage key: `crms_api_base_url`.
    3. Windows environment variable: `VITE_API_BASE_URL`.
- **JWT & Session Security**:
  - Access tokens and refresh tokens are stored securely in memory and HTTP authorization headers.
  - Revocation on logout (`POST /auth/logout`) blacklists the refresh token immediately in the backend database.
- **Cross-Origin & Protocol Security**:
  - Backend FastAPI CORS middleware is configured to accept requests from desktop `file://` and Electron origins while blocking arbitrary web browser domains.
  - Electron web navigation is restricted (`setWindowOpenHandler` denies unauthorized external page redirects).

---

## 4. Code Signing & Authenticode Information

> [!WARNING]
> **Code Signing Status: Unsigned (Development / Internal Release)**
> 
> No commercial EV (Extended Validation) or Standard Authenticode certificate was found in the build environment. The executable is therefore **unsigned**.

### Running the Unsigned Executable on Windows
When launching the installer or portable `.exe` on Windows 10/11 with SmartScreen enabled:
1. Windows Defender SmartScreen may display: *"Windows protected your PC - Microsoft Defender SmartScreen prevented an unrecognized app from starting."*
2. Click **More info**.
3. Click **Run anyway**.

### Enterprise Certificate Signing Instructions
To sign the build artifacts for production enterprise deployment using your organization's Code Signing Certificate (`.pfx` file):
```powershell
# Using Microsoft Windows SDK SignTool
& "C:\Program Files (x86)\Windows Kits\10\bin\x64\signtool.exe" sign `
    /f "C:\Path\To\EnterpriseCertificate.pfx" `
    /p "YourCertificatePassword" `
    /fd SHA256 `
    /tr "http://timestamp.digicert.com" `
    /td SHA256 `
    "c:\PROJECTS\xerova softwares\CRDMS\dist-electron\Xerova CRDMS Setup 1.0.0.exe"
```

---

## 5. External Prerequisites & Backend Node Setup

To enable complete end-to-end functionality (Authentication, FIR Registration, Case Management, Evidence Storage, and Biometric Face Recognition), ensure a backend node is running.

### Option A: Local Backend Node (Same Machine)
1. Ensure Python 3.10+ and C++ Redistributable 2015-2022 are installed.
2. Initialize and run the backend:
   ```powershell
   cd "c:\PROJECTS\xerova softwares\CRDMS\backend"
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```
3. The desktop client will automatically connect to `http://127.0.0.1:8000/api/v1`.

### Option B: Department Intranet / Central Server
1. Deploy the FastAPI backend on the department server (e.g., `https://crdms.internal:8000`).
2. Run database migrations: `alembic upgrade head`.
3. Launch the desktop app and set the API Base URL to the department server URL.

---

## 6. Application Lifecycle & Logging

### Log Files
The desktop client logs all lifecycle events, backend connectivity checks, and unhandled errors to standard Windows application storage:
- **Log Path**: `%APPDATA%\Xerova CRDMS\logs\desktop-client.log`
  *(e.g., `C:\Users\<Username>\AppData\Roaming\Xerova CRDMS\logs\desktop-client.log`)*

### Lifecycle Operations
- **Single Instance Enforcement**: Launching a second instance of `Xerova CRDMS.exe` focuses the existing active window instead of launching a redundant process.
- **Graceful Shutdown**: All IPC channels, window event listeners, and timers are safely terminated when the window is closed.

---

## 7. Installation, Update & Uninstallation

### Installation
1. Double-click `Xerova CRDMS Setup 1.0.0.exe`.
2. Follow the NSIS setup wizard prompts.
3. The installer creates:
   - Application binary in `%LOCALAPPDATA%\Programs\xerova-crdms\`
   - Start Menu shortcut: `Xerova CRDMS`
   - Desktop icon shortcut (optional).

### Portable Mode
- Copy `Xerova CRDMS 1.0.0.exe` to any folder or USB thumb drive.
- Double-click to run immediately without installation.

### Updates
- For standard updates, run the newer version's installer. It automatically overwrites the old version while preserving user configurations and local storage.

### Uninstallation
- Open Windows **Settings > Apps > Installed apps** (or **Control Panel > Programs and Features**).
- Select **Xerova CRDMS** and click **Uninstall**.
- The NSIS uninstaller cleanly removes all application binaries and Start Menu shortcuts.
