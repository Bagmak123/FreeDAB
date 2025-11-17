const { app, BrowserWindow, shell, ipcMain, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { autoUpdater } = require("electron-updater");

/* ======================================================
                ПУТЬ К ФАЙЛУ НАСТРОЕК
======================================================*/
const SETTINGS_FILE = path.join(app.getPath("userData"), "user-settings.json");
const LOCAL_GAMES_FILE = path.join(app.getPath("userData"), "games.json");
const LIBRARY_FILE = path.join(app.getPath("userData"), "library.json");
const LIBRARY_ICON_DIR = path.join(app.getPath("userData"), "library-icons");

if (!fs.existsSync(LIBRARY_ICON_DIR)) {
  fs.mkdirSync(LIBRARY_ICON_DIR, { recursive: true });
}


function loadSettings() {
  const defaults = {
    downloadPath: app.getPath("downloads"),
    theme: "dark",
  };

  if (!fs.existsSync(SETTINGS_FILE)) {
    return defaults;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function saveSettings(obj) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(obj, null, 2));
}

/* ======================================================
                      СОЗДАНИЕ ОСНОВНОГО ОКНА
======================================================*/
let mainWindow = null;
let settingsWindow = null;

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

  mainWindow = win;
  return win;
}

/* ======================================================
                ОКНО НАСТРОЕК (новое окно)
======================================================*/
function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 420,
    height: 380,
    resizable: false,
    title: "Настройки",
    backgroundColor: "#111111",
    modal: false,
    parent: mainWindow,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  settingsWindow.loadFile("settingsWindow.html");

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  // Передаём путь загрузки сразу при загрузке
  settingsWindow.webContents.on("did-finish-load", () => {
    settingsWindow.webContents.send("settings-load", loadSettings());
  });
}

/* IPC — команда открыть окно настроек */
ipcMain.handle("open-settings", () => {
  openSettingsWindow();
  return true;
});

/* ======================================================
                 АВТООБНОВЛЕНИЕ LAUNCHER
======================================================*/

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;

  autoUpdater.on("checking-for-update", () => {
    if (mainWindow) {
      mainWindow.webContents.send("app-version", app.getVersion());
      mainWindow.webContents.send("update-checking");
    }
  });

  autoUpdater.on("update-available", (info) => {
    if (mainWindow) {
      mainWindow.webContents.send("update-available", info);
      mainWindow.webContents.send("update-status", {
        status: "available",
        info
      });
    }
  });

  autoUpdater.on("update-not-available", () => {
    if (mainWindow) {
      mainWindow.webContents.send("update-not-available");
      mainWindow.webContents.send("update-status", { status: "latest" });
    }
  });

  autoUpdater.on("error", (err) => {
    if (mainWindow) {
      mainWindow.webContents.send("update-error", err.message);
      mainWindow.webContents.send("update-status", {
        status: "error",
        message: err.message
      });
    }
  });

  autoUpdater.on("download-progress", (p) => {
    if (mainWindow) {
      const payload = {
        percent: Math.round(p.percent),
        transferred: p.transferred,
        total: p.total,
        speed: p.bytesPerSecond
      };
      mainWindow.webContents.send("update-progress", payload);
      mainWindow.webContents.send("update-status", {
        status: "downloading",
        percent: p.percent
      });
    }
  });

  autoUpdater.on("update-downloaded", () => {
    if (mainWindow) {
      mainWindow.webContents.send("update-downloaded");
      mainWindow.webContents.send("update-status", { status: "ready" });
    }
    // Установка обновления запустится после команды из UI
  });

  // Первый чек при запуске
  app.whenReady().then(() => {
    autoUpdater.autoDownload = false;
    autoUpdater.checkForUpdates();

    // Периодическая проверка каждые 10 минут
    setInterval(() => {
      autoUpdater.autoDownload = false;
      autoUpdater.checkForUpdates();
    }, 10 * 60 * 1000);
  });

  ipcMain.handle("update-check", async () => {
    autoUpdater.autoDownload = false;
    autoUpdater.checkForUpdates();
    return true;
  });

  ipcMain.handle("update-apply", async () => {
    autoUpdater.downloadUpdate();
    return true;
  });

  ipcMain.on("manual-check-update", () => {
    autoUpdater.autoDownload = false;
    autoUpdater.checkForUpdates();
  });

  ipcMain.on("start-update", () => {
    autoUpdater.downloadUpdate();
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
ipcMain.handle("settings-get-download-path", () => {
  return loadSettings().downloadPath;
});

ipcMain.handle("settings-choose-folder", async () => {
  const res = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });

  if (res.canceled) return null;
  return res.filePaths[0];
});

