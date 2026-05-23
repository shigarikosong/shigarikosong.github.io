// ===== 要素の取得 =====
    const fixedPlayerEl = document.getElementById('fixedPlayer');
    const playerIframe = document.getElementById('playerIframe');
    const youtubePlayerEl = document.getElementById('youtubePlayer');
    const tiktokPlayerEl = document.getElementById('tiktokPlayer');
    const playerFrameWrapper = document.getElementById('playerFrameWrapper');
    const resizeHandle = document.getElementById('playerResizeHandle');
    const closeBtn = document.getElementById('closePlayerBtn');
    const searchInput = document.getElementById('searchInput');
    const sortOrder = document.getElementById('sortOrder');
    const resetButton = document.getElementById('resetFilters');
    const videoList = document.getElementById('videoList');
    const activeTagChips = document.getElementById('activeTagChips');
    const activeTagChipsInner = document.getElementById('activeTagChipsInner');
    const filterSection = document.getElementById('filterSection');


// ===== プレイヤー操作モードの設定 =====
    const REPEAT_MODE_KEY = 'playerRepeatMode';
    const RANDOM_MODE_KEY = 'playerRandomModeEnabled';
    const LEGACY_RANDOM_AUTO_PLAY_KEY = 'randomAutoPlayEnabled';
    const REPEAT_MODE_ALL = 'all';
    const REPEAT_MODE_ONE = 'one';
    const REPEAT_MODE_OFF = 'off';
    const REPEAT_MODE_SEQUENCE = [REPEAT_MODE_ALL, REPEAT_MODE_ONE, REPEAT_MODE_OFF];

function getRepeatMode() {
  const mode = localStorage.getItem(REPEAT_MODE_KEY);
  return REPEAT_MODE_SEQUENCE.includes(mode) ? mode : REPEAT_MODE_OFF;
}

function setRepeatMode(mode) {
  const nextMode = REPEAT_MODE_SEQUENCE.includes(mode) ? mode : REPEAT_MODE_OFF;
  localStorage.setItem(REPEAT_MODE_KEY, nextMode);
}

function isRandomModeEnabled() {
  const stored = localStorage.getItem(RANDOM_MODE_KEY);
  if (stored !== null) return stored === '1';

  return localStorage.getItem(LEGACY_RANDOM_AUTO_PLAY_KEY) === '1';
}

function setRandomModeEnabled(on) {
  localStorage.setItem(RANDOM_MODE_KEY, on ? '1' : '0');
}

let randomPlayQueue = [];
let randomPlayQueueSignature = "";

function isTikTokVideo(video) {
  return (video?._platform || String(video?.["platform"] || "").toLowerCase()) === "tiktok";
}

function getAutoPlayableVideos() {
  const baseList = currentFilteredVideos?.length ? currentFilteredVideos : allVideos;
  return baseList.filter(video => !isTikTokVideo(video));
}

function getVideoKey(video) {
  return `${video?.["videoId"]}__${parseInt(video?.["start"] || 0, 10)}`;
}

function getCurrentVideo() {
  const baseList = currentFilteredVideos?.length ? currentFilteredVideos : allVideos;
  return baseList.find(video => getVideoKey(video) === nowPlayingKey) || null;
}

function resetRandomPlayQueue() {
  randomPlayQueue = [];
  randomPlayQueueSignature = "";
}

