/* ==========================================================
                     НАСТРОЙКИ GITHUB API
========================================================== */
const GITHUB_OWNER = "Bagmak123";
const GITHUB_REPO = "FreeDAB";
const GAMES_FILE = "games.json";

// ↓↓↓ сюда (при желании) можно пробросить токен из preload
let githubToken = null;

/* ────────────────────────────────────────────────────────
   ДЕФОЛТНЫЙ СПИСОК ИГР (на случай, если GitHub недоступен)
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

const admTitle = document.getElementById("admTitle");
const admDesc = document.getElementById("admDesc");
const admGenre = document.getElementById("admGenre");
const admPlatform = document.getElementById("admPlatform");
const admThumb = document.getElementById("admThumb");
const admURL = document.getElementById("admURL");
const admSubmitBtn = document.getElementById("admSubmitBtn");

const updateWindow = document.getElementById("updateWindow");
const updateTitle = document.getElementById("updateTitle");
const updateText = document.getElementById("updateText");
const updateBar = document.getElementById("updateBar");
const btnUpdateNow = document.getElementById("updateNow");
const btnUpdateCancel = document.getElementById("updateCancel");
const appVersionLabel = document.getElementById("appVersion");

let games = [];
let editingGameId = null;
let isAdminMode = false;

const downloadState = {}; // { id: {status, percent, speed, filePath} }

/* ==========================================================
                       ХЕЛПЕРЫ
========================================================== */
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
  // поддерживаем оба формата: [ {...} ] или { games: [ {...} ] }
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.games)) return json.games;
  throw new Error("Неверный формат games.json");
}

