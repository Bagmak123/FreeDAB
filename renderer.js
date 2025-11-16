const games = [
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

let isAdminMode = false;
let editingGameId = null;

// состояние загрузки по id игры
const downloadState = {}; // { [id]: { status, percent, filePath } }

function render(gamesToRender) {
  listEl.innerHTML = '';
  if (!gamesToRender.length) {
    emptyEl.style.display = 'block';
    countChip.textContent = '0 игр';
    return;
  }
  emptyEl.style.display = 'none';
  countChip.textContent = gamesToRender.length + ' ' + pluralizeGames(gamesToRender.length);

  for (const g of gamesToRender) {
    const card = document.createElement('div');
    card.className = 'game-card';

    const tag = document.createElement('div');
    tag.className = 'game-tag';
    tag.textContent = g.genre || 'Игра';
    card.appendChild(tag);

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (g.thumb) {
      thumb.style.backgroundImage = `url('${g.thumb}')`;
    } else {
      thumb.style.backgroundImage = "linear-gradient(135deg,#303952,#596275)";
    }
    card.appendChild(thumb);

    const title = document.createElement('div');
    title.className = 'game-title';
    title.textContent = g.title;
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'game-meta';
    meta.textContent = g.platform || '';
    card.appendChild(meta);

    const desc = document.createElement('div');
    desc.className = 'game-desc';
    desc.textContent = g.description || '';
    card.appendChild(desc);

    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const btn = document.createElement('button');
    btn.className = 'button-primary';
    btn.dataset.gameId = g.id;

    const state = downloadState[g.id] || { status: 'idle', percent: 0 };

    if (state.status === 'downloading') {
      btn.textContent = state.percent != null ? `Загрузка ${state.percent}%` : 'Загрузка...';
      btn.disabled = true;
    } else if (state.status === 'completed') {
      btn.textContent = 'Скачано (смотреть в Загрузках)';
      btn.disabled = false;
    } else if (state.status === 'error') {
      btn.textContent = 'Ошибка — попробовать ещё';
      btn.disabled = false;
    } else {
      btn.textContent = 'Скачать игру';
      btn.disabled = false;
    }

    btn.addEventListener('click', () => {
      handleDownloadClick(g);
    });
    footer.appendChild(btn);

    const right = document.createElement('div');
    right.className = 'footer-right';

    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = 'Free to play';
    right.appendChild(chip);

    const gear = document.createElement('button');
    gear.className = 'gear-btn';
    gear.type = 'button';
    gear.innerHTML = '⚙';
    gear.title = 'Редактировать игру';
    gear.addEventListener('click', () => {
      if (!isAdminMode) return;
      startEditGame(g.id);
    });
    right.appendChild(gear);

    footer.appendChild(right);

    card.appendChild(footer);

    const statusEl = document.createElement('div');
    statusEl.className = 'download-status';
    if (state.status === 'downloading') {
      const mbps = state.speed ? (state.speed / 1024 / 1024).toFixed(2) : null;
      if (state.percent != null) {
        statusEl.textContent = mbps
          ? `Загрузка: ${state.percent}% · ${mbps} МБ/с`
          : `Загрузка: ${state.percent}%`;
      } else {
        statusEl.textContent = mbps
          ? `Загрузка... · ${mbps} МБ/с`
          : 'Загрузка...';
      }
    } else if (state.status === 'completed') {
      statusEl.textContent = 'Файл скачан. Открой папку Загрузки.';
    } else if (state.status === 'error') {
      statusEl.textContent = 'Ошибка загрузки: ' + (state.error || '');
    } else {
      statusEl.textContent = '';
    }
    card.appendChild(statusEl);

    listEl.appendChild(card);
  }
}

function handleDownloadClick(game) {
  const state = downloadState[game.id] || { status: 'idle' };

  if (state.status === 'downloading') {
    return;
  }

  // просто повторно скачать, даже если уже скачано
  const safeName = (game.title || 'game')
    .replace(/[^a-zA-Z0-9_\-]+/g, '_')
    .slice(0, 40) + '.bin';

  if (!game.url) {
    alert('Для этой игры не указана ссылка на файл.');
    return;
  }

  downloadState[game.id] = { status: 'downloading', percent: 0 };
  render(games);

  window.downloader.downloadGame({
    url: game.url,
    fileName: safeName,
    gameId: game.id
  });
}

function pluralizeGames(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'игра';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'игры';
  return 'игр';
}

function handleSearch() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    render(games);
    return;
  }
  const filtered = games.filter(g =>
    g.title.toLowerCase().includes(q) ||
    (g.description && g.description.toLowerCase().includes(q)) ||
    (g.genre && g.genre.toLowerCase().includes(q))
  );
  render(filtered);
}

searchInput.addEventListener('input', handleSearch);

