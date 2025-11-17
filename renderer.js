/* ==========================================================
                     НАСТРОЙКИ GITHUB API
========================================================== */
const GITHUB_OWNER = "Bagmak123";
const GITHUB_REPO = "FreeDAB";
const GAMES_FILE = "games.json";

let githubToken = null;

/* ────────────────────────────────────────────────────────
   ДЕФОЛТНЫЙ СПИСОК ИГР
───────────────────────────────────────────────────────── */
const DEFAULT_GAMES = [
  {
    id: "cube-runner",
    title: "Cube Runner",
    description: "Мини-аркада: уклоняйся от препятствий и набирай очки.",
    genre: "Аркада",
    platform: "Windows",
    url: "https://speed.hetzner.de/100MB.bin",
    thumb: "https://dummyimage.com/640x360/24263a/ffffff&text=Cube+Runner"
  },
  {
    id: "space-shooter",
    title: "Space Shooter",
    description: "Классический 2D-шутер в космосе с волнами врагов.",
    genre: "Шутер",
    platform: "Windows / Linux",
    url: "https://speed.hetzner.de/100MB.bin",
    thumb: "https://dummyimage.com/640x360/1d2833/ffffff&text=Space+Shooter"
  },
  {
    id: "puzzle-lines",
    title: "Neon Lines",
    description: "Логическая игра: соедини все точки, не отрывая линию.",
    genre: "Головоломка",
    platform: "Windows",
    url: "https://speed.hetzner.de/100MB.bin",
    thumb: "https://dummyimage.com/640x360/222631/ffffff&text=Neon+Lines"
  }
];

/* ==========================================================
                 ЭЛЕМЕНТЫ ИНТЕРФЕЙСА
========================================================== */
const listEl = document.getElementById("gameList");
const emptyEl = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const countChip = document.getElementById("gamesCountChip");

const adminPanel = document.getElementById("adminPanel");
const adminHeader = document.getElementById("adminHeader");
const adminMinimizeBtn = document.getElementById("adminMinimizeBtn");
const adminBubble = document.getElementById("adminBubble");
const descModal = document.getElementById("descModal");
const descModalTitle = document.getElementById("descModalTitle");
const descModalText = document.getElementById("descModalText");
const descModalClose = document.getElementById("descModalClose");

const consoleOverlay = document.getElementById("consoleOverlay");
const consoleInner = document.getElementById("consoleInner");
const consoleOutput = document.getElementById("consoleOutput");
const consoleInput = document.getElementById("consoleInput");
const consoleCloseBtn = document.getElementById("consoleCloseBtn");

const admTitle = document.getElementById("admTitle");
const admDesc = document.getElementById("admDesc");
const admGenre = document.getElementById("admGenre");
const admThumb = document.getElementById("admThumb");
const admURL = document.getElementById("admURL");
const admSubmitBtn = document.getElementById("admSubmitBtn");
const admPublishUpdateBtn = document.getElementById("admPublishUpdateBtn");


const updateWindow = document.getElementById("updateWindow");
const updateTitle = document.getElementById("updateTitle");
const updateText = document.getElementById("updateText");
const updateBar = document.getElementById("updateBar");
const btnUpdateNow = document.getElementById("updateNow");
const btnUpdateCancel = document.getElementById("updateCancel");
const appVersionLabel = document.getElementById("appVersion");
/* ==========================================================
                 АДМИН-ПАНЕЛЬ: ДВИЖЕНИЕ/СВОРАЧИВАНИЕ
========================================================== */

let adminDrag = {
  active: false,
  offsetX: 0,
  offsetY: 0,
};

