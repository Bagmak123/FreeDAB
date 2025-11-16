/* ==========================================================
                     НАСТРОЙКИ GITHUB API
========================================================== */
const GITHUB_OWNER = "Bagmak123";
const GITHUB_REPO = "FreeDAB";
const GAMES_FILE = "games.json";

// ↓↓↓ ТОКЕН ПОДСТАВИТ MAIN.JS (через preload)
let githubToken = null;

/* ==========================================================
                 ЭЛЕМЕНТЫ ИНТЕРФЕЙСА
========================================================== */
const listEl = document.getElementById('gameList');
const emptyEl = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const countChip = document.getElementById('gamesCountChip');

const adminPanel = document.getElementById('adminPanel');
const adminHeader = document.getElementById('adminHeader');
const adminMinimizeBtn = document.getElementById('adminMinimizeBtn');
const adminBubble = document.getElementById('adminBubble');

const admTitle = document.getElementById('admTitle');
const admDesc = document.getElementById('admDesc');
const admGenre = document.getElementById('admGenre');
const admPlatform = document.getElementById('admPlatform');
const admThumb = document.getElementById('admThumb');
const admURL = document.getElementById('admURL');
const admSubmitBtn = document.getElementById('admSubmitBtn');

let games = [];
let editingGameId = null;
let isAdminMode = false;

const downloadState = {}; // { id: {status, percent, speed, filePath} }