ipcMain.handle("settings-set-download-path", (_e, newPath) => {
  const s = loadSettings();
  s.downloadPath = newPath;
  saveSettings(s);
  return true;
});
ipcMain.handle("settings-get-theme", () => {
  return loadSettings().theme || "dark";
});

ipcMain.handle("settings-set-theme", (_e, theme) => {
  const allowed = ["light", "dark", "neon"];
  const safe = allowed.includes(theme) ? theme : "dark";
  const s = loadSettings();
  s.theme = safe;
  saveSettings(s);
  return true;
});



ipcMain.handle("games-save-file", (_e, games) => {
  try {
    fs.writeFileSync(LOCAL_GAMES_FILE, JSON.stringify(games, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Ошибка записи LOCAL_GAMES_FILE:", err);
    throw err;
  }
});

/* ======================================================
     КНОПКА "ОПУБЛИКОВАТЬ ОБНОВЛЕНИЕ" ИЗ АДМИНКИ
======================================================*/
ipcMain.handle("open-ci-actions", () => {
  shell.openExternal("https://github.com/Bagmak123/FreeDAB/actions");
  return true;
});

/* ======================================================
                    ЛОКАЛЬНАЯ БИБЛИОТЕКА ИГР
======================================================*/

function loadLibrary() {
  if (!fs.existsSync(LIBRARY_FILE)) return [];
  try {
    const raw = fs.readFileSync(LIBRARY_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Ошибка чтения LIBRARY_FILE:", err);
    return [];
  }
}

function saveLibrary(list) {
  try {
    fs.writeFileSync(LIBRARY_FILE, JSON.stringify(list, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Ошибка записи LIBRARY_FILE:", err);
    throw err;
  }
}

ipcMain.handle("library-load", () => {
  return loadLibrary();
});

ipcMain.handle("library-save", (_e, list) => {
  saveLibrary(Array.isArray(list) ? list : []);
  return true;
});

ipcMain.handle("library-pick-exe", async () => {
  const res = await dialog.showOpenDialog({
    filters: [{ name: "Исполняемый файл", extensions: ["exe"] }],
    properties: ["openFile"],
  });
  if (res.canceled || !res.filePaths || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle("library-pick-image", async () => {
  const res = await dialog.showOpenDialog({
    filters: [
      { name: "Изображения", extensions: ["png", "jpg", "jpeg"] },
    ],
    properties: ["openFile"],
  });
  if (res.canceled || !res.filePaths || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle("library-extract-icon", async (_e, exePath, gameId) => {
  return new Promise((resolve) => {
    if (process.platform !== "win32") {
      return resolve(null);
    }

    if (!exePath || !gameId) {
      return resolve(null);
    }

    const outPng = path.join(LIBRARY_ICON_DIR, gameId + ".png");

    const safeSrc = exePath.replace(/'/g, "''");
    const safeDst = outPng.replace(/'/g, "''");

    const script = `
      $src = '${safeSrc}';
      $dst = '${safeDst}';
      Add-Type -AssemblyName System.Drawing;
      $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($src);
      if ($icon -ne $null) {
        $bmp = $icon.ToBitmap();
        $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png);
        Write-Output "OK";
      } else {
        Write-Output "NOICON";
      }
    `;

    const ps = spawn("powershell.exe", ["-NoProfile", "-Command", script]);

    ps.on("error", (err) => {
      console.error("PowerShell error:", err);
      resolve(null);
    });

    ps.on("exit", () => {
      if (fs.existsSync(outPng)) {
        resolve(outPng);
      } else {
        resolve(null);
      }
    });
  });
});

ipcMain.handle("library-run-exe", async (_e, exePath) => {
  return new Promise((resolve) => {
    if (!exePath) return resolve(false);

    try {
      const child = spawn(exePath, {
        detached: true,
        stdio: "ignore",
      });

      child.on("error", (err) => {
        console.error("Ошибка запуска игры:", err);
        resolve(false);
      });

      child.unref();
      resolve(true);

      child.on("exit", () => {
        try {
          if (mainWindow) {
            mainWindow.webContents.send("library-run-state", {
              exe: exePath,
              state: "closed",
            });
          }
        } catch (err) {
          console.error("Ошибка отправки состояния library-run-state:", err);
        }
      });
    } catch (err) {
      console.error("Исключение при запуске игры:", err);
      resolve(false);
    }
  });
});


/* ======================================================
                      ЗАПУСК APP
======================================================*/
app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
