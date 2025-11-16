const { contextBridge, ipcRenderer } = require('electron');

/* -----------------------------
      СКАЧИВАНИЕ ИГР
------------------------------*/
contextBridge.exposeInMainWorld('downloader', {
  downloadGame: (payload) => ipcRenderer.send('download-game', payload),
  onProgress: (cb) => ipcRenderer.on('download-progress', (_e, data) => cb(data)),
  onComplete: (cb) => ipcRenderer.on('download-complete', (_e, data) => cb(data)),
  onError: (cb) => ipcRenderer.on('download-error', (_e, data) => cb(data)),
});

/* -----------------------------
      АВТООБНОВЛЕНИЕ
------------------------------*/
contextBridge.exposeInMainWorld('updater', {
  // Проверка обновлений началась
  onChecking: (cb) => ipcRenderer.on("update-checking", () => cb()),

  // Обновление найдено
  onAvailable: (cb) => ipcRenderer.on("update-available", (_e, info) => cb(info)),

  // Обновлений нет
  onNotAvailable: (cb) => ipcRenderer.on("update-not-available", () => cb()),

  // Ошибка обновления
  onError: (cb) => ipcRenderer.on("update-error", (_e, err) => cb(err)),

  // Прогресс скачивания обновления
  onDownloadProgress: (cb) => ipcRenderer.on("update-progress", (_e, data) => cb(data)),

  // Файл обновления скачан
  onDownloaded: (cb) => ipcRenderer.on("update-downloaded", () => cb()),

  // Команда: начать скачивание обновления
  startUpdate: () => ipcRenderer.send("start-update"),

  // Текущая версия приложения
  onAppVersion: (cb) => ipcRenderer.on("app-version", (_e, version) => cb(version)),
      });

contextBridge.exposeInMainWorld("settings", {
  getPath: () => ipcRenderer.invoke("settings-get-path"),
  choosePath: () => ipcRenderer.invoke("settings-choose-path"),
  savePath: (p) => ipcRenderer.invoke("settings-save-path", p)
});

contextBridge.exposeInMainWorld("updates", {
  check: () => ipcRenderer.invoke("update-check"),
  apply: () => ipcRenderer.invoke("update-apply"),
  onStatus: (cb) => ipcRenderer.on("update-status", (_e, data) => cb(data))
});