function shuffleVideos(videos) {
  const shuffled = [...videos];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function getRandomQueueBaseList(options = {}) {
  return options.autoPlayableOnly
    ? getAutoPlayableVideos()
    : (currentFilteredVideos?.length ? currentFilteredVideos : allVideos);
}

function getRandomQueueSignature(baseList, options = {}) {
  return [
    options.autoPlayableOnly ? "auto" : "manual",
    baseList.map(getVideoKey).join("|")
  ].join(":");
}

function buildRandomPlayQueue(baseList, options = {}) {
  const currentKey = nowPlayingKey;
  const queueBase = baseList.length > 1
    ? baseList.filter(video => getVideoKey(video) !== currentKey)
    : baseList;

  randomPlayQueue = shuffleVideos(queueBase);
  randomPlayQueueSignature = getRandomQueueSignature(baseList, options);
}

function playRandomNextVideo(options = {}) {
  const baseList = getRandomQueueBaseList(options);
  if (!baseList.length) return;

  const signature = getRandomQueueSignature(baseList, options);
  if (!randomPlayQueue.length || randomPlayQueueSignature !== signature) {
    buildRandomPlayQueue(baseList, options);
  }

  const nextVideo = randomPlayQueue.shift();
  if (nextVideo) loadVideo(nextVideo, null);
}

function playCurrentVideoAgain() {
  const currentVideo = getCurrentVideo();
  if (!currentVideo) return;

  loadVideo(currentVideo, null);
}

function handleVideoEnded() {
  const repeatMode = getRepeatMode();

  if (repeatMode === REPEAT_MODE_OFF) return;

  if (repeatMode === REPEAT_MODE_ONE) {
    playCurrentVideoAgain();
    return;
  }

  if (isRandomModeEnabled()) {
    playRandomNextVideo({ autoPlayableOnly: true });
  } else {
    playAdjacentVideo(1);
  }
}

function setPlayerControlIcon(button, src) {
  const icon = button?.querySelector('.player-control-icon');
  if (!icon) return;

  let img = icon.querySelector('img');
  if (!img) {
    img = document.createElement('img');
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    icon.replaceChildren(img);
  }

  img.src = src;
}

function updateRepeatModeButton() {
  const btn = document.getElementById('repeatModeBtn');
  if (!btn) return;

  const mode = getRepeatMode();
  const labels = {
    [REPEAT_MODE_ALL]: '全曲リピート',
    [REPEAT_MODE_ONE]: '1曲リピート',
    [REPEAT_MODE_OFF]: 'リピートOFF'
  };
  const icons = {
    [REPEAT_MODE_ALL]: './assets/icon/icon-repeat.png',
    [REPEAT_MODE_ONE]: './assets/icon/icon-repeat-one.png',
    [REPEAT_MODE_OFF]: './assets/icon/icon-repeat.png'
  };
  const label = labels[mode];

  btn.dataset.state = mode;
  btn.setAttribute('aria-label', label);
  setPlayerControlIcon(btn, icons[mode]);
  btn.querySelector('.player-control-label').textContent = label;
}

function updateRandomModeButton() {
  const btn = document.getElementById('randomModeBtn');
  if (!btn) return;

  const on = isRandomModeEnabled();
  const label = on ? 'ランダムON' : 'ランダムOFF';

  btn.dataset.state = on ? 'on' : 'off';
  btn.setAttribute('aria-label', label);
  setPlayerControlIcon(btn, './assets/icon/icon-shuffle.png');
  btn.querySelector('.player-control-label').textContent = label;
}

    sortOrder.value = "";
document.getElementById('modalSortOrder').value = "";
    

// ===== データURL =====
    const sheetJsonUrl = './data/videos.json';
    const metaSheetUrl = './data/meta.json';


// ===== タグ・絞り込み状態の管理 =====
    let allVideos = [];
    let currentFilteredVideos = [];
    let nowPlayingKey = null;
    let selectedCategoryTag = "";
    let selectedDateTag = "";
    let selectedCollabTag = "";
    let selectedRoleTag = "";
    let selectedPlatformTag = "";
    let selected3DTag = null;
    let selectedShortsTag = null;
    const selectedVideoTypeTags = new Set();

// ===== タグの表示・解除 =====
function parseCommaTags(value) {
  return String(value || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

function parseYmdToTime(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return 0;

  // YYYY[/-.年]MM[/-.月]DD(可) 例: 2024/06/30, 2024-6-3, 2024.06.30, 2024年6月30日
  let m = s.match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y && mo && d) return new Date(y, mo - 1, d).getTime();
  }

  // 年月だけ（公開月対策） 例: 2024/06, 2024-6, 2024年6月
  m = s.match(/(\d{4})[\/\-.年](\d{1,2})/);
  if (m) {
    const y = +m[1], mo = +m[2];
    if (y && mo) return new Date(y, mo - 1, 1).getTime(); // 日が無ければ1日で補完
  }

  // 最後の保険：Date.parse に賭ける（失敗なら 0）
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function normalizeVideos(data) {
  return data.map(video => {
    const roles = parseCommaTags(video["担当区分"]);
    const types = parseCommaTags(video["動画種別"]);
    const collabLivers = parseCommaTags(video["コラボライバー"]);
    const collabUnits = parseCommaTags(video["コラボユニット"]);
    const platform = String(video["platform"] || "").toLowerCase();

    video._roles = roles;
    video._types = types;
    video._collabLivers = collabLivers;
    video._collabUnits = collabUnits;
    video._collabTags = [...collabLivers, ...collabUnits];
    video._platform = platform;
    video._is3D = video["3D"] === "TRUE";
    video._isShorts = video["Shorts"] === "TRUE";
    video._time = parseYmdToTime(video["公開日"] || video["公開月"]);
    video._searchText = [
      video["title"],
      video["title_kana"],
      video["artist"],
      video["artist_kana"],
      video["waku_name"],
      video["担当区分"],
      video["コラボライバー"],
      video["コラボユニット"],
      roles.join(" "),
      collabLivers.join(" "),
      collabUnits.join(" ")
    ].filter(Boolean).join(" ").toLowerCase();

    return video;
  });
}

    function toggleTagState(state) {
  if (state === null) return "include";
  return null;
}

function toggleVideoTypeTag(type) {
  if (selectedVideoTypeTags.has(type)) {
    selectedVideoTypeTags.delete(type);
  } else {
    selectedVideoTypeTags.add(type);
  }
}

function getDateTagLabel(value) {
  const labels = {
    recent: '最近',
    year: '1年以内',
    old: '1年以上前'
  };

  return labels[value] || value;
}

function clearDateTag() {
  selectedDateTag = "";

  const modalDateFilter = document.getElementById('modalDateFilter');
  if (modalDateFilter) modalDateFilter.value = "";

  renderDateTags();
  applyFilters();
}

    function updateActiveTagChipsPosition() {
  if (!filterSection || !activeTagChips) return;

  const filterHeight = filterSection.offsetHeight || 0;
  activeTagChips.style.top = `${filterHeight}px`;
}

    //アクティブタグ描画関数
    function renderActiveTagChips() {
  if (!activeTagChips || !activeTagChipsInner) return;

  activeTagChipsInner.innerHTML = '';

  const activeTags = [];

// アクティブ状態のタグを収集
if (selectedCategoryTag) activeTags.push({ label: selectedCategoryTag, type: 'include' });
if (selectedCollabTag) activeTags.push({ label: selectedCollabTag, type: 'include' });
if (selectedRoleTag) activeTags.push({ label: selectedRoleTag, type: 'include' });
if (selectedPlatformTag) activeTags.push({ label: selectedPlatformTag, type: 'include' });
if (selectedDateTag) activeTags.push({ label: getDateTagLabel(selectedDateTag), type: 'include', source: 'date' });
if (selected3DTag) activeTags.push({ label: '3D', type: selected3DTag });
if (selectedShortsTag) activeTags.push({ label: 'Shorts', type: selectedShortsTag });

selectedVideoTypeTags.forEach(type => {
  activeTags.push({ label: type, type: 'include', source: 'videoType' });
});

  if (activeTags.length === 0) {
  activeTagChips.classList.add('hidden');
  updateActiveTagChipsPosition();
  return;
}

activeTagChips.classList.remove('hidden');
updateActiveTagChipsPosition();

activeTags.forEach(tagData => {
    const chip = document.createElement('button');
    chip.type = 'button';

    chip.className = 'tag-button tag-xs tag-active-chip';

    chip.textContent = tagData.label;
    if (tagData.source) chip.dataset.activeChipSource = tagData.source;
    
    chip.addEventListener('click', () => {
      // 解除処理

    
        if (tagData.source === 'videoType') {
        selectedVideoTypeTags.delete(tagData.label);
        applyFilters();
        return;
      }

      if (tagData.source === 'date') {
        clearDateTag();
        return;
      }
        
      switch (tagData.label) {
        case '3D':
  selected3DTag = null;
  break;
case 'Shorts':
  selectedShortsTag = null;
  break;
    
        default:
          if (selectedCategoryTag === tagData.label) {
            selectedCategoryTag = "";
            renderCategoryTags([...new Set(allVideos.map(v => v["カテゴリ"]).filter(Boolean))].sort());
          }
          if (selectedCollabTag === tagData.label) selectedCollabTag = "";
          if (selectedRoleTag === tagData.label) selectedRoleTag = "";
          if (selectedPlatformTag === tagData.label) {
            selectedPlatformTag = "";
            renderPlatformTags();
          }
          break;
      }

      applyFilters();
    });

    activeTagChipsInner.appendChild(chip);
  });
}

if (activeTagChipsInner) {
  activeTagChipsInner.addEventListener('click', event => {
    const chip = event.target.closest('[data-active-chip-source="date"]');
    if (!chip) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    clearDateTag();
  }, true);
}


// ===== 表示用の補助関数 =====
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[s]));
}

