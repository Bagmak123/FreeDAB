const { contextBridge, ipcRenderer } = require("electron");

/* ======================================================
                    СКАЧИВАНИЕ ИГР
======================================================*/
contextBridge.exposeInMainWorld("downloader", {
  downloadGame: (payload) => ipcRenderer.send("download-game", payload),
  onProgress: (cb) =>
    ipcRenderer.on("download-progress", (_e, data) => cb(data)),
  onComplete: (cb) =>
    ipcRenderer.on("download-complete", (_e, data) => cb(data)),
  onError: (cb) => ipcRenderer.on("download-error", (_e, data) => cb(data)),
});

/* ======================================================
                   АВТООБНОВЛЕНИЕ
======================================================*/
contextBridge.exposeInMainWorld("updater", {
  /** UI → получает текущую версию */
  onAppVersion: (cb) =>
    ipcRenderer.on("app-version", (_e, version) => cb(version)),

  /** Проверка обновлений */
  onChecking: (cb) => ipcRenderer.on("update-checking", () => cb()),
  onAvailable: (cb) =>
    ipcRenderer.on("update-available", (_e, info) => cb(info)),
  onNotAvailable: (cb) =>
    ipcRenderer.on("update-not-available", () => cb()),
  onError: (cb) =>
    ipcRenderer.on("update-error", (_e, err) => cb(err)),
  onDownloadProgress: (cb) =>
    ipcRenderer.on("update-progress", (_e, data) => cb(data)),
  onDownloaded: (cb) =>
    ipcRenderer.on("update-downloaded", () => cb()),

  /** Команда начать скачивать обновление */
  startUpdate: () => ipcRenderer.send("start-update"),
});

/* ======================================================
                   ОКНО НАСТРОЕК
======================================================*/

contextBridge.exposeInMainWorld("settings", {
  /** Получить путь загрузки */
  getDownloadPath: () => ipcRenderer.invoke("settings-get-download-path"),

  /** Установить новый путь */
  setDownloadPath: (p) =>
    ipcRenderer.invoke("settings-set-download-path", p),

  /** Выбор папки через диалог */
  chooseFolder: () => ipcRenderer.invoke("settings-choose-folder"),

  /** Ручная проверка обновлений */
  manualCheckUpdate: () => ipcRenderer.send("manual-check-update"),

  /** Начать установку обновления */
  startUpdate: () => ipcRenderer.send("start-update"),

  /** Получает сигналы от main.js */
  onChecking: (cb) => ipcRenderer.on("update-checking", () => cb()),
  onAvailable: (cb) =>
    ipcRenderer.on("update-available", (_e, info) => cb(info)),
  onNotAvailable: (cb) =>
    ipcRenderer.on("update-not-available", () => cb()),
  onError: (cb) =>
    ipcRenderer.on("update-error", (_e, err) => cb(err)),
});
