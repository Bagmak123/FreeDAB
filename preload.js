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
  /** Открыть окно настроек (legacy, сейчас не используется) */
  open: () => ipcRenderer.invoke("open-settings"),

  /** Получить путь загрузки */
  getDownloadPath: () => ipcRenderer.invoke("settings-get-download-path"),

  /** Установить новый путь */
  setDownloadPath: (p) =>
    ipcRenderer.invoke("settings-set-download-path", p),

  /** Выбор папки через диалог */
  chooseFolder: () => ipcRenderer.invoke("settings-choose-folder"),

  /** ТЕМА: получить/установить */
  getTheme: () => ipcRenderer.invoke("settings-get-theme"),
  setTheme: (t) => ipcRenderer.invoke("settings-set-theme", t),

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


/* ======================================================
                    РАБОТА С ФАЙЛОМ ИГР
======================================================*/
contextBridge.exposeInMainWorld("gamesIO", {
  /**
   * Сохранить текущий список игр в локальный games.json
   */
  saveToFile: (games) => ipcRenderer.invoke("games-save-file", games),
});


/* ======================================================
                    БИБЛИОТЕКА ИГР
======================================================*/
contextBridge.exposeInMainWorld("library", {
  load: () => ipcRenderer.invoke("library-load"),
  save: (list) => ipcRenderer.invoke("library-save", list),

  pickExe: () => ipcRenderer.invoke("library-pick-exe"),
  pickImage: () => ipcRenderer.invoke("library-pick-image"),

  extractIcon: (exePath, gameId) =>
    ipcRenderer.invoke("library-extract-icon", exePath, gameId),

  runExe: (exePath) => ipcRenderer.invoke("library-run-exe", exePath),

  onRunState: (cb) =>
    ipcRenderer.on("library-run-state", (_e, data) => cb(data)),
});

/* ======================================================
                    АДМИН-ИНСТРУМЕНТЫ
======================================================*/
contextBridge.exposeInMainWorld("adminTools", {
  openCiActions: () => ipcRenderer.invoke("open-ci-actions"),
});
