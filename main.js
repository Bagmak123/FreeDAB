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

  // Обновление найдено
  autoUpdater.on("update-available", (info) => {
    win.webContents.send("update-available", info);
  });

  // Обновлений нет
  autoUpdater.on("update-not-available", () => {
    win.webContents.send("update-not-available");
  });

  // Ошибка при обновлении
  autoUpdater.on("error", (err) => {
    win.webContents.send("update-error", err.message);
  });

  // Прогресс скачивания
  autoUpdater.on("download-progress", (p) => {
    win.webContents.send("update-progress", {
      percent: Math.round(p.percent),
      transferred: p.transferred,
      total: p.total,
      speed: p.bytesPerSecond
    });
  });

  // Файл обновления скачан
  autoUpdater.on("update-downloaded", () => {
    // Сообщаем UI, чтобы показать галочку и надпись "Завершено"
    win.webContents.send("update-downloaded");

    // Даём 5 секунд на анимацию и затем перезапускаем с обновлением
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 5000);
  });

  // Команда из UI — начать скачивание обновления
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
        // Обработка редиректов (например, GitHub Releases)
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
                      ЗАПУСК APP
======================================================*/
app.whenReady().then(() => {
  // Автозапуск лаунчера при старте Windows
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
