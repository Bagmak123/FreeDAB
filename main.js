const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { autoUpdater } = require("electron-updater");

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

  // Блокируем открытие ссылок внутри лаунчера
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

  // Передаём версию приложения в UI
  win.webContents.on("did-finish-load", () => {
    win.webContents.send("app-version", app.getVersion());
  });

  // UI → показать «Проверка обновлений...»
  win.webContents.send("update-checking");

  // Запускаем проверку
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

    // Через секунду закрываем лаунчер и ставим обновление
    setTimeout(() => autoUpdater.quitAndInstall(), 1200);
  });

  // UI: пользователь нажал кнопку «Обновить»
  ipcMain.on("start-update", () => {
    autoUpdater.downloadUpdate();
  });
}

/* ======================================================
                   СКАЧИВАНИЕ ИГР
======================================================*/
function downloadFile(win, url, fileName, gameId) {
  try {
    const downloadsDir = app.getPath("downloads");
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
        // Редирект (GitHub Releases делает редирект!)
        if (response.statusCode === 301 || response.statusCode === 302) {
          let redirectUrl = response.headers.location;
          if (!redirectUrl) return sendError("Пустой redirect URL");

          if (!redirectUrl.startsWith("http")) {
            redirectUrl = new URL(redirectUrl, currentUrl).toString();
          }

          requestUrl(redirectUrl);
          return;
        }

        if (response.statusCode !== 200) {
          return sendError("HTTP статус " + response.statusCode);
        }

        const total = parseInt(response.headers["content-length"] || "0", 10);
        let received = 0;

        const file = fs.createWriteStream(filePath);

        response.on("data", (chunk) => {
          received += chunk.length;

          const elapsed = (Date.now() - startTime) / 1000;
          const speed = received / (elapsed || 1);

          let percent = total > 0 ? Math.round((received / total) * 100) : null;

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

        file.on("error", (err) => sendError(err.message));
      });

      req.on("error", (err) => sendError(err.message));
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
    return win.webContents.send("download-error", {
      gameId,
      error: "Пустая ссылка на файл"
    });
  }

  downloadFile(win, url, fileName, gameId);
});

/* ======================================================
                      ЗАПУСК APP
======================================================*/
app.whenReady().then(() => {
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