function getTagButtonClass(kind, isActive = false, options = {}) {
  const classes = ["tag-button", options.size || "tag-xs", kind];

  if (options.valueClass) classes.push(options.valueClass);
  if (isActive) classes.push(`${kind}-active`);

  return classes.join(" ");
}

function getStyleTagValueClass(category) {
  const map = {
    "ソロ": "tag-style-solo",
    "コラボ": "tag-style-collab",
    "あやかき": "tag-style-ayakaki"
  };

  return map[category] || "tag-style-default";
}

function getRoleTagClass(role, isActive = false) {
  const map = {
    VOCAL: "tag-role-vocal",
    DANCE: "tag-role-dance",
    PIANO: "tag-role-piano",
    EUPHONIUM: "tag-role-euphonium",
    MOVIE: "tag-role-movie",
    CHORUS: "tag-role-chorus",
    ILLUSTRATION: "tag-role-illustration",
  };

  return getTagButtonClass("tag-role", isActive, {
    valueClass: map[role] || "tag-role-default"
  });
}


// ===== YouTubeプレイヤーの準備 =====
    let ytPlayer = null;
let ytApiReady = false;

// YouTube IFrame API の準備完了コールバック
window.onYouTubeIframeAPIReady = () => {
  ytApiReady = true;
  tryInitYtPlayer();
};

// 既存の iframe(id="playerIframe") を YT.Player 化
function tryInitYtPlayer() {
  if (!ytApiReady) return;
  if (ytPlayer) return;
  if (!youtubePlayerEl) return;

  ytPlayer = new YT.Player('youtubePlayer', {
    playerVars: {
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      origin: location.origin
    },
    events: {
      onStateChange: (e) => {
        console.log('YouTube state:', e.data, 'repeatMode:', getRepeatMode(), 'randomMode:', isRandomModeEnabled());

        if (e.data === YT.PlayerState.ENDED) {
          handleVideoEnded();
        }
      }
    }
  });
}


// ===== スプレッドシートからデータ取得 =====    
fetch(sheetJsonUrl)
  .then(response => response.json())
  .then(data => {
    allVideos = normalizeVideos(data);
    populateFilters(allVideos);
    applyFilters();
    requestAnimationFrame(() => {
      adjustFixedPlayerBottom();
      updateActiveTagChipsPosition();
    });
  });

fetch(metaSheetUrl)
  .then(res => res.json())
  .then(data => {
    const lastUpdate = data.find(row => row["項目"] === "最終更新日");
    if (lastUpdate) {
      document.getElementById("lastUpdated").textContent =
        `最終更新日：${lastUpdate["値"]}`;
    }
  });

// ===== フィルターUIの操作 =====
    const repeatModeBtn = document.getElementById('repeatModeBtn');
    const randomModeBtn = document.getElementById('randomModeBtn');

if (repeatModeBtn) {
  updateRepeatModeButton();

  repeatModeBtn.addEventListener('click', () => {
    const currentIndex = REPEAT_MODE_SEQUENCE.indexOf(getRepeatMode());
    const nextMode = REPEAT_MODE_SEQUENCE[(currentIndex + 1) % REPEAT_MODE_SEQUENCE.length];
    setRepeatMode(nextMode);
    updateRepeatModeButton();
    applyFilters();
  });
}

if (randomModeBtn) {
  updateRandomModeButton();

  randomModeBtn.addEventListener('click', () => {
    setRandomModeEnabled(!isRandomModeEnabled());
    resetRandomPlayQueue();
    updateRandomModeButton();
    applyFilters();
  });
}

    // モバイル用フィルターモーダル制御
document.getElementById('openFilterModal').addEventListener('click', () => {
  document.getElementById('filterModal').classList.remove('hidden');
});

document.getElementById('closeFilterModal').addEventListener('click', () => {
  document.getElementById('filterModal').classList.add('hidden');
});

