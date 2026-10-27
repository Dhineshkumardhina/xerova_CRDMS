const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
  apiBaseUrl: process.env.CRDMS_API_URL || null,
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getAppInfo: () => ipcRenderer.invoke('app:getAppInfo'),
  checkBackendHealth: (customUrl) => ipcRenderer.invoke('app:checkBackendHealth', customUrl),
  log: (level, message, details) => ipcRenderer.invoke('app:log', { level, message, details }),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
});
