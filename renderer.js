/* =============================
      БАЗОВЫЕ ДАННЫЕ
============================= */

// Читаем игры из localStorage
let saved = localStorage.getItem("games");
let games = saved ? JSON.parse(saved) : [
  {
    id: 'cube-runner',
    title: 'Cube Runner',
    description: 'Мини-аркада: уклоняйся от препятствий и набирай очки.',
    genre: 'Аркада',
    platform: 'Windows',
    url: 'https://speed.hetzner.de/100MB.bin',
    thumb: 'https://dummyimage.com/640x360/24263a/ffffff&text=Cube+Runner'
  },
  {
    id: 'space-shooter',
    title: 'Space Shooter',
    description: 'Классический 2D-шутер в космосе с волнами врагов.',
    genre: 'Шутер',
    platform: 'Windows / Linux',
    url: 'https://speed.hetzner.de/100MB.bin',
    thumb: 'https://dummyimage.com/640x360/1d2833/ffffff&text=Space+Shooter'
  },
  {
    id: 'puzzle-lines',
    title: 'Neon Lines',
    description: 'Логическая игра: соедини все точки, не отрывая линию.',
    genre: 'Головоломка',
    platform: 'Windows',
    url: 'https://speed.hetzner.de/100MB.bin',
    thumb: 'https://dummyimage.com/640x360/222631/ffffff&text=Neon+Lines'
  }
];

// HTML элементы
const listEl = document.getElementById('gameList');
const emptyEl = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const countChip = document.getElementById('gamesCountChip');

// Admin UI
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
const admDeleteBtn = document.getElementById('admDeleteBtn');

// Admin state
let isAdminMode = false;
let editGameId = null;

// Download states
const downloadState = {}; // { [id]: {status, percent, speed} }


/* =============================
      ГЛАВНЫЙ РЕНДЕР КАРТОЧЕК
============================= */

function render(list) {
  listEl.innerHTML = '';

  if (!list.length) {
    emptyEl.style.display = 'block';
    countChip.textContent = "0 игр";
    return;
  }

  emptyEl.style.display = 'none';
  countChip.textContent = list.length + " " + pluralize(list.length);

  for (const g of list) {
    const wrap = document.createElement('div');
    wrap.className = "game-card";

    // Жанр
    const tag = document.createElement('div');
    tag.className = "game-tag";
    tag.textContent = g.genre || "Игра";
    wrap.appendChild(tag);

    // Картинка
    const img = document.createElement('div');
    img.className = "thumb";
    img.style.backgroundImage = `url('${g.thumb}')`;
    wrap.appendChild(img);

    // Название
    const ttl = document.createElement('div');
    ttl.className = "game-title";
    ttl.textContent = g.title;
    wrap.appendChild(ttl);

    // Платформа
    const meta = document.createElement('div');
    meta.className = "game-meta";
    meta.textContent = g.platform;
    wrap.appendChild(meta);

    // Описание
    const desc = document.createElement('div');
    desc.className = "game-desc";
    desc.textContent = g.description;
    wrap.appendChild(desc);

    // Footer
    const footer = document.createElement('div');
    footer.className = "card-footer";

    // Кнопка скачать
    const btn = document.createElement('button');
    btn.className = "button-primary";
    btn.dataset.gameId = g.id;

    const st = downloadState[g.id] || { status: "idle" };
    if (st.status === "downloading") {
      btn.textContent = "Загрузка " + (st.percent || 0) + "%";
      btn.disabled = true;
    } else if (st.status === "completed") {
      btn.textContent = "Скачано ✔";
    } else {
      btn.textContent = "Скачать игру";
    }

    btn.onclick = () => startDownload(g);
    footer.appendChild(btn);

    // Free-to-play + gear
    const right = document.createElement('div');
    right.className = "footer-right";

    const chip = document.createElement('div');
    chip.className = "chip";
    chip.textContent = "Free to play";
    right.appendChild(chip);

    const gear = document.createElement('button');
    gear.className = "gear-btn";
    gear.innerHTML = "⚙";
    gear.onclick = () => isAdminMode && openAdminPanel(g.id);
    right.appendChild(gear);

    footer.appendChild(right);
    wrap.appendChild(footer);

    // Status
    const stEl = document.createElement('div');
    stEl.className = "download-status";

    if (st.status === "downloading")
      stEl.textContent = `Загрузка ${st.percent}%`;
    else if (st.status === "completed")
      stEl.textContent = "Файл скачан.";
    else if (st.status === "error")
      stEl.textContent = "Ошибка загрузки";
    wrap.appendChild(stEl);

    listEl.appendChild(wrap);
  }
}