document.getElementById('applyFilters').addEventListener('click', () => {
  // モーダルから値を取得して本体に反映
searchInput.value = document.getElementById('modalSearchInput').value;
sortOrder.value = document.getElementById('modalSortOrder').value;

  //モーダル適用時のリセット
  selectedCategoryTag = "";

  renderCategoryTags([...new Set(allVideos.map(v => v["カテゴリ"]).filter(Boolean))].sort());
  
  selectedCollabTag = "";
  selectedRoleTag = "";
selected3DTag = null;
selectedShortsTag = null;
selectedVideoTypeTags.clear();
    
  applyFilters();
  document.getElementById('filterModal').classList.add('hidden');
});


  const randomPlayButton = document.getElementById('randomPlayButton');
    randomPlayButton.addEventListener('click', () => {
  const list = currentFilteredVideos?.length ? currentFilteredVideos : allVideos;
  const randomVideo = list[Math.floor(Math.random() * list.length)];
    loadVideo(randomVideo, null);
});


// ===== 固定プレイヤーの位置・サイズ調整 =====
function adjustFixedPlayerBottom() {
  const nowPlayingWrapperEl = document.getElementById('nowPlayingWrapper');
  if (!fixedPlayerEl || !nowPlayingWrapperEl || !playerIframe) return; 

  const h = nowPlayingWrapperEl.offsetHeight || 0;
  fixedPlayerEl.style.bottom = `${h + 8}px`;
  const total = (fixedPlayerEl.offsetHeight || 0) + h + 12;
  document.body.style.paddingBottom = `${total}px`;

  const maxH = getMaxPlayerHeight();
  const current = parseInt(playerIframe.style.height || 0, 10) ||
                  playerIframe.getBoundingClientRect().height;
  if (current > maxH) setPlayerHeight(maxH);
}

window.addEventListener('resize', () => {
  requestAnimationFrame(adjustFixedPlayerBottom);
});
window.addEventListener('orientationchange', () => {
  setTimeout(adjustFixedPlayerBottom, 50);
});
window.visualViewport?.addEventListener('resize', adjustFixedPlayerBottom);

    window.addEventListener('resize', () => {
  requestAnimationFrame(updateActiveTagChipsPosition);
});

window.addEventListener('orientationchange', () => {
  setTimeout(updateActiveTagChipsPosition, 50);
});

window.visualViewport?.addEventListener('resize', updateActiveTagChipsPosition);


// ===== プレイヤーの高さ変更 =====
const PLAYER_HEIGHT_KEY = 'playerHeightPx';
const MIN_PLAYER_H = 240;

function applyStoredPlayerHeight() {
  const stored = parseInt(localStorage.getItem(PLAYER_HEIGHT_KEY) || '', 10);
  const maxH = getMaxPlayerHeight();

  let h;

  if (!isNaN(stored)) {
    h = stored;
  } else {
    h =
      playerFrameWrapper?.getBoundingClientRect().height ||
      youtubePlayerEl?.getBoundingClientRect().height ||
      playerIframe?.getBoundingClientRect().height ||
      360;
  }

  h = Math.max(MIN_PLAYER_H, Math.min(Math.round(h), maxH));

  setPlayerHeight(h);
}

function getMaxPlayerHeight() {
  const vh = window.innerHeight;
  const nowH = document.getElementById('nowPlayingWrapper')?.offsetHeight || 0;
  const bottomOffset = nowH + 8;
  const fixedPlayerVerticalPadding = 16 * 2;
  const handleAndTopSafety = 24 + 16; // だいたい 40px
  const maxH = vh - (bottomOffset + fixedPlayerVerticalPadding + handleAndTopSafety);
  return Math.max(MIN_PLAYER_H, Math.floor(maxH));
}

    function getActivePlayerElement() {
  const ytEl = getYouTubePlayerElement();

  if (ytEl && !ytEl.classList.contains('hidden')) {
    return ytEl;
  }

  if (tiktokPlayerEl && !tiktokPlayerEl.classList.contains('hidden')) {
    return tiktokPlayerEl;
  }

  return playerIframe;
}

function getYouTubeIframeElement() {
  return document.querySelector('#youtubePlayer iframe') || document.getElementById('youtubePlayer');
}

    function getYouTubePlayerElement() {
  return document.getElementById('youtubePlayer');
}

function hideYouTubePlayer() {
  const el = getYouTubePlayerElement();
  if (el) el.classList.add('hidden');
}

function showYouTubePlayer() {
  const el = getYouTubePlayerElement();
  if (el) el.classList.remove('hidden');
}

    function getTikTokId(videoId) {
  const match = String(videoId).match(/video\/(\d+)/);
  return match ? match[1] : String(videoId).trim();
}

function loadTikTokEmbed(tiktokId) {
  if (!tiktokPlayerEl) return;

  const tiktokUrl = `https://www.tiktok.com/@riko14218/video/${tiktokId}`;

  tiktokPlayerEl.innerHTML = `
    <blockquote
      class="tiktok-embed"
      cite="${tiktokUrl}"
      data-video-id="${tiktokId}"
      data-embed-from="embed_page"
      style="max-width:605px; min-width:325px;">
      <section>
        <a target="_blank" rel="noopener" href="${tiktokUrl}">TikTokで見る</a>
      </section>
    </blockquote>
  `;

  reloadTikTokEmbedScript();
}

function reloadTikTokEmbedScript() {
  document.querySelectorAll('script[src="https://www.tiktok.com/embed.js"]').forEach(script => {
    script.remove();
  });

  const script = document.createElement('script');
  script.src = 'https://www.tiktok.com/embed.js';
  script.async = true;
  document.body.appendChild(script);
}
    