// SECRET PHRASE: /dabbyadmin1988pasha
let secretBuffer = '';

document.addEventListener('keydown', (e) => {
  if (e.key.length === 1) {
    secretBuffer += e.key;
    if (secretBuffer.length > 40) {
      secretBuffer = secretBuffer.slice(-40);
    }
  } else if (e.key === 'Backspace') {
    secretBuffer = secretBuffer.slice(0, -1);
  }

  if (secretBuffer.includes('/dabbyadmin1988pasha')) {
    toggleAdminMode();
    secretBuffer = '';
  }
});

function toggleAdminMode() {
  isAdminMode = !isAdminMode;
  if (isAdminMode) {
    document.body.classList.add('admin-on');
    adminPanel.style.display = 'block';
    adminBubble.style.display = 'none';
  } else {
    document.body.classList.remove('admin-on');
    adminPanel.style.display = 'none';
    adminBubble.style.display = 'none';
    editingGameId = null;
    clearAdminForm();
    admSubmitBtn.textContent = 'Добавить игру';
  }
  // обновляем видимость шестерёнок
  render(games);
}

// Admin form logic
function clearAdminForm() {
  admTitle.value = '';
  admDesc.value = '';
  admGenre.value = '';
  admPlatform.value = '';
  admThumb.value = '';
  admURL.value = '';
}

function startEditGame(id) {
  const g = games.find(game => game.id === id);
  if (!g) return;

  editingGameId = id;
  admTitle.value = g.title || '';
  admDesc.value = g.description || '';
  admGenre.value = g.genre || '';
  admPlatform.value = g.platform || '';
  admThumb.value = g.thumb || '';
  admURL.value = g.url || '';

  admSubmitBtn.textContent = 'Сохранить изменения';

  if (isAdminMode) {
    adminPanel.style.display = 'block';
    adminBubble.style.display = 'none';
  }
}

function submitAdminForm() {
  const payload = {
    title: admTitle.value.trim() || 'Без названия',
    description: admDesc.value.trim(),
    genre: admGenre.value.trim(),
    platform: admPlatform.value.trim(),
    url: admURL.value.trim(),
    thumb: admThumb.value.trim()
  };

  if (editingGameId) {
    const idx = games.findIndex(g => g.id === editingGameId);
    if (idx !== -1) {
      games[idx] = { ...games[idx], ...payload };
    }
    editingGameId = null;
    admSubmitBtn.textContent = 'Добавить игру';
  } else {
    const newGame = {
      id: 'game-' + Date.now(),
      ...payload
    };
    games.push(newGame);
  }

  render(games);
  clearAdminForm();
  alert('Изменения сохранены!');
}

admSubmitBtn.addEventListener('click', submitAdminForm);

// Minimize admin panel to bubble
adminMinimizeBtn.addEventListener('click', () => {
  if (!isAdminMode) return;
  adminPanel.style.display = 'none';
  adminBubble.style.display = 'flex';
});

adminBubble.addEventListener('click', () => {
  if (!isAdminMode) return;
  adminPanel.style.display = 'block';
  adminBubble.style.display = 'none';
});

// Drag logic
function makeDraggable(element, handle) {
  let isDown = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener('mousedown', (e) => {
    isDown = true;
    const rect = element.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    element.style.right = 'auto';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mouseup', () => {
    isDown = false;
    document.body.style.userSelect = '';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    element.style.left = x + 'px';
    element.style.top = y + 'px';
  });
}

makeDraggable(adminPanel, adminHeader);
makeDraggable(adminBubble, adminBubble);

// Download callbacks from main process
window.downloader.onProgress(({ gameId, downloaded, total, speed, percent }) => {
  if (!downloadState[gameId]) downloadState[gameId] = {};
  downloadState[gameId].status = 'downloading';

  if (typeof percent === 'number') {
    downloadState[gameId].percent = percent;
  } else if (total && total > 0) {
    downloadState[gameId].percent = Math.round((downloaded / total) * 100);
  }

  if (typeof speed === 'number') {
    downloadState[gameId].speed = speed; // bytes per second
  }

  render(games);
});

window.downloader.onComplete(({ gameId, filePath }) => {
  if (!downloadState[gameId]) downloadState[gameId] = {};
  downloadState[gameId].status = 'completed';
  downloadState[gameId].percent = 100;
  downloadState[gameId].filePath = filePath;
  render(games);
  alert('Файл скачан в папку Загрузки.\n' + filePath);
});

window.downloader.onError(({ gameId, error }) => {
  if (!downloadState[gameId]) downloadState[gameId] = {};
  downloadState[gameId].status = 'error';
  downloadState[gameId].error = error;
  render(games);
  alert('Ошибка загрузки: ' + error);
});

// initial render
render(games);