/* =============================
      ПОИСК
============================= */

searchInput.oninput = function () {
  const q = this.value.trim().toLowerCase();
  if (!q) render(games);
  else render(games.filter(g =>
    g.title.toLowerCase().includes(q) ||
    g.description.toLowerCase().includes(q) ||
    g.genre.toLowerCase().includes(q)
  ));
};


/* =============================
      ЗАГРУЗКА ИГРЫ
============================= */

function startDownload(g) {
  downloadState[g.id] = { status: "downloading", percent: 0 };
  render(games);

  const safeName = g.title.replace(/[^a-z0-9]/gi, "_") + ".bin";

  window.downloader.downloadGame({
    url: g.url,
    fileName: safeName,
    gameId: g.id
  });
}

window.downloader.onProgress((d) => {
  downloadState[d.gameId] = {
    status: "downloading",
    percent: d.percent || 0,
    speed: d.speed
  };
  render(games);
});

window.downloader.onComplete(({ gameId }) => {
  downloadState[gameId] = { status: "completed", percent: 100 };
  render(games);
});

window.downloader.onError(({ gameId, error }) => {
  downloadState[gameId] = { status: "error", error };
  render(games);
  alert("Ошибка загрузки: " + error);
});


/* =============================
      ADMIN MODE (SECRET)
============================= */

let buffer = "";

document.addEventListener("keydown", (e) => {
  if (e.key.length === 1) buffer += e.key;
  if (buffer.length > 40) buffer = buffer.slice(-40);

  if (buffer.includes("/dabbyadmin1988pasha")) {
    buffer = "";
    toggleAdmin();
  }
});

function toggleAdmin() {
  isAdminMode = !isAdminMode;

  if (isAdminMode) {
    document.body.classList.add("admin-on");
    adminPanel.style.display = "block";
  } else {
    document.body.classList.remove("admin-on");
    adminPanel.style.display = "none";
    clearAdminForm();
  }

  render(games);
}


/* =============================
      АДМИН ПАНЕЛЬ (CRUD)
============================= */

function clearAdminForm() {
  admTitle.value = "";
  admDesc.value = "";
  admGenre.value = "";
  admPlatform.value = "";
  admThumb.value = "";
  admURL.value = "";
}

function openAdminPanel(id) {
  const g = games.find(x => x.id === id);
  if (!g) return;

  editGameId = id;

  admTitle.value = g.title;
  admDesc.value = g.description;
  admGenre.value = g.genre;
  admPlatform.value = g.platform;
  admThumb.value = g.thumb;
  admURL.value = g.url;

  admSubmitBtn.textContent = "Сохранить";
  admDeleteBtn.style.display = "block";

  adminPanel.style.display = "block";
}


// Добавление / сохранение
admSubmitBtn.onclick = () => {
  const data = {
    title: admTitle.value,
    description: admDesc.value,
    genre: admGenre.value,
    platform: admPlatform.value,
    thumb: admThumb.value,
    url: admURL.value
  };

  if (!data.title || !data.url) {
    return alert("Название и URL обязательны!");
  }

  if (editGameId) {
    // EDIT
    const idx = games.findIndex(g => g.id === editGameId);
    games[idx] = { ...games[idx], ...data };
  } else {
    // ADD
    games.push({
      id: "game-" + Date.now(),
      ...data
    });
  }

  localStorage.setItem("games", JSON.stringify(games));
  render(games);

  editGameId = null;
  admDeleteBtn.style.display = "none";
  admSubmitBtn.textContent = "Добавить игру";
  clearAdminForm();
};


// Удаление игры
admDeleteBtn.onclick = () => {
  if (!editGameId) return;

  if (!confirm("Удалить игру?")) return;

  games = games.filter(g => g.id !== editGameId);
  localStorage.setItem("games", JSON.stringify(games));

  render(games);
  clearAdminForm();

  admDeleteBtn.style.display = "none";
  admSubmitBtn.textContent = "Добавить игру";
  editGameId = null;

  adminPanel.style.display = "none";
};


// Минимизировать
adminMinimizeBtn.onclick = () => {
  adminPanel.style.display = "none";
  adminBubble.style.display = "flex";
};
adminBubble.onclick = () => {
  adminPanel.style.display = "block";
  adminBubble.style.display = "none";
};


/* =============================
      HELPERS
============================= */

function pluralize(n) {
  if (n % 10 === 1 && n % 100 !== 11) return "игра";
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100))
    return "игры";
  return "игр";
}


/* =============================
      INITIAL RENDER
============================= */
render(games);