/* ==========================================================
                       ЗАГРУЗКА ИГР
========================================================== */
async function loadGames() {
  try {
    const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/games.json`;
    const res = await fetch(url);
    games = await res.json();

    localStorage.setItem("cached_games", JSON.stringify(games));

    render(games);
    return true;
  } catch (err) {
    console.warn("Не удалось загрузить игры с GitHub. Используем кэш.", err);
    const cached = localStorage.getItem("cached_games");
    if (cached) {
      games = JSON.parse(cached);
      render(games);
      return true;
    }
    return false;
  }
}

/* ==========================================================
                       СОХРАНЕНИЕ ИГР
========================================================== */
async function saveGamesToGitHub() {
  if (!githubToken) {
    alert("Ошибка: GH_TOKEN недоступен.");
    return;
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GAMES_FILE}`;

  const getRes = await fetch(apiUrl);
  const getJson = await getRes.json();
  const sha = getJson.sha;

  const updatedContent = btoa(unescape(encodeURIComponent(JSON.stringify(games, null, 2))));

  await fetch(apiUrl, {
    method: "PUT",
    headers: {
      "Authorization": `token ${githubToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "update games.json automatically",
      content: updatedContent,
      sha
    })
  });

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
  countChip.textContent = list.length + " игр";

  list.forEach(game => {
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
    thumb.style.backgroundImage = `url('${game.thumb}')`;
    card.appendChild(thumb);

    // заголовок
    const title = document.createElement("div");
    title.className = "game-title";
    title.textContent = game.title;
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
      btn.textContent = `${state.percent || 0}%`;
      btn.disabled = true;
    } else if (state.status === "completed") {
      btn.textContent = "Скачано ✓";
    } else {
      btn.textContent = "Скачать";
    }

    btn.addEventListener("click", () => startDownload(game));
    footer.appendChild(btn);

    // блок справа
    const right = document.createElement("div");
    right.className = "footer-right";

    // чип
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = "Free";
    right.appendChild(chip);

    // шестерёнка (редактировать)
    const gear = document.createElement("button");
    gear.className = "gear-btn";
    gear.innerHTML = "⚙";
    gear.addEventListener("click", () => {
      if (!isAdminMode) return;
      startEditGame(game.id);
    });
    right.appendChild(gear);

    // кнопка удалить
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
      del.addEventListener("click", () => deleteGame(game.id));
      right.appendChild(del);
    }

    footer.appendChild(right);
    card.appendChild(footer);

    listEl.appendChild(card);
  });
}

/* ==========================================================
                       УДАЛЕНИЕ ИГРЫ
========================================================== */
function deleteGame(id) {
  if (!confirm("Удалить игру?")) return;

  games = games.filter(g => g.id !== id);
  render(games);

  saveGamesToGitHub();
}

/* ==========================================================
                       ДОБАВЛЕНИЕ / РЕДАКТИРОВАНИЕ
========================================================== */
function startEditGame(id) {
  const g = games.find(x => x.id === id);
  if (!g) return;

  editingGameId = id;

  admTitle.value = g.title;
  admDesc.value = g.description;
  admGenre.value = g.genre;
  admPlatform.value = g.platform;
  admThumb.value = g.thumb;
  admURL.value = g.url;

  admSubmitBtn.textContent = "Сохранить";
}

function submitAdmin() {
  const game = {
    title: admTitle.value.trim(),
    description: admDesc.value.trim(),
    genre: admGenre.value.trim(),
    platform: admPlatform.value.trim(),
    url: admURL.value.trim(),
    thumb: admThumb.value.trim()
  };

  if (editingGameId) {
    const idx = games.findIndex(g => g.id === editingGameId);
    games[idx] = { ...games[idx], ...game };
    editingGameId = null;
  } else {
    game.id = "game-" + Date.now();
    games.push(game);
  }

  clearAdmin();
  render(games);
  saveGamesToGitHub();
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
  const q = searchInput.value.toLowerCase();
  const filtered = games.filter(g =>
    g.title.toLowerCase().includes(q) ||
    g.description.toLowerCase().includes(q)
  );
  render(filtered);
});

/* ==========================================================
                       СЕКРЕТНАЯ ФРАЗА
========================================================== */
let buffer = "";
document.addEventListener("keydown", e => {
  if (e.key.length === 1) buffer += e.key;
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
  const safeName = (game.title.replace(/[^a-z0-9_-]/gi, "_") + ".zip").slice(0, 40);

  downloadState[game.id] = { status: "downloading", percent: 0 };
  render(games);

  window.downloader.downloadGame({
    url: game.url,
    fileName: safeName,
    gameId: game.id
  });
}

window.downloader.onProgress(data => {
  const st = downloadState[data.gameId];
  st.status = "downloading";
  st.percent = data.percent;
  st.speed = data.speed;

  render(games);
});

window.downloader.onComplete(data => {
  downloadState[data.gameId].status = "completed";
  render(games);
  alert("Файл скачан:\n" + data.filePath);
});

window.downloader.onError(data => {
  downloadState[data.gameId].status = "error";
  render(games);
  alert("Ошибка загрузки: " + data.error);
});

/* ==========================================================
                       АПДЕЙТЕР (UI)
========================================================== */
if (window.updater) {
  window.updater.onAppVersion(v => {
    document.getElementById("appVersion").textContent = "v " + v;
  });

  window.updater.onChecking(() => {
    document.getElementById("updateWindow").style.display = "block";
  });

  window.updater.onAvailable(info => {
    document.getElementById("updateTitle").textContent = "Доступно обновление";
    document.getElementById("updateText").textContent = "v" + info.version;
    document.getElementById("updateNow").style.display = "block";
  });

  window.updater.onDownloadProgress(p => {
    document.getElementById("updateBar").style.width = p.percent + "%";
  });

  window.updater.onDownloaded(() => {
    document.getElementById("updateTitle").textContent = "Завершено ✓";
    document.getElementById("updateBar").style.width = "100%";
  });

  document.getElementById("updateNow").onclick = () => {
    window.updater.startUpdate();
  };

  document.getElementById("updateCancel").onclick = () => {
    document.getElementById("updateWindow").style.display = "none";
  };
}

/* ==========================================================
                  НАСТРОЙКИ — ОТКРЫТИЕ ОКНА
========================================================== */
document.getElementById("settingsBtn")?.addEventListener("click", () => {
  window.settings.open();
});

/* ==========================================================
                     ИНИЦИАЛИЗАЦИЯ
========================================================== */
loadGames();
