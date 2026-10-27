const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Set application name and user data path
app.name = 'Xerova CRDMS';
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const logFilePath = path.join(logsDir, 'desktop-client.log');

function writeLog(level, message, details = null) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level.toUpperCase()}] ${message}${
    details ? ' ' + JSON.stringify(details) : ''
  }\n`;
  try {
    fs.appendFileSync(logFilePath, entry, 'utf8');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  writeLog('WARN', 'Second instance launch attempted. Quitting redundant instance.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function getIconPath() {
  const icoPath = path.join(__dirname, '../public/icons/icon.ico');
  const pngPath = path.join(__dirname, '../public/icons/icon-512.png');
  if (process.platform === 'win32' && fs.existsSync(icoPath)) {
    return icoPath;
  }
  if (fs.existsSync(pngPath)) {
    return pngPath;
  }
  return undefined;
}

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: 'Xerova CRDMS - Criminal Record & Case Management System',
    icon: iconPath,
    backgroundColor: '#FAFAFA',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    writeLog('INFO', 'Main application window initialized and presented to user.');
  });

  // Handle external URL requests safely in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Navigation guard: prevent navigating away from application
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    if (parsed.protocol !== 'file:' && !navigationUrl.includes('localhost') && !navigationUrl.includes('127.0.0.1')) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // Load production bundle or dev server
  if (isDev && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      writeLog('ERROR', 'Failed to load local index.html', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getAppInfo', () => {
  return {
    name: 'Xerova CRDMS Desktop',
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    userDataPath: app.getPath('userData'),
    logPath: logFilePath,
    apiBaseUrl: process.env.CRDMS_API_URL || 'http://localhost:8000/api/v1',
  };
});

ipcMain.handle('app:log', (event, { level, message, details }) => {
  writeLog(level || 'INFO', message, details);
  return true;
});

ipcMain.handle('app:openExternal', (event, url) => {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('app:checkBackendHealth', async (event, customUrl) => {
  const targetUrl = (customUrl || process.env.CRDMS_API_URL || 'http://127.0.0.1:8000/api/v1') + '/health';
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(targetUrl);
      const client = urlObj.protocol === 'https:' ? https : http;
      const req = client.get(
        targetUrl,
        {
          timeout: 4000,
          headers: { 'User-Agent': `Xerova-CRDMS-Desktop/${app.getVersion()}` },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const parsed = JSON.parse(data);
                resolve({ online: true, statusCode: 200, data: parsed });
              } catch {
                resolve({ online: true, statusCode: 200 });
              }
            } else {
              resolve({ online: false, statusCode: res.statusCode });
            }
          });
        }
      );
      req.on('error', (err) => {
        resolve({ online: false, error: err.message });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ online: false, error: 'Connection timed out' });
      });
    } catch (err) {
      resolve({ online: false, error: err.message });
    }
  });
});

// App Lifecycle
app.whenReady().then(() => {
  writeLog('INFO', `Starting Xerova CRDMS Desktop v${app.getVersion()} on ${process.platform} ${process.arch}`);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  writeLog('INFO', 'All windows closed. Terminating application gracefully.');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  writeLog('INFO', 'Application exiting.');
});