function setPlayerHeight(px) {
  const maxH = getMaxPlayerHeight();
  const h = Math.max(MIN_PLAYER_H, Math.min(Math.round(px), maxH));

  if (playerIframe) {
    playerIframe.classList.remove('aspect-video');
    playerIframe.style.height = h + 'px';
  }

 const ytEl = getYouTubeIframeElement();
if (ytEl) {
  ytEl.classList.remove('aspect-video');
  ytEl.style.height = h + 'px';
  ytEl.style.width = '100%';
}

  if (youtubePlayerEl) {
    youtubePlayerEl.classList.remove('aspect-video');
    youtubePlayerEl.style.height = h + 'px';
  }

  if (tiktokPlayerEl) {
  tiktokPlayerEl.style.height = h + 'px';
  tiktokPlayerEl.style.overflow = 'auto';
}

  if (playerFrameWrapper) {
    playerFrameWrapper.style.height = h + 'px';
  }

  localStorage.setItem(PLAYER_HEIGHT_KEY, String(h));
  adjustFixedPlayerBottom();
}


(function enablePlayerResize() {
  if (!resizeHandle) return;

  let dragging = false, startY = 0, startH = 0;
  let prevUserSelect = '', prevCursor = '', prevOverflow = '';
  const preventScroll = (e) => e.preventDefault();

  const lockScroll = () => {
    // スクロール抑止（iOS含む）
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // タッチスクロールを完全停止
    document.addEventListener('touchmove', preventScroll, { passive: false });
  };

    const disableIframePointer = () => {
  const active = getActivePlayerElement();
  if (active) active.style.pointerEvents = 'none';
};

const enableIframePointer = () => {
  const active = getActivePlayerElement();
  if (active) active.style.pointerEvents = '';
};

  const unlockScroll = () => {
    document.body.style.overflow = prevOverflow;
    document.removeEventListener('touchmove', preventScroll, { passive: false });
  };

  const start = (y) => {
    dragging = true;
    startY = y;
    
    const activePlayer = getActivePlayerElement();
startH = parseInt(activePlayer.style.height || 0, 10) ||
         activePlayer.getBoundingClientRect().height;
    
    prevUserSelect = document.body.style.userSelect;
    prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    disableIframePointer(); 
    lockScroll();
  };

  const move = (y) => {
    if (!dragging) return;
    const dy = y - startY;
    setPlayerHeight(startH - dy); // 上に動かすと高さが増える
  };

  const end = () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = prevUserSelect;
    document.body.style.cursor = prevCursor;
    enableIframePointer(); 
    unlockScroll();
  };

     window.addEventListener('blur', end);
    document.addEventListener('mouseleave', end);

  document.addEventListener('mouseup', end);
document.addEventListener('touchend', end);
document.addEventListener('touchcancel', end);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) end();
});

  // マウス
 resizeHandle.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  start(e.clientY);
});
  window.addEventListener('mousemove', (e) => move(e.clientY));
  window.addEventListener('mouseup', end);

  // タッチ（passive: false で preventDefault を有効に）
  resizeHandle.addEventListener('touchstart', (e) => {
  e.preventDefault();
  e.stopPropagation();
  start(e.touches[0].clientY);
}, { passive: false });
  
  window.addEventListener('touchmove', (e) => {
    move(e.touches[0].clientY);
  }, { passive: false });

  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);

})();


// ===== 絞り込み項目の作成 =====
      function populateFilters(videos) {

  const roleOrder = [
    "VOCAL",
    "DANCE",
    "PIANO",
    "EUPHONIUM",
    "MOVIE",
    "CHORUS",
    "ILLUSTRATION"
  ];
        const sets = {
          category: new Set(),
          date: new Set(),
          type: new Set(),
          role: new Set()
        };

        videos.forEach(v => {
          sets.category.add(v["カテゴリ"]);
          v._types.forEach(type => sets.type.add(type));
          v._roles.forEach(role => sets.role.add(role));

            // 公開月（例: 2023/07）だけ抽出して追加
const rawDate = v["公開月"];
if (typeof rawDate === "string" && /^\d{4}[-\/]\d{2}/.test(rawDate)) {
  const month = rawDate.slice(0, 7).replace('-', '/'); // "YYYY/MM"
  sets.date.add(month);
}
        });

        renderPlatformTags();
        renderCategoryTags([...sets.category].sort());
        renderDateTags();

// モーダル用にも同じく追加
addOptions(document.getElementById('modalCategoryFilter'), [...sets.category].sort());
addOptions(document.getElementById('modalDateFilter'), [...sets.date].sort());
addOptions(document.getElementById('modalTypeFilter'), [...sets.type].sort());
addOptions(
  document.getElementById('modalRoleFilter'),
  [...sets.role].sort((a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b))
);

        // モバイル用ランダム再生ボタン
const mobileRandomPlayButton = document.getElementById('mobileRandomPlayButton');
if (mobileRandomPlayButton) {
  mobileRandomPlayButton.addEventListener('click', () => {
    const list = currentFilteredVideos?.length ? currentFilteredVideos : allVideos;
    const randomVideo = list[Math.floor(Math.random() * list.length)];
    loadVideo(randomVideo, null);
  });
}

       [searchInput, sortOrder].forEach(el => {
  el.addEventListener('change', applyFilters);
  el.addEventListener('input', applyFilters);
});


     // リセットボタン
  resetButton.addEventListener('click', () => {
  searchInput.value = "";
  sortOrder.value = "";
  selectedCategoryTag = "";
    renderCategoryTags([...new Set(allVideos.map(v => v["カテゴリ"]).filter(Boolean))].sort());
  selectedCollabTag = "";
  selectedRoleTag = "";
  selectedPlatformTag = "";
  selectedDateTag = "";
  renderDateTags();
  renderPlatformTags();
    
selected3DTag = null;
selectedShortsTag = null;
selectedVideoTypeTags.clear();
    
  document.getElementById('modalCategoryFilter').value = "";
  document.getElementById('modalDateFilter').value = "";
  document.getElementById('modalTypeFilter').value = "";
  document.getElementById('modalRoleFilter').value = "";
  document.getElementById('modalSearchInput').value = "";
  document.getElementById('modalSortOrder').value = "";
  applyFilters();
});
      }