if (adminHeader && adminPanel) {
  adminHeader.style.cursor = "move";

  const onMouseMove = (e) => {
    if (!adminDrag.active) return;
    const x = e.clientX - adminDrag.offsetX;
    const y = e.clientY - adminDrag.offsetY;
    adminPanel.style.right = "auto";
    adminPanel.style.left = x + "px";
    adminPanel.style.top = y + "px";
  };

  const onMouseUp = () => {
    adminDrag.active = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  adminHeader.addEventListener("mousedown", (e) => {
    const rect = adminPanel.getBoundingClientRect();
    adminDrag.active = true;
    adminDrag.offsetX = e.clientX - rect.left;
    adminDrag.offsetY = e.clientY - rect.top;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });
}

// кнопка свернуть панель -> показать пузырь
if (adminMinimizeBtn && adminPanel) {
  adminMinimizeBtn.addEventListener("click", () => {
    adminPanel.style.display = "none";
    if (adminBubble) {
      adminBubble.style.display = "flex";
    }
  });
}

// клик по пузырю -> вернуть панель
if (adminBubble && adminPanel) {
  adminBubble.addEventListener("click", () => {
    adminPanel.style.display = "block";
    adminBubble.style.display = "none";
  });
}


let games = [];
let editingGameId = null;
let isAdminMode = false;

const downloadState = {}; // { id: {status, percent, speed, filePath} }

/* ==========================================================
                       ХЕЛПЕРЫ
========================================================== */

function logLine(text) {
  try {
    console.log("[FreeDAB]", text);
    if (!consoleOutput) return;
    const line = document.createElement("div");
    line.className = "console-line";
    const prefix = document.createElement("span");
    prefix.className = "console-prefix";
    const ts = new Date().toLocaleTimeString();
    prefix.textContent = "[" + ts + "]";
    const spanText = document.createElement("span");
    spanText.textContent = " " + text;
    line.appendChild(prefix);
    line.appendChild(spanText);
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  } catch (e) {
    console.error("Ошибка логирования в консоль:", e);
  }
}

function openDescriptionModal(game) {
  if (!descModal || !descModalTitle || !descModalText) return;
  descModalTitle.textContent = game.title || "Игра";
  descModalText.textContent = game.description || "Нет описания.";
  descModal.style.display = "flex";
}

function closeDescriptionModal() {
  if (!descModal) return;
  descModal.style.display = "none";
}

function pluralizeGames(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "игра";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "игры";
  return "игр";
}

/* ==========================================================
                       ЗАГРУЗКА ИГР
========================================================== */
async function loadGamesFromGitHub() {
  const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${GAMES_FILE}`;

  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error("GitHub ответил " + res.status);
  }

  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.games)) return json.games;
  throw new Error("Неверный формат games.json");
}

async function loadGames() {
  try {
    const remote = await loadGamesFromGitHub();
    if (Array.isArray(remote) && remote.length > 0) {
      games = remote;
      localStorage.setItem("cached_games", JSON.stringify(games));
      render(games);
      return;
    } else {
      console.warn("Удалённый список игр пустой, используем локальные данные.");
    }
  } catch (err) {
    console.warn("Не удалось загрузить игры с GitHub:", err);
    logLine("Не удалось загрузить игры с GitHub: " + err.message);
  }

  try {
    const cached = localStorage.getItem("cached_games");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        games = parsed;
        render(games);
        return;
      } else {
        console.warn("Кэш игр пустой, используем дефолтный список.");
      }
    }
  } catch (e) {
    console.warn("Ошибка чтения кэша игр:", e);
  }

  games = DEFAULT_GAMES.slice();
  render(games);
}

/* ==========================================================
                       СОХРАНЕНИЕ ИГР
========================================================== */
async function saveGamesToGitHub() {
  if (!githubToken) {
    alert("Ошибка: GH_TOKEN недоступен (редактирование только локально).");
    return;
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GAMES_FILE}`;

  let sha = undefined;
  try {
    const getRes = await fetch(apiUrl);
    if (getRes.ok) {
      const getJson = await getRes.json();
      sha = getJson.sha;
    }
  } catch (e) {
    console.warn("Не удалось получить SHA games.json:", e);
  }

  const updatedContent = btoa(
    unescape(encodeURIComponent(JSON.stringify(games, null, 2)))
  );

  const putRes = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `token ${githubToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "update games.json automatically",
      content: updatedContent,
      sha
    })
  });

  if (!putRes.ok) {
    const txt = await putRes.text();
    console.error("Ошибка сохранения games.json:", txt);
    alert("Не удалось сохранить игры на GitHub. См. консоль.");
    return;
  }

  alert("Игры успешно сохранены на GitHub!");
}

/* ==========================================================
                       РЕНДЕР КАРТОЧЕК
========================================================== */
function render(list) {
  listEl.innerHTML = "";
  if (!list.length) {
    emptyEl.style.display = "block";
    countChip.textContent = "0 игр";
    return;
  }

  emptyEl.style.display = "none";
  countChip.textContent = list.length + " " + pluralizeGames(list.length);

  list.forEach((game) => {
    const card = document.createElement("div");
    card.className = "game-card";

    const tag = document.createElement("div");
    tag.className = "game-tag";
    tag.textContent = game.genre || "Игра";
    card.appendChild(tag);

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (game.thumb) {
      thumb.style.backgroundImage = `url('${game.thumb}')`;
    } else {
      thumb.style.backgroundImage =
        "linear-gradient(135deg,#303952,#596275)";
    }
    card.appendChild(thumb);

    // Заголовок + шестерёнка (только в админ-режиме)
    const titleRow = document.createElement("div");
    titleRow.className = "game-title-row";

    const title = document.createElement("div");
    title.className = "game-title";
    title.textContent = game.title || "Без названия";
    titleRow.appendChild(title);

    if (isAdminMode) {
      const gear = document.createElement("button");
      gear.className = "gear-btn";
      gear.innerHTML = "⚙";
      gear.title = "Редактировать игру";
      gear.addEventListener("click", () => {
        startEditGame(game.id);
      });
      titleRow.appendChild(gear);
    }

    card.appendChild(titleRow);

    const meta = document.createElement("div");
    meta.className = "game-meta";
    meta.textContent = game.platform || "";
    card.appendChild(meta);

    const desc = document.createElement("div");
    desc.className = "game-desc";
    desc.textContent = game.description || "";
    card.appendChild(desc);

    const footer = document.createElement("div");
    footer.className = "card-footer";

    // верхняя кнопка "ОПИСАНИЕ"
    const descRow = document.createElement("div");
    descRow.className = "card-footer-row card-footer-row-top";

    const descBtn = document.createElement("button");
    descBtn.className = "button-secondary";
    descBtn.textContent = "ОПИСАНИЕ";
    descBtn.addEventListener("click", () => openDescriptionModal(game));

    descRow.appendChild(descBtn);
    footer.appendChild(descRow);

    // нижний ряд: только "СКАЧАТЬ ИГРУ"
    const bottomRow = document.createElement("div");
    bottomRow.className = "card-footer-row card-footer-row-bottom";

    const btn = document.createElement("button");
    btn.className = "button-primary";

    const state = downloadState[game.id] || { status: "idle" };

    if (state.status === "completed") {
      card.classList.add("game-card-completed");
    }

    if (state.status === "downloading") {
      const p = state.percent ?? 0;
      btn.textContent = `Загрузка ${p}%`;
      btn.disabled = true;
    } else if (state.status === "completed") {
      btn.textContent = "Скачано ✓";
      btn.disabled = false;
    } else if (state.status === "error") {
      btn.textContent = "Ошибка — ещё раз";
      btn.disabled = false;
    } else {
      btn.textContent = "СКАЧАТЬ ИГРУ";
      btn.disabled = false;
    }

    btn.addEventListener("click", () => startDownload(game));

    const btnWrap = document.createElement("div");
    btnWrap.className = "card-footer-main";
    btnWrap.appendChild(btn);
    bottomRow.appendChild(btnWrap);

    footer.appendChild(bottomRow);
    card.appendChild(footer);

    const statusEl = document.createElement("div");
    statusEl.className = "download-status";

    if (state.status === "downloading") {
      const mbps = state.speed
        ? (state.speed / 1024 / 1024).toFixed(2)
        : null;
      const p = state.percent ?? 0;
      statusEl.textContent = mbps
        ? `Загрузка: ${p}% · ${mbps} МБ/с`
        : `Загрузка: ${p}%`;
    } else if (state.status === "completed") {
      statusEl.textContent = "Файл скачан. Открой папку загрузки.";
    } else if (state.status === "error") {
      statusEl.textContent =
        "Ошибка загрузки: " + (state.error || "");
    } else {
      statusEl.textContent = "";
    }

    card.appendChild(statusEl);

    listEl.appendChild(card);
  });
}

/* ==========================================================
                       УДАЛЕНИЕ ИГРЫ
========================================================== */
function deleteGame(id) {
  const g = games.find((x) => x.id === id);
  if (!g) return;

  if (!confirm(`Удалить игру «${g.title || id}»?`)) return;

  games = games.filter((game) => game.id !== id);
  render(games);
  logLine("Игра удалена: " + (g.title || id));

  if (window.gamesIO && window.gamesIO.saveToFile) {
    window.gamesIO.saveToFile(games).catch((e) =>
      console.error("Ошибка записи games.json:", e)
    );
  }

  saveGamesToGitHub().catch((e) =>
    console.error("Ошибка сохранения игр на GitHub:", e)
  );
}

/* ==========================================================
                 ДОБАВЛЕНИЕ / РЕДАКТИРОВАНИЕ
========================================================== */
function startEditGame(id) {
  const g = games.find((x) => x.id === id);
  if (!g) return;

  editingGameId = id;

  admTitle.value = g.title || "";
  admDesc.value = g.description || "";
  admGenre.value = g.genre || "";
  admThumb.value = g.thumb || "";
  admURL.value = g.url || "";

  admSubmitBtn.textContent = "Сохранить";
}

function submitAdmin() {
  const title = admTitle.value.trim();
  const url = admURL.value.trim();
  const desc = admDesc.value.trim();

  if (!title) {
    alert("Укажи название игры.");
    return;
  }
  if (!url) {
    alert("Нужна ссылка на файл игры (zip/exe/...).");
    return;
  }

  const game = {
    title: title,
    description: desc,
    genre: admGenre.value.trim(),
    url,
    thumb: admThumb.value.trim()
  };

  if (editingGameId) {
    const idx = games.findIndex((g) => g.id === editingGameId);
    if (idx !== -1) {
      games[idx] = { ...games[idx], ...game };
      if (!games[idx].platform) {
        games[idx].platform = "Windows";
      }
      logLine("Игра обновлена: " + game.title);
    }
    editingGameId = null;
  } else {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "game";
    let slug = baseSlug;
    let attempt = 1;
    while (games.some((g) => g.id === slug)) {
      attempt += 1;
      slug = baseSlug + "-" + attempt;
    }
    game.id = slug;
    if (!game.platform) {
      game.platform = "Windows";
    }
    games.push(game);
    logLine("Добавлена новая игра: " + game.title + " (id=" + game.id + ")");
  }

  clearAdmin();
  render(games);

  if (window.gamesIO && window.gamesIO.saveToFile) {
    window.gamesIO.saveToFile(games).catch((e) =>
      console.error("Ошибка записи games.json:", e)
    );
  }

  saveGamesToGitHub().catch((e) =>
    console.error("Ошибка сохранения игр на GitHub:", e)
  );
}

function clearAdmin() {
  admTitle.value = "";
  admDesc.value = "";
  admGenre.value = "";
  admThumb.value = "";
  admURL.value = "";
  admSubmitBtn.textContent = "Добавить";
}

if (admSubmitBtn) {
  admSubmitBtn.addEventListener("click", submitAdmin);
}

if (admPublishUpdateBtn && window.adminTools && window.adminTools.openCiActions) {
  admPublishUpdateBtn.addEventListener("click", () => {
    window.adminTools.openCiActions();
  });
}

/* ==========================================================
                       ПОИСК
========================================================== */
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) {
      render(games);
      return;
    }
    const filtered = games.filter((g) => {
      const t = (g.title || "").toLowerCase();
      const d = (g.description || "").toLowerCase();
      const gen = (g.genre || "").toLowerCase();
      return (
        t.includes(q) || d.includes(q) || gen.includes(q)
      );
    });
    render(filtered);
  });
}

/* ==========================================================
                       СЕКРЕТНАЯ ФРАЗА
========================================================== */
let buffer = "";
document.addEventListener("keydown", (e) => {
  if (e.key.length === 1) buffer += e.key;
  if (buffer.length > 40) buffer = buffer.slice(-40);

  if (buffer.includes("/dabbyadmin1988pashaexit")) {
    isAdminMode = false;
    buffer = "";
    render(games);
    if (adminPanel) adminPanel.style.display = "none";
    if (adminBubble) adminBubble.style.display = "none";
    document.body.classList.remove("admin-on");
    return;
  }

  if (buffer.includes("/dabbyadmin1988pasha")) {
    isAdminMode = true;
    buffer = "";
    render(games);
    if (adminPanel) adminPanel.style.display = "block";
    if (adminBubble) adminBubble.style.display = "none";
    document.body.classList.add("admin-on");
  }
});

/* ==========================================================
                СКАЧИВАНИЕ ИГР ЧЕРЕЗ MAIN.JS
========================================================== */
function startDownload(game) {
  if (!window.downloader) {
    alert("Скачивание отключено: нет связи с main-процессом.");
    return;
  }

  if (!game.url) {
    alert("Для этой игры не указана ссылка на файл.");
    return;
  }

  // --- ИСПРАВЛЕНО: берём настоящее имя файла из URL ---
  let realName = game.url.split("/").pop();
  if (!realName) realName = (game.title || "game") + ".dat";

  // Убираем параметры ?token=... если есть
  realName = realName.split("?")[0];

  downloadState[game.id] = {
    status: "downloading",
    percent: 0,
    speed: 0
  };
  render(games);

  window.downloader.downloadGame({
    url: game.url,
    fileName: realName,
    gameId: game.id
  });
}

  if (!window.downloader) {
    alert("Скачивание отключено: нет связи с main-процессом.");
    return;
  }

  if (!game.url) {
    alert("Для этой игры не указана ссылка на файл.");
    return;
  }

  const safeName = (
    (game.title || "game").replace(/[^a-z0-9_-]/gi, "_") + ".bin"
  ).slice(0, 60);

  downloadState[game.id] = {
    status: "downloading",
    percent: 0,
    speed: 0
  };
  render(games);

  window.downloader.downloadGame({
    url: game.url,
    fileName: safeName,
    gameId: game.id
  });
}

if (window.downloader) {
  window.downloader.onProgress((data) => {
    logLine("Загрузка " + data.gameId + ": " + Math.round(data.percent || 0) + "%");
    if (!downloadState[data.gameId]) {
      downloadState[data.gameId] = {};
    }
    const st = downloadState[data.gameId];
    st.status = "downloading";
    st.percent =
      typeof data.percent === "number"
        ? data.percent
        : data.total > 0
        ? Math.round((data.downloaded / data.total) * 100)
        : 0;
    st.speed = data.speed || 0;
    render(games);
  });

  window.downloader.onComplete((data) => {
    logLine("Загрузка завершена: " + data.gameId);
    if (!downloadState[data.gameId]) {
      downloadState[data.gameId] = {};
    }
    downloadState[data.gameId].status = "completed";
    downloadState[data.gameId].percent = 100;
    downloadState[data.gameId].filePath = data.filePath;
    render(games);
    alert("Файл скачан:\n" + data.filePath);
  });

  window.downloader.onError((data) => {
    logLine("Ошибка загрузки " + data.gameId + ": " + data.error);
    if (!downloadState[data.gameId]) {
      downloadState[data.gameId] = {};
    }
    downloadState[data.gameId].status = "error";
    downloadState[data.gameId].error = data.error;
    render(games);
    alert("Ошибка загрузки: " + data.error);
  });
}

/* ==========================================================
                       АПДЕЙТЕР (UI)
========================================================== */
let updatePanelTimeout = null;

if (window.updater) {
  window.updater.onAppVersion((v) => {
    if (appVersionLabel) appVersionLabel.textContent = "v " + v;
  });

  window.updater.onChecking(() => {
    logLine("Проверка обновлений...");
    if (updatePanelTimeout) clearTimeout(updatePanelTimeout);
    updatePanelTimeout = setTimeout(() => {
      if (updateWindow) {
        updateWindow.style.display = "block";
        updateWindow.classList.remove("check-complete");
        updateTitle.textContent = "Проверка обновлений…";
        updateText.textContent = "Подождите немного";
        updateBar.style.width = "0%";
        btnUpdateNow.style.display = "none";
      }
    }, 300);
  });

  window.updater.onAvailable((info) => {
    logLine("Найдено обновление v" + info.version);
    if (updatePanelTimeout) clearTimeout(updatePanelTimeout);
    if (!updateWindow) return;
    updateWindow.style.display = "block";
    updateTitle.textContent = "Доступно обновление";
    updateText.textContent = "Новая версия: v" + info.version;
    btnUpdateNow.style.display = "inline-block";
  });

  window.updater.onNotAvailable(() => {
    logLine("Обновлений нет — установлена последняя версия.");
    if (updatePanelTimeout) clearTimeout(updatePanelTimeout);
    if (updateWindow) updateWindow.style.display = "none";
  });

  window.updater.onError((err) => {
    logLine("Ошибка автообновления: " + err);
    if (updatePanelTimeout) clearTimeout(updatePanelTimeout);
    if (!updateWindow) return;
    updateWindow.style.display = "block";
    updateTitle.textContent = "Ошибка обновления";
    updateText.textContent =
      err || "Не удалось проверить обновление";
    btnUpdateNow.style.display = "none";
  });

  window.updater.onDownloadProgress((p) => {
    if (!updateWindow) return;
    updateTitle.textContent = "Скачивание обновления…";
    const percent = Math.round(p.percent || 0);
    updateBar.style.width = percent + "%";
  });

  window.updater.onDownloaded(() => {
    if (!updateWindow) return;
    updateTitle.textContent = "Завершено ✓";
    updateText.textContent =
      "Обновление скачано. Приложение скоро перезапустится…";
    updateWindow.classList.add("check-complete");
    updateBar.style.width = "100%";
    btnUpdateNow.style.display = "none";
  });

  if (btnUpdateNow) {
    btnUpdateNow.addEventListener("click", () => {
      btnUpdateNow.style.display = "none";
      updateText.textContent = "Скачивание обновления…";
      updateBar.style.width = "0%";
      window.updater.startUpdate();
    });
  }

  if (btnUpdateCancel) {
    btnUpdateCancel.addEventListener("click", () => {
      if (updateWindow) updateWindow.style.display = "none";
    });
  }
}

/* ==========================================================
                  НАСТРОЙКИ — МОДАЛКА + ТЕМЫ
========================================================== */
window.addEventListener("DOMContentLoaded", () => {
  const settingsBtn = document.getElementById("settingsBtn");
  const overlay = document.getElementById("settingsOverlay");
  const settingsWindow = document.getElementById("settingsWindow");
  const closeSettings = document.getElementById("closeSettings");
  const downloadPathEl = document.getElementById("downloadPath");
  const changeDownloadPathBtn = document.getElementById("changeDownloadPath");
  const updateStatusEl = document.getElementById("updateStatus");
  const checkUpdateBtn = document.getElementById("checkUpdateBtn");
  const applyUpdateBtn = document.getElementById("applyUpdateBtn");
  const themeButtons = document.querySelectorAll(".theme-btn");

  function applyTheme(theme) {
    const allowed = ["light", "dark", "neon"];
    const t = allowed.includes(theme) ? theme : "dark";

    document.body.classList.remove("theme-light", "theme-dark", "theme-neon");
    if (t === "light") {
      document.body.classList.add("theme-light");
    } else if (t === "neon") {
      document.body.classList.add("theme-neon");
    } else {
      document.body.classList.add("theme-dark");
    }

    themeButtons.forEach((btn) => {
      if (btn.dataset.theme === t) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  if (window.settings && window.settings.getTheme) {
    window.settings
      .getTheme()
      .then(applyTheme)
      .catch(() => applyTheme("dark"));
  } else {
    applyTheme("dark");
  }

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.theme;
      applyTheme(t);
      if (window.settings && window.settings.setTheme) {
        window.settings.setTheme(t);
      }
    });
  });

  if (settingsBtn && overlay && settingsWindow) {
    settingsBtn.addEventListener("click", () => {
      overlay.style.display = "flex";

      if (window.settings && window.settings.getDownloadPath && downloadPathEl) {
        window.settings.getDownloadPath().then((p) => {
          downloadPathEl.textContent = p;
        });
      }
    });
  }

  if (overlay && closeSettings) {
    closeSettings.addEventListener("click", () => {
      overlay.style.display = "none";
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.style.display = "none";
      }
    });
  }

  if (changeDownloadPathBtn && window.settings && window.settings.chooseFolder) {
    changeDownloadPathBtn.addEventListener("click", async () => {
      const newPath = await window.settings.chooseFolder();
      if (newPath && downloadPathEl) {
        downloadPathEl.textContent = newPath;
        if (window.settings.setDownloadPath) {
          window.settings.setDownloadPath(newPath);
        }
      }
    });
  }

  if (checkUpdateBtn && updateStatusEl && window.settings) {
    checkUpdateBtn.addEventListener("click", () => {
      updateStatusEl.textContent = "Проверка...";
      if (window.settings.manualCheckUpdate) {
        window.settings.manualCheckUpdate();
      }
    });

    if (window.settings.onChecking) {
      window.settings.onChecking(() => {
        updateStatusEl.textContent = "Проверка...";
        if (applyUpdateBtn) applyUpdateBtn.style.display = "none";
      });
    }
    if (window.settings.onAvailable) {
      window.settings.onAvailable((info) => {
        updateStatusEl.textContent = "Доступно обновление: v" + info.version;
        if (applyUpdateBtn) applyUpdateBtn.style.display = "inline-block";
      });
    }
    if (window.settings.onNotAvailable) {
      window.settings.onNotAvailable(() => {
        updateStatusEl.textContent = "Установлена последняя версия.";
        if (applyUpdateBtn) applyUpdateBtn.style.display = "none";
      });
    }
    if (window.settings.onError) {
      window.settings.onError((err) => {
        updateStatusEl.textContent = "Ошибка: " + err;
        if (applyUpdateBtn) applyUpdateBtn.style.display = "none";
      });
    }
  }

  if (applyUpdateBtn && window.settings && window.settings.startUpdate) {
    applyUpdateBtn.addEventListener("click", () => {
      window.settings.startUpdate();
      applyUpdateBtn.style.display = "none";
      if (updateStatusEl) {
        updateStatusEl.textContent = "Скачивание обновления…";
      }
    });
  }
});

/* ==========================================================
                 МОДАЛКА ОПИСАНИЯ И КОНСОЛЬ
========================================================== */
if (descModalClose) {
  descModalClose.addEventListener("click", () => {
    closeDescriptionModal();
  });
}
if (descModal) {
  descModal.addEventListener("click", (e) => {
    if (e.target === descModal) closeDescriptionModal();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDescriptionModal();
    if (consoleOverlay && consoleOverlay.style.display === "flex") {
      consoleOverlay.style.display = "none";
    }
  }
});

function toggleConsole() {
  if (!consoleOverlay) return;
  const visible = consoleOverlay.style.display === "flex";
  consoleOverlay.style.display = visible ? "none" : "flex";
  if (!visible && consoleInput) {
    consoleInput.focus();
  }
}

if (consoleCloseBtn) {
  consoleCloseBtn.addEventListener("click", () => toggleConsole());
}
if (consoleOverlay) {
  consoleOverlay.addEventListener("click", (e) => {
    if (e.target === consoleOverlay) toggleConsole();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "F10") {
    e.preventDefault();
    toggleConsole();
  }
});

if (consoleInput) {
  consoleInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const cmd = consoleInput.value.trim();
    if (!cmd) return;

    const lower = cmd.toLowerCase();
    const isSecret =
      lower === "/dabbyadmin1988pasha" ||
      lower === "/dabbyadmin1988pashaexit";

    if (!isSecret) {
      logLine("> " + cmd);
    }

    handleConsoleCommand(cmd);
    consoleInput.value = "";
  });
}

function handleConsoleCommand(cmd) {
  const lower = cmd.toLowerCase();

  if (lower === "/dabbyadmin1988pasha") {
    isAdminMode = true;
    if (adminPanel) adminPanel.style.display = "block";
    if (adminBubble) adminBubble.style.display = "none";
    if (consoleOverlay) consoleOverlay.style.display = "none";
    document.body.classList.add("admin-on");
    logLine("Скрытый режим: включён");
    render(games);
    return;
  }

  if (lower === "/dabbyadmin1988pashaexit") {
    isAdminMode = false;
    if (adminPanel) adminPanel.style.display = "none";
    if (adminBubble) adminBubble.style.display = "none";
    document.body.classList.remove("admin-on");
    logLine("Скрытый режим: выключен");
    render(games);
    return;
  }

  if (lower === "help" || lower === "?") {
    logLine("Доступные команды:");
    logLine("  help — показать эту справку");
    logLine("  games count — показать количество игр");
    logLine("  clear — очистить вывод");
    logLine("  panel on/off/toggle — показать/скрыть админ-панель");
    return;
  }

  if (lower === "clear") {
    if (consoleOutput) consoleOutput.innerHTML = "";
    return;
  }

  if (lower === "panel on" || lower === "panel off" || lower === "panel toggle") {
    const wantOn = lower === "panel on" || (lower === "panel toggle" && !isAdminMode);
    isAdminMode = wantOn;
    if (adminPanel) adminPanel.style.display = isAdminMode ? "block" : "none";
    if (adminBubble) adminBubble.style.display = "none";
    if (isAdminMode) {
      document.body.classList.add("admin-on");
    } else {
      document.body.classList.remove("admin-on");
    }
    logLine("Скрытый режим: " + (isAdminMode ? "включён" : "выключен"));
    render(games);
    return;
  }

  if (lower === "games count") {
    logLine("Сейчас игр: " + games.length);
    return;
  }

  logLine("Неизвестная команда. Напиши help.");
}


/* ==========================================================
                     БИБЛИОТЕКА ИГР (ЛОКАЛЬНАЯ)
========================================================== */

const tabButtons = document.querySelectorAll(".tab-btn");
const catalogSection = document.getElementById("catalogSection");
const librarySection = document.getElementById("librarySection");
const libraryListEl = document.getElementById("libraryList");
const libraryEmptyEl = document.getElementById("libraryEmpty");
const addLibraryGameBtn = document.getElementById("addLibraryGameBtn");

const libraryOverlay = document.getElementById("libraryOverlay");
const libraryWindow = document.getElementById("libraryWindow");
const libTitleInput = document.getElementById("libTitle");
const libExePathEl = document.getElementById("libExePath");
const libImagePathEl = document.getElementById("libImagePath");
const libChooseExeBtn = document.getElementById("libChooseExe");
const libChooseImageBtn = document.getElementById("libChooseImage");
const libCancelBtn = document.getElementById("libCancel");
const libSaveBtn = document.getElementById("libSave");
const librarySearchInput = document.getElementById("librarySearch");
const librarySortSelect = document.getElementById("librarySort");

let libraryGames = [];
let libraryEditingId = null;
let libraryCurrentSort = "date";

/**
 * Переключение вкладок Каталог / Библиотека
 */
function switchTab(tab) {
  if (tabButtons && tabButtons.length) {
    tabButtons.forEach((btn) => {
      const t = btn.getAttribute("data-tab");
      btn.classList.toggle("active", t === tab);
    });
  }

  if (catalogSection && librarySection) {
    catalogSection.classList.toggle("active", tab === "catalog");
    librarySection.classList.toggle("active", tab === "library");
  }

  if (tab === "library") {
    renderLibrary();
  }
}

// навесить обработчики на табы
if (tabButtons && tabButtons.length) {
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-tab") || "catalog";
      switchTab(t);
    });
  });
}

/**
 * Открыть модалку добавления / редактирования игры
 */
function openLibraryModal(isEdit, game) {
  if (!libraryOverlay || !libTitleInput || !libExePathEl || !libImagePathEl) return;

  libraryEditingId = isEdit && game ? game.id : null;

  libTitleInput.value = (game && game.title) || "";
  const exe = (game && game.exe) || "";
  const img = (game && game.img) || "";

  libExePathEl.textContent = exe || "Не выбрано";
  libExePathEl.dataset.path = exe || "";
  libImagePathEl.textContent = img || "Не выбрано";
  libImagePathEl.dataset.path = img || "";

  libraryOverlay.style.display = "flex";
}

function closeLibraryModal() {
  if (!libraryOverlay) return;
  libraryOverlay.style.display = "none";
}

if (libCancelBtn) {
  libCancelBtn.addEventListener("click", () => {
    closeLibraryModal();
  });
}

if (libraryOverlay) {
  libraryOverlay.addEventListener("click", (e) => {
    if (e.target === libraryOverlay) {
      closeLibraryModal();
    }
  });
}

if (addLibraryGameBtn) {
  addLibraryGameBtn.addEventListener("click", () => {
    openLibraryModal(false, null);
  });
}

// Выбор EXE
if (libChooseExeBtn && window.library && window.library.pickExe) {
  libChooseExeBtn.addEventListener("click", async () => {
    const p = await window.library.pickExe();
    if (!p) return;
    libExePathEl.textContent = p;
    libExePathEl.dataset.path = p;
  });
}

// Выбор картинки
if (libChooseImageBtn && window.library && window.library.pickImage) {
  libChooseImageBtn.addEventListener("click", async () => {
    const p = await window.library.pickImage();
    if (!p) return;
    libImagePathEl.textContent = p;
    libImagePathEl.dataset.path = p;
  });
}

// Сохранение игры (добавление / редактирование)
if (libSaveBtn) {
  libSaveBtn.addEventListener("click", async () => {
    if (!window.library || !window.library.save) return;

    const title = libTitleInput ? libTitleInput.value.trim() : "";
    const exePath = libExePathEl ? (libExePathEl.dataset.path || "").trim() : "";
    let imgPath = libImagePathEl ? (libImagePathEl.dataset.path || "").trim() : "";

    if (!title) {
      alert("Введите название игры");
      return;
    }
    if (!exePath) {
      alert("Выберите EXE файл игры");
      return;
    }

    // редактирование
    if (libraryEditingId) {
      const g = libraryGames.find((x) => x.id === libraryEditingId);
      if (g) {
        g.title = title;
        g.exe = exePath;
        if (imgPath) {
          g.img = imgPath;
        }
      }
    } else {
      // добавление новой
      const newId =
        "lib-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 6);

      // если картинка не выбрана — пытаемся достать иконку EXE
      if (!imgPath && window.library && window.library.extractIcon) {
        try {
          const iconPath = await window.library.extractIcon(exePath, newId);
          if (iconPath) imgPath = iconPath;
        } catch (err) {
          console.error("Ошибка извлечения иконки:", err);
        }
      }

      libraryGames.push({
        id: newId,
        title,
        exe: exePath,
        img: imgPath || null,
        running: false,
        addedAt: Date.now(),
        lastLaunch: null,
      });
    }

    try {
      await window.library.save(libraryGames);
    } catch (err) {
      console.error("Ошибка сохранения библиотеки:", err);
    }

    closeLibraryModal();
    renderLibrary();
  });
}

// Drag & Drop EXE на окно
document.addEventListener("dragover", (e) => {
  e.preventDefault();
});
document.addEventListener("drop", (e) => {
  e.preventDefault();
  const file =
    e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file || !file.path) return;

  const lower = file.path.toLowerCase();
  if (!lower.endsWith(".exe")) return;

  // Открываем модалку добавления с уже подставленным EXE
  openLibraryModal(false, {
    id: null,
    title: file.name.replace(/\.exe$/i, ""),
    exe: file.path,
    img: "",
  });
});
// Поиск и сортировка
if (librarySearchInput) {
  librarySearchInput.addEventListener("input", () => {
    renderLibrary();
  });
}
if (librarySortSelect) {
  librarySortSelect.addEventListener("change", () => {
    libraryCurrentSort = librarySortSelect.value || "date";
    renderLibrary();
  });
}

function getFilteredSortedLibrary() {
  let list = Array.isArray(libraryGames) ? [...libraryGames] : [];

  const q = librarySearchInput
    ? librarySearchInput.value.trim().toLowerCase()
    : "";
  if (q) {
    list = list.filter((g) =>
      (g.title || "").toLowerCase().includes(q)
    );
  }

  switch (libraryCurrentSort) {
    case "name":
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      break;
    case "launch":
      list.sort((a, b) => (b.lastLaunch || 0) - (a.lastLaunch || 0));
      break;
    case "date":
    default:
      list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      break;
  }

  return list;
}

function renderLibrary() {
  if (!libraryListEl || !libraryEmptyEl) return;

  const list = getFilteredSortedLibrary();

  libraryListEl.innerHTML = "";

  if (!list.length) {
    libraryEmptyEl.style.display = "flex";
    return;
  }
  libraryEmptyEl.style.display = "none";

  list.forEach((g) => {
    const card = document.createElement("div");
    card.className = "game-card";
    if (g.running) {
      card.classList.add("game-card-completed");
    }

    const thumb = document.createElement("div");
    thumb.className = "thumb";

    if (g.img) {
      let src = g.img;
      if (!src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("file://")) {
        src = "file:///" + src.replace(/\\/g, "/");
      }
      thumb.style.backgroundImage = "url('" + src + "')";
    } else {
      thumb.style.backgroundImage =
        "linear-gradient(135deg, #4f46e5, #0f172a)";
    }

    card.appendChild(thumb);

    const titleRow = document.createElement("div");
    titleRow.className = "game-title-row";

    const titleEl = document.createElement("div");
    titleEl.className = "game-title";
    titleEl.textContent = g.title || "Игра";
    titleRow.appendChild(titleEl);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "button-secondary";
    deleteBtn.style.width = "36px";
    deleteBtn.style.padding = "6px";
    deleteBtn.textContent = "🗑";
    deleteBtn.title = "Удалить игру";
    deleteBtn.addEventListener("click", () => {
      deleteLibraryGame(g.id);
    });
    titleRow.appendChild(deleteBtn);

    card.appendChild(titleRow);

    const meta = document.createElement("div");
    meta.className = "game-meta";
    const added = g.addedAt
      ? new Date(g.addedAt).toLocaleDateString()
      : "—";
    const last = g.lastLaunch
      ? new Date(g.lastLaunch).toLocaleString()
      : "Ещё не запускалась";
    meta.textContent = "Добавлено: " + added + " • Последний запуск: " + last;
    card.appendChild(meta);

    const footer = document.createElement("div");
    footer.className = "card-footer-row-top";

    const playBtn = document.createElement("button");
    playBtn.className = "button-primary";
    playBtn.textContent = g.running ? "Игра запущена…" : "Играть";
    playBtn.disabled = !!g.running;
    playBtn.addEventListener("click", () => {
      runLibraryGame(g.id);
    });

    footer.appendChild(playBtn);
    card.appendChild(footer);

    libraryListEl.appendChild(card);
  });
}

// Запуск игры
async function runLibraryGame(id) {
  const g = libraryGames.find((x) => x.id === id);
  if (!g || !window.library || !window.library.runExe) return;

  g.running = true;
  g.lastLaunch = Date.now();
  renderLibrary();

  try {
    const ok = await window.library.runExe(g.exe);
    if (!ok) {
      g.running = false;
      renderLibrary();
    }
  } catch (err) {
    console.error("Ошибка запуска игры:", err);
    g.running = false;
    renderLibrary();
  }
}

// Удаление игры
async function deleteLibraryGame(id) {
  if (!window.library || !window.library.save) return;
  if (!confirm("Удалить эту игру из библиотеки?")) return;

  libraryGames = libraryGames.filter((x) => x.id !== id);
  try {
    await window.library.save(libraryGames);
  } catch (err) {
    console.error("Ошибка сохранения после удаления:", err);
  }

  renderLibrary();
}

// Обработка события завершения процесса
if (window.library && window.library.onRunState) {
  window.library.onRunState((data) => {
    if (!data || !data.exe) return;
    const g = libraryGames.find((x) => x.exe === data.exe);
    if (!g) return;
    if (data.state === "closed") {
      g.running = false;
      renderLibrary();
      if (window.library && window.library.save) {
        window.library.save(libraryGames);
      }
    }
  });
}

// Загрузка библиотеки при старте
async function initLibrary() {
  if (!window.library || !window.library.load) return;
  try {
    const arr = await window.library.load();
    if (Array.isArray(arr)) {
      libraryGames = arr;
    } else {
      libraryGames = [];
    }
    renderLibrary();
  } catch (err) {
    console.error("Ошибка initLibrary:", err);
  }
}

/* ==========================================================
                     ИНИЦИАЛИЗАЦИЯ
========================================================== */
loadGames();
initLibrary();
