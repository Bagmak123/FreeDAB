const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('downloader', {
  downloadGame: (payload) => ipcRenderer.send('download-game', payload),
  onProgress: (cb) => ipcRenderer.on('download-progress', (_e, data) => cb(data)),
  onComplete: (cb) => ipcRenderer.on('download-complete', (_e, data) => cb(data)),
  onError: (cb) => ipcRenderer.on('download-error', (_e, data) => cb(data)),
});