// ===== タグボタンの描画 =====
function renderPlatformTags() {
  const containers = [
    document.getElementById('modalPlatformTags'),
    document.getElementById('desktopPlatformTags')
  ].filter(Boolean);

  containers.forEach(container => {
    container.innerHTML = '';

    ['youtube', 'tiktok'].forEach(p => {
      const btn = document.createElement('button');
      const isActive = selectedPlatformTag === p;

      btn.className = getTagButtonClass("tag-platform", isActive, { size: "tag-sm" });

        btn.textContent = p;
        btn.dataset.filterGroup = "platform";
        btn.dataset.filterValue = p;

      btn.onclick = () => {
        selectedPlatformTag = selectedPlatformTag === p ? "" : p;
        renderPlatformTags();
        applyFilters();
      };

      container.appendChild(btn);
    });
  });
}

    function renderCategoryTags(categories = []) {
  const containers = [
    document.getElementById('modalCategoryTags'),
    document.getElementById('desktopCategoryTags')
  ].filter(Boolean);

  containers.forEach(container => {
    container.innerHTML = '';

    categories.forEach(category => {
      const btn = document.createElement('button');
      const isActive = selectedCategoryTag === category;

      btn.className = getTagButtonClass("tag-style", isActive, { size: "tag-sm" });

        btn.textContent = category;
        btn.dataset.filterGroup = "category";
        btn.dataset.filterValue = category;

      btn.onclick = () => {
        selectedCategoryTag = selectedCategoryTag === category ? "" : category;

        const modalCategoryFilter = document.getElementById('modalCategoryFilter');
        if (modalCategoryFilter) modalCategoryFilter.value = "";

        renderCategoryTags(categories);
        applyFilters();
      };

      container.appendChild(btn);
    });
  });
}

function renderDateTags() {
  const containers = [
    document.getElementById('modalDateTags'),
    document.getElementById('desktopDateTags')
  ].filter(Boolean);

  const options = [
    { label: "最近", value: "recent" },
    { label: "1年以内", value: "year" },
    { label: "1年以上前", value: "old" }
  ];

  containers.forEach(container => {
    container.innerHTML = '';

    options.forEach(opt => {
      const btn = document.createElement('button');
      const isActive = selectedDateTag === opt.value;

      btn.className = getTagButtonClass("tag-time", isActive, { size: "tag-sm" });

        btn.textContent = opt.label;
        btn.dataset.filterGroup = "time";
        btn.dataset.filterValue = opt.value;

      btn.onclick = () => {
        selectedDateTag = selectedDateTag === opt.value ? "" : opt.value;

        const modalDate = document.getElementById('modalDateFilter');
        if (modalDate) modalDate.value = "";

        renderDateTags();
        applyFilters();
      };

      container.appendChild(btn);
    });
  });
}

      function addOptions(select, values) {
        values.forEach(v => {
          if (!v) return;
          const option = document.createElement('option');
          option.value = v;
          option.textContent = v;
          select.appendChild(option);
        });
      }


// ===== 検索・絞り込み処理 =====
      function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const now = new Date();
        let filtered = allVideos.filter(video => {
  const diffMonths = (now - video._time) / (1000 * 60 * 60 * 24 * 30);

  return (!searchTerm || video._searchText.includes(searchTerm)) &&
    
// フィルタ条件
    (!selectedCategoryTag || video["カテゴリ"] === selectedCategoryTag) &&
    (!selectedCollabTag || video._collabTags.includes(selectedCollabTag)) &&
    (!selectedRoleTag || video._roles.includes(selectedRoleTag)) &&
    (!selectedPlatformTag || video._platform === selectedPlatformTag) &&
(!selectedDateTag ||
  (selectedDateTag === "recent" && diffMonths <= 3) ||
  (selectedDateTag === "year" && diffMonths <= 12) ||
  (selectedDateTag === "old" && diffMonths > 12)
) &&
  (
selected3DTag === null ||
  (selected3DTag === "include" && video._is3D)
) &&
(
selectedShortsTag === null ||   
(selectedShortsTag === "include" && video._isShorts)
) &&
(
 selectedVideoTypeTags.size === 0 ||
  [...selectedVideoTypeTags].every(tag => video._types.includes(tag))
 )
});

const coll = new Intl.Collator('ja');

function videoTime(v) {
  return v._time;
}

const order = sortOrder.value;

if (order) {
  filtered.sort((a, b) => {
    if (order === "asc" || order === "desc") {
      const ta = videoTime(a);
      const tb = videoTime(b);
      return order === "asc" ? ta - tb : tb - ta;
    } else if (order === "title") {
      return coll.compare(String(a["title"] || ""), String(b["title"] || ""));
    } else if (order === "artist") {
      return coll.compare(String(a["artist"] || ""), String(b["artist"] || ""));
    } else {
      return 0;
    }
  });
}

        currentFilteredVideos = filtered;
resetRandomPlayQueue();
renderVideoList(filtered);
renderActiveTagChips();
      }


