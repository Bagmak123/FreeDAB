const { app, BrowserWindow, shell, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { autoUpdater } = require("electron-updater");

/* ======================================================
                ПУТЬ К ФАЙЛУ НАСТРОЕК
======================================================*/
const SETTINGS_FILE = path.join(app.getPath("userData"), "user-settings.json");

function loadSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    return { downloadPath: app.getPath("downloads") };
  }
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
  } catch {
    return { downloadPath: app.getPath("downloads") };
  }
}

function saveSettings(obj) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(obj, null, 2));
}

/* ======================================================
                      СОЗДАНИЕ ОКНА
======================================================*/
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#111111",
    title: "FreeDAB Launcher",
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadFile("index.html");

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return win;
}

/* ======================================================
                 АВТООБНОВЛЕНИЕ LAUNCHER
======================================================*/
function setupAutoUpdater(win) {
  autoUpdater.autoDownload = false;

  win.webContents.on("did-finish-load", () => {
    win.webContents.send("app-version", app.getVersion());
  });

  // Проверка при запуске
  win.webContents.send("update-checking");
  autoUpdater.checkForUpdates();

  autoUpdater.on("update-available", (info) => {
    win.webContents.send("update-available", info);
  });

  autoUpdater.on("update-not-available", () => {
    win.webContents.send("update-not-available");
  });

  autoUpdater.on("error", (err) => {
    win.webContents.send("update-error", err.message);
  });

  autoUpdater.on("download-progress", (p) => {
    win.webContents.send("update-progress", {
      percent: Math.round(p.percent),
      transferred: p.transferred,
      total: p.total,
      speed: p.bytesPerSecond
    });
  });

  autoUpdater.on("update-downloaded", () => {
    win.webContents.send("update-downloaded");
    setTimeout(() => autoUpdater.quitAndInstall(), 5000);
  });

  // Команда на скачивание
  ipcMain.on("start-update", () => {
    autoUpdater.downloadUpdate();
  });

  /* ----------- Кнопка "Проверить обновление" из настроек ----------- */
  ipcMain.handle("update-check", async () => {
    autoUpdater.autoDownload = false;
    autoUpdater.checkForUpdates();
    return true;
  });

  ipcMain.handle("update-apply", async () => {
    autoUpdater.downloadUpdate();
    return true;
  });

  // Отправляем статус в renderer (для настроек)
  autoUpdater.on("update-available", info => {
    win.webContents.send("update-status", {
      status: "available",
      info
    });
  });

  autoUpdater.on("update-not-available", () => {
    win.webContents.send("update-status", { status: "latest" });
  });

  autoUpdater.on("download-progress", p => {
    win.webContents.send("update-status", {
      status: "downloading",
      percent: p.percent
    });
  });

  autoUpdater.on("update-downloaded", () => {
    win.webContents.send("update-status", { status: "ready" });
    setTimeout(() => autoUpdater.quitAndInstall(), 2000);
  });
}

/* ======================================================
                   СКАЧИВАНИЕ ИГР
======================================================*/
function downloadFile(win, url, fileName, gameId) {
  try {
    const settings = loadSettings();
    const downloadsDir = settings.downloadPath || app.getPath("downloads");

    const filePath = path.join(downloadsDir, fileName || "game-download");

    const startTime = Date.now();

    function sendError(msg) {
      win.webContents.send("download-error", {
        gameId,
        error: msg
      });
    }

    function requestUrl(currentUrl) {
      const client = currentUrl.startsWith("http://") ? http : https;

      const req = client.get(currentUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          let redirectUrl = response.headers.location;
          if (!redirectUrl) {
            sendError("Пустой redirect Location");
            return;
          }
          if (!/^https?:\/\//i.test(redirectUrl)) {
            try {
              redirectUrl = new URL(redirectUrl, currentUrl).toString();
            } catch (e) {
              sendError("Неверный redirect URL");
              return;
            }
          }
          requestUrl(redirectUrl);
          return;
        }

        if (response.statusCode !== 200) {
          sendError("HTTP статус " + response.statusCode);
          return;
        }

        const total = parseInt(response.headers["content-length"] || "0", 10);
        let received = 0;

        const file = fs.createWriteStream(filePath);

        response.on("data", (chunk) => {
          received += chunk.length;
          const elapsed = (Date.now() - startTime) / 1000 || 1;
          const speed = received / elapsed;
          let percent = null;
          if (total > 0) {
            percent = Math.round((received / total) * 100);
          }

          win.webContents.send("download-progress", {
            gameId,
            downloaded: received,
            total,
            speed,
            percent
          });
        });

        response.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            win.webContents.send("download-complete", {
              gameId,
              filePath
            });
          });
        });

        file.on("error", (err) => {
          sendError(err.message);
        });
      });

      req.on("error", (err) => {
        sendError(err.message);
      });
    }

    requestUrl(url);
  } catch (err) {
    win.webContents.send("download-error", {
      gameId,
      error: err.message
    });
  }
}

/* ======================================================
                IPC – КОМАНДА СКАЧАТЬ ИГРУ
======================================================*/
ipcMain.on("download-game", (event, payload) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { url, fileName, gameId } = payload;
  if (!url) {
    win.webContents.send("download-error", {
      gameId,
      error: "Пустая ссылка на файл"
    });
    return;
  }
  downloadFile(win, url, fileName, gameId);
});

/* ======================================================
                    НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ
======================================================*/
ipcMain.handle("settings-get-path", () => {
  return loadSettings().downloadPath;
});

ipcMain.handle("settings-choose-path", async () => {
  const res = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });

  if (res.canceled) return null;
  return res.filePaths[0];
});

ipcMain.handle("settings-save-path", (_e, newPath) => {
  const s = loadSettings();
  s.downloadPath = newPath;
  saveSettings(s);
  return true;
});

/* ======================================================
                      ЗАПУСК APP
======================================================*/
app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath
    });
  }

  const win = createWindow();
  setupAutoUpdater(win);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = createWindow();
      setupAutoUpdater(newWin);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