async function loadGames() {
  try {
    const remote = await loadGamesFromGitHub();
    games = remote;
    localStorage.setItem("cached_games", JSON.stringify(games));
    render(games);
    return;
  } catch (err) {
    console.warn("Не удалось загрузить игры с GitHub:", err);
  }

  // пробуем кэш
  try {
    const cached = localStorage.getItem("cached_games");
    if (cached) {
      games = JSON.parse(cached);
      render(games);
      return;
    }
  } catch (e) {
    console.warn("Ошибка чтения кэша игр:", e);
  }

  // последний шанс — дефолтный список
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

  // сначала узнаём SHA файла (если он уже есть)
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
  countChip.textContent =
    list.length + " " + pluralizeGames(list.length);

  list.forEach((game) => {
    const card = document.createElement("div");
    card.className = "game-card";

    // тег жанра
    const tag = document.createElement("div");
    tag.className = "game-tag";
    tag.textContent = game.genre || "Игра";
    card.appendChild(tag);

    // миниатюра
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (game.thumb) {
      thumb.style.backgroundImage = `url('${game.thumb}')`;
    } else {
      thumb.style.backgroundImage =
        "linear-gradient(135deg,#303952,#596275)";
    }
    card.appendChild(thumb);

    // заголовок
    const title = document.createElement("div");
    title.className = "game-title";
    title.textContent = game.title || "Без названия";
    card.appendChild(title);

    // платформа
    const meta = document.createElement("div");
    meta.className = "game-meta";
    meta.textContent = game.platform || "";
    card.appendChild(meta);

    // описание
    const desc = document.createElement("div");
    desc.className = "game-desc";
    desc.textContent = game.description || "";
    card.appendChild(desc);

    // футер
    const footer = document.createElement("div");
    footer.className = "card-footer";

    // кнопка скачать
    const btn = document.createElement("button");
    btn.className = "button-primary";

    const state = downloadState[game.id] || { status: "idle" };

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
      btn.textContent = "Скачать игру";
      btn.disabled = false;
    }

    btn.addEventListener("click", () => startDownload(game));
    footer.appendChild(btn);

    // блок справа
    const right = document.createElement("div");
    right.className = "footer-right";

    // чип
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = "Free to play";
    right.appendChild(chip);

    // шестерёнка (редактировать)
    const gear = document.createElement("button");
    gear.className = "gear-btn";
    gear.innerHTML = "⚙";
    gear.title = "Редактировать игру";
    gear.addEventListener("click", () => {
      if (!isAdminMode) return;
      startEditGame(game.id);
    });
    right.appendChild(gear);

    // кнопка удалить (только в админ-режиме)
    if (isAdminMode) {
      const del = document.createElement("button");
      del.textContent = "🗑";
      del.style.cssText = `
        background:red;
        border:none;
        color:white;
        border-radius:8px;
        padding:4px 8px;
        cursor:pointer;
      `;
      del.title = "Удалить игру";
      del.addEventListener("click", () => deleteGame(game.id));
      right.appendChild(del);
    }

    footer.appendChild(right);
    card.appendChild(footer);

    // статус загрузки
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
  if (!confirm("Удалить игру?")) return;

  games = games.filter((g) => g.id !== id);
  render(games);

  // пробуем сохранить на GitHub (если есть токен)
  saveGamesToGitHub().catch((e) =>
    console.error("Ошибка сохранения игр:", e)
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
  admPlatform.value = g.platform || "";
  admThumb.value = g.thumb || "";
  admURL.value = g.url || "";

  admSubmitBtn.textContent = "Сохранить";
}

function submitAdmin() {
  const game = {
    title: admTitle.value.trim() || "Без названия",
    description: admDesc.value.trim(),
    genre: admGenre.value.trim(),
    platform: admPlatform.value.trim(),
    url: admURL.value.trim(),
    thumb: admThumb.value.trim()
  };

  if (editingGameId) {
    const idx = games.findIndex((g) => g.id === editingGameId);
    if (idx !== -1) {
      games[idx] = { ...games[idx], ...game };
    }
    editingGameId = null;
  } else {
    game.id = "game-" + Date.now();
    games.push(game);
  }

  clearAdmin();
  render(games);

  saveGamesToGitHub().catch((e) =>
    console.error("Ошибка сохранения игр:", e)
  );
}

function clearAdmin() {
  admTitle.value = "";
  admDesc.value = "";
  admGenre.value = "";
  admPlatform.value = "";
  admThumb.value = "";
  admURL.value = "";
  admSubmitBtn.textContent = "Добавить";
}

admSubmitBtn.addEventListener("click", submitAdmin);

/* ==========================================================
                       ПОИСК
========================================================== */
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

/* ==========================================================
                       СЕКРЕТНАЯ ФРАЗА
========================================================== */
let buffer = "";
document.addEventListener("keydown", (e) => {
  if (e.key.length === 1) buffer += e.key;
  if (buffer.length > 40) buffer = buffer.slice(-40);

  if (buffer.includes("/dabbyadmin1988pasha")) {
    isAdminMode = !isAdminMode;
    buffer = "";
    render(games);
    adminPanel.style.display = isAdminMode ? "block" : "none";
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
    // небольшая задержка, чтобы не было "мигания"
    if (updatePanelTimeout) clearTimeout(updatePanelTimeout);
    updatePanelTimeout = setTimeout(() => {
      if (updateWindow) {
        updateWindow.style.display = "block";
        updateTitle.textContent = "Проверка обновлений…";
        updateText.textContent = "Подождите немного";
        updateBar.style.width = "0%";
        btnUpdateNow.style.display = "none";
      }
    }, 300);
  });

  window.updater.onAvailable((info) => {
    if (updatePanelTimeout) clearTimeout(updatePanelTimeout);
    if (!updateWindow) return;
    updateWindow.style.display = "block";
    updateTitle.textContent = "Доступно обновление";
    updateText.textContent = "Новая версия: v" + info.version;
    btnUpdateNow.style.display = "inline-block";
  });

  window.updater.onNotAvailable(() => {
    if (updatePanelTimeout) clearTimeout(updatePanelTimeout);
    if (updateWindow) updateWindow.style.display = "none";
  });

  window.updater.onError((err) => {
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
                  НАСТРОЙКИ — ОТКРЫТИЕ ОКНА
========================================================== */
document.getElementById("settingsBtn")?.addEventListener("click", () => {
  if (window.settings && window.settings.open) {
    window.settings.open();
  }
});

/* ==========================================================
                     ИНИЦИАЛИЗАЦИЯ
========================================================== */
loadGames();