// ===== 動画一覧の描画 =====
function renderVideoList(videos) {
  videoList.innerHTML = '';

    // 件数表示を更新
  const countElement = document.getElementById('songCount');
  countElement.textContent = `${allVideos.length}曲中 ${videos.length}曲表示中`;

  const oldNotice = document.getElementById('autoPlayNotice');
if (oldNotice) oldNotice.remove();

  const oldNowPlayingNotice = document.getElementById('nowPlayingFilteredOutNotice');
if (oldNowPlayingNotice) oldNowPlayingNotice.remove();

const playableCount = videos.filter(video => !isTikTokVideo(video)).length;

if (getRepeatMode() === REPEAT_MODE_ALL && isRandomModeEnabled() && videos.length > 0 && playableCount === 0) {
  const notice = document.createElement('div');
  notice.id = 'autoPlayNotice';
  notice.className = 'auto-play-notice';
  notice.textContent = 'この条件ではランダム連続再生できる動画がありません（TikTokは対象外です）';
  countElement.insertAdjacentElement('afterend', notice);
}

  let playingElement = null;

  videos.forEach(video => {
    const item = document.createElement('div');
    item.className = 'p-3 mb-3 bg-blue-100 rounded-lg shadow-md border-2 border-teal-700 space-y-1';

    const key = `${video["videoId"]}__${parseInt(video["start"] || 0)}`;
    item.dataset.videoKey = key;

    if (key === nowPlayingKey) {
      item.classList.add('playing');
      playingElement = item;
    }

    
    // 1行目：タイトル / アーティスト
    const topRow = document.createElement('div');
    topRow.className = 'video-item-row';

    const title = document.createElement('a');
    title.href = "#";
    title.className = 'video-title hover:underline';
    title.textContent = video["title"];
    title.onclick = e => {
      e.preventDefault();
      loadVideo(video, item);
    };

    const slash = document.createElement('span');
    slash.textContent = ' / ';

    const artist = document.createElement('span');
    artist.className = 'video-artist';
    artist.textContent = video["artist"];

    topRow.appendChild(title);
    topRow.appendChild(slash);
    topRow.appendChild(artist);

    // 2行目：詳細情報
    const metaRow = document.createElement('div');
    metaRow.className = 'video-meta';
   [
  video["公開月"],
].filter(Boolean).forEach(text => {
  const span = document.createElement('span');
  span.textContent = text;
  metaRow.appendChild(span);
});

const roles = video._roles;
const typeTags = video._types;
    const category = video["カテゴリ"];
const platform = video["platform"];
const normalizedPlatform = video._platform;
let roleTagRow = null;

if (
  category ||
  platform ||
  roles.length ||
  typeTags.length ||
  video._is3D ||
  video._isShorts
) {
  roleTagRow = document.createElement('div');
  roleTagRow.className = 'flex flex-wrap gap-1.5 mt-2';

  typeTags.forEach(type => {
    const tag = document.createElement('button');
    tag.type = 'button';

      const isTypeActive = selectedVideoTypeTags.has(type);

    tag.className = getTagButtonClass("tag-format", isTypeActive);

    tag.textContent = type;

    tag.addEventListener('click', () => {

      toggleVideoTypeTag(type);
      applyFilters();
    });

    roleTagRow.appendChild(tag);
  });

  // カテゴリタグ
if (category) {
  const categoryTag = document.createElement('button');
  categoryTag.type = 'button';

  const isCategoryActive = selectedCategoryTag === category;

  categoryTag.className = getTagButtonClass("tag-style", isCategoryActive, {
    valueClass: getStyleTagValueClass(category)
  });

  categoryTag.textContent = category;

  categoryTag.addEventListener('click', () => {
    selectedCategoryTag = selectedCategoryTag === category ? "" : category;
    
    const modalCategoryFilter = document.getElementById('modalCategoryFilter');
    if (modalCategoryFilter) modalCategoryFilter.value = "";

    applyFilters();
  });

  roleTagRow.appendChild(categoryTag);
}

  // platformタグ
  if (platform) {
    const platformTag = document.createElement('button');
    platformTag.type = 'button';

    const isPlatformActive = selectedPlatformTag === normalizedPlatform;

    platformTag.className = getTagButtonClass("tag-platform", isPlatformActive);

    platformTag.textContent = platform;

    platformTag.addEventListener('click', () => {
selectedPlatformTag = selectedPlatformTag === normalizedPlatform ? "" : normalizedPlatform;
      applyFilters();
    });

    roleTagRow.appendChild(platformTag);
  }

  // 3Dタグ
if (video._is3D) {
  const tag3D = document.createElement('button');
  tag3D.type = 'button';

  const isInclude = selected3DTag === "include";

  tag3D.className = getTagButtonClass("tag-format-3d", isInclude);

  tag3D.textContent = '3D';

  tag3D.addEventListener('click', () => {
    selected3DTag = toggleTagState(selected3DTag);
    applyFilters();
  });

  roleTagRow.appendChild(tag3D);
}

  // Shortsタグ
if (video._isShorts) {
  const shortsTag = document.createElement('button');
  shortsTag.type = 'button';

  const isInclude = selectedShortsTag === "include";

  shortsTag.className = getTagButtonClass("tag-format", isInclude);

  shortsTag.textContent = 'Shorts';

  shortsTag.addEventListener('click', () => {
    selectedShortsTag = toggleTagState(selectedShortsTag);
    applyFilters();
  });

  roleTagRow.appendChild(shortsTag);
}


  // 担当区分タグ
  roles.forEach(role => {
    const tag = document.createElement('button');
    tag.type = 'button';

    const isActive = selectedRoleTag === role;
    tag.className = getRoleTagClass(role, isActive);
    tag.textContent = role;

    tag.addEventListener('click', () => {
      selectedRoleTag = (selectedRoleTag === role) ? "" : role;

      const modalRoleFilter = document.getElementById('modalRoleFilter');
      if (modalRoleFilter) modalRoleFilter.value = "";

      applyFilters();
    });

    roleTagRow.appendChild(tag);
  });
    }

// 3行目：コラボタグ
const collabLivers = video._collabLivers;
const collabUnits = video._collabUnits;

let tagRow = null;

if (collabLivers.length || collabUnits.length) {
  tagRow = document.createElement('div');
  tagRow.className = 'flex flex-wrap gap-1.5 mt-2';

  collabLivers.forEach(name => {
    const tag = document.createElement('button');
    tag.type = 'button';

    const isActive = selectedCollabTag === name;
    tag.className = getTagButtonClass("tag-collab-liver", isActive);

    tag.textContent = name;

    tag.addEventListener('click', () => {
      selectedCollabTag = (selectedCollabTag === name) ? "" : name;
      applyFilters();
    });

    tagRow.appendChild(tag);
  });

  collabUnits.forEach(unit => {
    const tag = document.createElement('button');
    tag.type = 'button';

    const isActive = selectedCollabTag === unit;
    tag.className = getTagButtonClass("tag-collab-unit", isActive);

    tag.textContent = unit;

    tag.addEventListener('click', () => {
      selectedCollabTag = (selectedCollabTag === unit) ? "" : unit;
      applyFilters();
    });

    tagRow.appendChild(tag);
  });
}

item.appendChild(topRow);
item.appendChild(metaRow);
if (roleTagRow) item.appendChild(roleTagRow);
if (tagRow) item.appendChild(tagRow);

videoList.appendChild(item);
      });
  
  // スクロール実行
  if (playingElement) {
    playingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (nowPlayingKey && videos.length > 0) {
    const notice = document.createElement('div');
    notice.id = 'nowPlayingFilteredOutNotice';
    notice.className = 'auto-play-notice';
    notice.textContent = '再生中の曲は今の絞り込み条件では表示されていません';
    countElement.insertAdjacentElement('afterend', notice);
    notice.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function updateNowPlayingHighlight() {
  videoList.querySelectorAll('.playing').forEach(item => {
    item.classList.remove('playing');
  });

  if (!nowPlayingKey) return;

  const playingElement = [...videoList.querySelectorAll('[data-video-key]')]
    .find(item => item.dataset.videoKey === nowPlayingKey);
  if (playingElement) {
    playingElement.classList.add('playing');
    playingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}


// ===== 動画の再生処理 =====
function loadVideo(video, item) {
  const start = parseInt(video["start"] || '0', 10);
  let videoId = video["videoId"];
  let platform = (video["platform"] || "").toLowerCase();

  if (!videoId) {
    alert("videoId が指定されていません");
    return;
  }
  if (!platform) {
    alert("platform が未指定のため再生できません");
    return;
  }

  if (platform.includes("youtube")) {
  const match = videoId.match(/(?:v=|\/|youtu\.be\/)?([0-9A-Za-z_-]{11})/);
  if (match) videoId = match[1];

  if (playerIframe) {
    playerIframe.classList.add('hidden');
    playerIframe.src = "";
  }

  // YouTube表示
  const ytEl = document.getElementById('youtubePlayer');
  if (ytEl) ytEl.classList.remove('hidden');

  // TikTok非表示
  if (tiktokPlayerEl) {
    tiktokPlayerEl.classList.add('hidden');
    tiktokPlayerEl.innerHTML = "";
  }


  fixedPlayerEl.style.display = 'block';

  if (ytApiReady) {
    tryInitYtPlayer();

    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
      ytPlayer.loadVideoById({ videoId, startSeconds: start });
    }
  }

  } else if (platform === "tiktok") {
  if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
    ytPlayer.stopVideo();
  }

    requestAnimationFrame(() => {
  applyStoredPlayerHeight();
});

 const ytEl = document.getElementById('youtubePlayer');
if (ytEl) ytEl.classList.add('hidden');

  if (playerIframe) {
    playerIframe.classList.add('hidden');
    playerIframe.src = "";
  }

  if (tiktokPlayerEl) {
    tiktokPlayerEl.classList.remove('hidden');
    tiktokPlayerEl.innerHTML = "";
  }

  const tiktokId = getTikTokId(videoId);
  loadTikTokEmbed(tiktokId);

  fixedPlayerEl.style.display = 'block';

    requestAnimationFrame(() => {
  applyStoredPlayerHeight();
});
    

  } else {
    alert(`未対応の platform: ${platform}`);
    return;
  }

  

  // 再生中の曲名・ハイライト更新
  const nowPlayingTitle = document.getElementById('nowPlayingTitle');
  const label = `${video["title"]} - ${video["artist"]}`;
  nowPlayingTitle.textContent = label;
  nowPlayingTitle.title = label;
  nowPlayingKey = getVideoKey(video);
  updateNowPlayingHighlight();
}

// ===== プレイヤー操作ボタン =====
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    document.body.style.paddingBottom =
      `${(document.getElementById('nowPlayingWrapper')?.offsetHeight || 0) + 12}px`;

    if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
      ytPlayer.stopVideo();
    } else if (playerIframe?.src.includes("youtube.com")) {
      playerIframe.contentWindow?.postMessage(JSON.stringify({
        event: 'command',
        func: 'pauseVideo',
        args: []
      }), '*');
    } else {
      playerIframe.src = "";
    }
    fixedPlayerEl.style.display = 'none';
  });
}




  // 古い埋め込みプレイヤーを削除（固定プレイヤーを使うので他のプレイヤーは削除）
  document.querySelectorAll('.video-player-container').forEach(el => el.remove());

  document.getElementById('prevVideoBtn').addEventListener('click', () => {
  playAdjacentVideo(-1);
  });

  document.getElementById('nextVideoBtn').addEventListener('click', () => {
  if (isRandomModeEnabled()) {
    playRandomNextVideo();
  } else {
    playAdjacentVideo(1);
  }
  });

function playAdjacentVideo(direction) {
  if (!currentFilteredVideos.length) return;

  const currentIndex = currentFilteredVideos.findIndex(v => getVideoKey(v) === nowPlayingKey);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const newIndex = (safeCurrentIndex + direction + currentFilteredVideos.length) % currentFilteredVideos.length;
  loadVideo(currentFilteredVideos[newIndex], null);
}
