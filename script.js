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


// ===== プレイヤー状態・localStorage =====
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

function parseTimeToSeconds(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;

  const text = String(value).trim();
  if (!text) return fallback;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Math.floor(Number(text));

  const parts = text.split(":");
  if (parts.length < 2 || parts.length > 3) return fallback;
  if (!parts.every(part => /^\d+$/.test(part.trim()))) return fallback;

  const numbers = parts.map(part => Number(part.trim()));
  const seconds = numbers.pop();
  const minutes = numbers.pop();
  const hours = numbers.pop() || 0;

  if (minutes > 59 || seconds > 59) return fallback;
  return (hours * 3600) + (minutes * 60) + seconds;
}

window.parseTimeToSeconds = parseTimeToSeconds;

function normalizeVideoNumber(value) {
  return String(value ?? "").trim();
}

function getVideoKey(video) {
  return `${video?.["videoId"]}__${video?._startSeconds ?? parseTimeToSeconds(video?.["start"], 0)}`;
}

// ===== 再生対象リスト =====
function getSafeVideoList(list) {
  return Array.isArray(list) ? list.filter(Boolean) : [];
}

function getCurrentPlaybackList() {
  return Array.isArray(currentFilteredVideos)
    ? getSafeVideoList(currentFilteredVideos)
    : getSafeVideoList(allVideos);
}

function getVisibleFilteredVideos(videos) {
  const list = getSafeVideoList(videos);
  return window.FilterState?.filterExcludedVideos
    ? window.FilterState.filterExcludedVideos(list)
    : list;
}

function getAdjacentPlaybackList() {
  return getSafeVideoList(currentFilteredVideos);
}

function isTikTokVideo(video) {
  return (video?._platform || String(video?.["platform"] || "").toLowerCase()) === "tiktok";
}

function getAutoPlayableVideos() {
  return getCurrentPlaybackList().filter(video => !isTikTokVideo(video));
}

function getCurrentVideo() {
  return getCurrentPlaybackList().find(video => getVideoKey(video) === nowPlayingKey) ||
    (currentPlayingVideo && getVideoKey(currentPlayingVideo) === nowPlayingKey ? currentPlayingVideo : null);
}

function showPlaybackUnavailableNotice(message) {
  const countElement = document.getElementById('songCount');
  if (!countElement) return;

  const oldNotice = document.getElementById('autoPlayNotice');
  if (oldNotice) oldNotice.remove();

  const notice = document.createElement('div');
  notice.id = 'autoPlayNotice';
  notice.className = 'auto-play-notice';
  notice.textContent = message;
  countElement.insertAdjacentElement('afterend', notice);
}

function playRandomVideoFromCurrentList() {
  const list = getCurrentPlaybackList();
  if (!list.length) {
    showPlaybackUnavailableNotice('この条件で再生できる動画がありません');
    return;
  }

  const randomVideo = list[Math.floor(Math.random() * list.length)];
  if (!randomVideo) return;

  loadVideo(randomVideo, null);
}

// ===== ランダムキュー =====
let randomPlayQueue = [];
let randomPlayQueueSignature = "";
let endCountdownTimer = null;
let endCountdownVideoKey = null;
let endOverrunGraceStartedAt = null;
let endOverrunGraceVideoKey = null;
let lastEndCountdownTime = null;
let skipEndAutoAdvanceKey = null;
let isEndAutoAdvancing = false;
let fullVersionPromptTimer = null;
let fullVersionPromptVideoKey = null;
const END_OVERRUN_GRACE_SECONDS = 10;
const END_SEEK_JUMP_THRESHOLD_SECONDS = 2.5;
const FULL_VERSION_PROMPT_SECONDS = 10;

function resetRandomPlayQueue() {
  randomPlayQueue = [];
  randomPlayQueueSignature = "";
}

function pushPlaybackHistory(video) {
  if (!video) return;

  const videoKey = getVideoKey(video);
  const lastVideo = playbackHistory[playbackHistory.length - 1];
  if (lastVideo && getVideoKey(lastVideo) === videoKey) return;

  playbackHistory.push(video);
  if (playbackHistory.length > 100) playbackHistory.shift();
}

function recordPlaybackHistoryForNext(video) {
  if (isRestoringPlaybackHistory || !currentPlayingVideo || !video) return;
  if (getVideoKey(currentPlayingVideo) === getVideoKey(video)) return;

  pushPlaybackHistory(currentPlayingVideo);
}

function playPreviousFromHistory() {
  while (playbackHistory.length) {
    const previousVideo = playbackHistory.pop();
    if (!previousVideo || getVideoKey(previousVideo) === nowPlayingKey) continue;
    const shouldScrollToFilteredOutNotice = !isVideoVisibleInCurrentFilters(previousVideo);

    isRestoringPlaybackHistory = true;
    try {
      loadVideo(previousVideo, null);
    } finally {
      isRestoringPlaybackHistory = false;
    }
    if (shouldScrollToFilteredOutNotice) {
      requestAnimationFrame(scrollToNowPlayingCard);
    }
    return true;
  }

  return false;
}

function isVideoVisibleInCurrentFilters(video) {
  const videoKey = getVideoKey(video);
  return currentFilteredVideos.some(filteredVideo => getVideoKey(filteredVideo) === videoKey);
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
    : getCurrentPlaybackList();
}

function getRandomQueueSignature(baseList, options = {}) {
  const list = getSafeVideoList(baseList);
  return [
    options.autoPlayableOnly ? "auto" : "manual",
    list.map(getVideoKey).join("|")
  ].join(":");
}

function buildRandomPlayQueue(baseList, options = {}) {
  const list = getSafeVideoList(baseList);
  if (!list.length) {
    randomPlayQueue = [];
    randomPlayQueueSignature = getRandomQueueSignature(list, options);
    return;
  }

  const currentKey = nowPlayingKey;
  const queueBase = list.length > 1
    ? list.filter(video => getVideoKey(video) !== currentKey)
    : list;

  randomPlayQueue = shuffleVideos(queueBase);
  randomPlayQueueSignature = getRandomQueueSignature(list, options);
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

// ===== リピート終了時処理 =====
function playCurrentVideoAgain() {
  const currentVideo = getCurrentVideo();
  if (!currentVideo) return;

  loadVideo(currentVideo, null);
}

function handleVideoEnded() {
  const repeatMode = getRepeatMode();

  stopEndCountdownMonitor();
  stopFullVersionPromptMonitor();

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

// ===== end指定による連続再生カウントダウン =====
function getEndCountdownUi() {
  let wrapper = document.getElementById("endCountdownControls");
  const actions = document.querySelector(".player-window-actions");
  if (wrapper || !actions) return wrapper;

  wrapper = document.createElement("div");
  wrapper.id = "endCountdownControls";
  wrapper.className = "end-countdown-controls hidden";

  const nextButton = document.createElement("button");
  nextButton.id = "endCountdownNextBtn";
  nextButton.type = "button";
  nextButton.className = "end-countdown-next";
  nextButton.addEventListener("click", advanceFromEndCountdown);

  const label = document.createElement("span");
  label.className = "end-countdown-label";
  label.textContent = "次の曲まで";

  const time = document.createElement("span");
  time.id = "endCountdownTime";
  time.className = "end-countdown-time";
  time.textContent = "10秒";

  nextButton.append(label, time);

  const keepButton = document.createElement("button");
  keepButton.id = "endCountdownKeepBtn";
  keepButton.type = "button";
  keepButton.className = "end-countdown-keep";
  keepButton.textContent = "このまま再生";
  keepButton.addEventListener("click", () => {
    if (endCountdownVideoKey) skipEndAutoAdvanceKey = endCountdownVideoKey;
    resetEndOverrunGrace();
    hideEndCountdownUi();
  });

  wrapper.append(nextButton, keepButton);
  actions.insertBefore(wrapper, actions.firstElementChild);

  return wrapper;
}

function formatCountdownTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  return `${safeSeconds}秒`;
}

function showEndCountdownUi(remainingSeconds) {
  hideFullVersionPromptUi();

  const wrapper = getEndCountdownUi();
  const time = document.getElementById("endCountdownTime");
  const nextButton = document.getElementById("endCountdownNextBtn");
  if (!wrapper || !time || !nextButton) return;

  const label = formatCountdownTime(remainingSeconds);
  time.textContent = label;
  nextButton.title = `次の曲へ進む（${label}）`;
  nextButton.setAttribute("aria-label", `次の曲へ進む（${label}）`);
  wrapper.classList.remove("hidden");
}

function hideEndCountdownUi() {
  document.getElementById("endCountdownControls")?.classList.add("hidden");
}

function stopEndCountdownMonitor(options = {}) {
  const { resetGrace = true } = options;

  if (endCountdownTimer) {
    clearInterval(endCountdownTimer);
    endCountdownTimer = null;
  }
  hideEndCountdownUi();
  endCountdownVideoKey = null;
  lastEndCountdownTime = null;
  if (resetGrace) resetEndOverrunGrace();
  isEndAutoAdvancing = false;
}

function resetEndCountdownForVideo(video) {
  const nextKey = getVideoKey(video);
  if (nextKey !== nowPlayingKey) skipEndAutoAdvanceKey = null;
  stopEndCountdownMonitor();
  endCountdownVideoKey = nextKey;
}

function shouldUseEndAutoAdvance(video) {
  return Boolean(
    video &&
    getRepeatMode() === REPEAT_MODE_ALL &&
    !isTikTokVideo(video) &&
    video._endSeconds !== null &&
    video._endSeconds !== undefined &&
    skipEndAutoAdvanceKey !== getVideoKey(video)
  );
}

function resetEndOverrunGrace() {
  endOverrunGraceStartedAt = null;
  endOverrunGraceVideoKey = null;
}

function startEndOverrunGrace(video) {
  endOverrunGraceVideoKey = getVideoKey(video);
  endOverrunGraceStartedAt = Date.now();
  showEndCountdownUi(END_OVERRUN_GRACE_SECONDS);
}

function getEndOverrunGraceRemainingSeconds() {
  if (!endOverrunGraceStartedAt) return END_OVERRUN_GRACE_SECONDS;

  const elapsedSeconds = (Date.now() - endOverrunGraceStartedAt) / 1000;
  return Math.max(0, END_OVERRUN_GRACE_SECONDS - elapsedSeconds);
}

function isEndOverrunFromSeek(currentTime) {
  if (lastEndCountdownTime === null) return false;

  const jumpedSeconds = currentTime - lastEndCountdownTime;
  return jumpedSeconds > END_SEEK_JUMP_THRESHOLD_SECONDS;
}

function advanceFromEndCountdown() {
  if (isEndAutoAdvancing) return;
  isEndAutoAdvancing = true;
  hideEndCountdownUi();

  if (isRandomModeEnabled()) {
    playRandomNextVideo({ autoPlayableOnly: true });
  } else {
    playAdjacentVideo(1);
  }
}

function checkEndCountdown(video) {
  if (isEndAutoAdvancing) return;

  if (!shouldUseEndAutoAdvance(video)) {
    hideEndCountdownUi();
    return;
  }
  if (!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;

  let currentTime = 0;
  try {
    currentTime = ytPlayer.getCurrentTime();
  } catch {
    return;
  }

  if (!Number.isFinite(currentTime)) return;

  const remainingSeconds = video._endSeconds - currentTime;
  if (remainingSeconds <= 0) {
    const cameFromSeek = isEndOverrunFromSeek(currentTime);
    const currentKey = getVideoKey(video);

    if (!endOverrunGraceStartedAt && !cameFromSeek) {
      advanceFromEndCountdown();
      return;
    }

    if (!endOverrunGraceStartedAt || endOverrunGraceVideoKey !== currentKey) {
      startEndOverrunGrace(video);
    }

    const graceRemainingSeconds = getEndOverrunGraceRemainingSeconds();
    showEndCountdownUi(graceRemainingSeconds);

    if (graceRemainingSeconds <= 0) {
      advanceFromEndCountdown();
    }

    return;
  }

  resetEndOverrunGrace();
  lastEndCountdownTime = currentTime;

  if (remainingSeconds <= 10) {
    showEndCountdownUi(remainingSeconds);
  } else {
    hideEndCountdownUi();
  }
}

function startEndCountdownMonitor(video) {
  const videoKey = getVideoKey(video);
  const shouldKeepGrace = endOverrunGraceVideoKey === videoKey;

  stopEndCountdownMonitor({ resetGrace: !shouldKeepGrace });
  endCountdownVideoKey = videoKey;

  if (!shouldUseEndAutoAdvance(video)) return;

  checkEndCountdown(video);
  endCountdownTimer = setInterval(() => checkEndCountdown(video), 500);
}

// ===== ハイライトShortsからフル版への誘導 =====
function isHighlightShortsVideo(video) {
  return Boolean(video?._isShorts && video._types?.includes("ハイライト"));
}

function getFullVersionTargetVideo(video) {
  if (!isHighlightShortsVideo(video) || !video._fullNumber) return null;

  return allVideos.find(candidate => candidate._number && candidate._number === video._fullNumber) || null;
}

function getPlayerWindowActions() {
  let actions = document.querySelector(".player-window-actions");
  if (actions) return actions;

  const fixedPlayerInner = fixedPlayerEl?.firstElementChild;
  if (!fixedPlayerInner) return null;

  actions = document.createElement("div");
  actions.className = "player-window-actions";
  fixedPlayerInner.prepend(actions);
  return actions;
}

function getFullVersionPromptUi() {
  let wrapper = document.getElementById("fullVersionPromptControls");
  if (wrapper) return wrapper;

  const actions = getPlayerWindowActions();
  if (!actions) return null;

  wrapper = document.createElement("div");
  wrapper.id = "fullVersionPromptControls";
  wrapper.className = "full-version-prompt-controls hidden";

  const button = document.createElement("button");
  button.id = "fullVersionPromptButton";
  button.type = "button";
  button.className = "full-version-prompt-button";
  button.textContent = "フル版を再生";
  button.addEventListener("click", playFullVersionFromPrompt);

  wrapper.append(button);
  actions.insertBefore(wrapper, actions.firstElementChild);

  return wrapper;
}

function isEndCountdownUiVisible() {
  const wrapper = document.getElementById("endCountdownControls");
  return Boolean(wrapper && !wrapper.classList.contains("hidden"));
}

function showFullVersionPromptUi(video) {
  if (isEndCountdownUiVisible()) {
    hideFullVersionPromptUi();
    return;
  }

  const targetVideo = getFullVersionTargetVideo(video);
  if (!targetVideo) {
    hideFullVersionPromptUi();
    return;
  }

  const wrapper = getFullVersionPromptUi();
  const button = document.getElementById("fullVersionPromptButton");
  if (!wrapper || !button) return;

  button.title = `${targetVideo["title"]} - ${targetVideo["artist"]}`;
  button.setAttribute("aria-label", `フル版を再生: ${targetVideo["title"]} - ${targetVideo["artist"]}`);
  wrapper.classList.remove("hidden");
}

function hideFullVersionPromptUi() {
  document.getElementById("fullVersionPromptControls")?.classList.add("hidden");
}

function stopFullVersionPromptMonitor() {
  if (fullVersionPromptTimer) {
    clearInterval(fullVersionPromptTimer);
    fullVersionPromptTimer = null;
  }
  hideFullVersionPromptUi();
  fullVersionPromptVideoKey = null;
}

function resetFullVersionPromptForVideo(video) {
  stopFullVersionPromptMonitor();
  fullVersionPromptVideoKey = getVideoKey(video);
}

function getFullVersionPromptRemainingSeconds(video) {
  if (!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return null;

  let currentTime;
  try {
    currentTime = ytPlayer.getCurrentTime();
  } catch {
    return null;
  }

  if (!Number.isFinite(currentTime)) return null;

  if (video._endSeconds !== null && video._endSeconds !== undefined) {
    return video._endSeconds - currentTime;
  }

  if (typeof ytPlayer.getDuration !== "function") return null;

  let duration;
  try {
    duration = ytPlayer.getDuration();
  } catch {
    return null;
  }

  if (!Number.isFinite(duration) || duration <= 0) return null;
  return duration - currentTime;
}

function checkFullVersionPrompt(video) {
  if (fullVersionPromptVideoKey !== getVideoKey(video)) return;

  if (!getFullVersionTargetVideo(video)) {
    hideFullVersionPromptUi();
    return;
  }

  if (isTikTokVideo(video)) {
    showFullVersionPromptUi(video);
    return;
  }

  const remainingSeconds = getFullVersionPromptRemainingSeconds(video);
  if (remainingSeconds !== null && remainingSeconds <= FULL_VERSION_PROMPT_SECONDS) {
    showFullVersionPromptUi(video);
  } else {
    hideFullVersionPromptUi();
  }
}

function startFullVersionPromptMonitor(video) {
  fullVersionPromptVideoKey = getVideoKey(video);

  if (!getFullVersionTargetVideo(video)) return;

  checkFullVersionPrompt(video);
  if (!isTikTokVideo(video)) {
    fullVersionPromptTimer = setInterval(() => checkFullVersionPrompt(video), 500);
  }
}

function playFullVersionFromPrompt() {
  const targetVideo = getFullVersionTargetVideo(currentPlayingVideo);
  if (!targetVideo) {
    hideFullVersionPromptUi();
    showPlaybackUnavailableNotice("フル版が見つかりません");
    return;
  }

  stopFullVersionPromptMonitor();
  loadVideo(targetVideo, null);
  requestAnimationFrame(scrollToNowPlayingCard);
}

// ===== プレイヤーボタンUI =====
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
  btn.title = label;
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
  btn.title = label;
  setPlayerControlIcon(btn, './assets/icon/icon-shuffle.png');
  btn.querySelector('.player-control-label').textContent = label;
}

    sortOrder.value = "desc";
document.getElementById('modalSortOrder').value = "desc";
    

// ===== データURL =====
    const sheetJsonUrl = './data/videos.json';
    const metaSheetUrl = './data/meta.json';


// ===== タグ・絞り込み状態の管理 =====
    var allVideos = [];
    var currentFilteredVideos = [];
    var nowPlayingKey = null;
    var currentPlayingVideo = null;
    var playbackHistory = [];
    var isRestoringPlaybackHistory = false;
    var selectedCategoryTag = "";
    var selectedDateTag = "";
    var selectedCollabTag = "";
    var selectedRoleTag = "";
    var selectedPlatformTag = "";
    var selected3DTag = null;
    var selectedShortsTag = null;
    let pendingListTagScrollVideoKey = null;
    let nowPlayingFloatingButton = null;
    let nowPlayingFloatingUpdateFrame = null;
    var selectedVideoTypeTags = new Set();

// ===== タグの表示・解除 =====
function parseCommaTags(value) {
  return String(value || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

function normalizeVideos(data) {
  return data.map(video => {
    const roles = parseCommaTags(video["担当区分"]);
    const types = parseCommaTags(video["動画種別"]);
    const collabLivers = parseCommaTags(video["コラボライバー"]);
    const collabUnits = parseCommaTags(video["コラボユニット"]);
    const platform = String(video["platform"] || "").trim().toLowerCase();
    const number = normalizeVideoNumber(video["number"]);
    const fullNumber = normalizeVideoNumber(video["full_number"]);
    const startSeconds = parseTimeToSeconds(video["start"], 0);
    const parsedEndSeconds = parseTimeToSeconds(video["end"], null);
    const endSeconds = parsedEndSeconds !== null && parsedEndSeconds > startSeconds
      ? parsedEndSeconds
      : null;

    video._roles = roles;
    video._types = types;
    video._collabLivers = collabLivers;
    video._collabUnits = collabUnits;
    video._collabTags = [...collabLivers, ...collabUnits];
    video._platform = platform;
    video._number = number;
    video._fullNumber = fullNumber;
    video._is3D = video["3D"] === "TRUE";
    video._isShorts = video["Shorts"] === "TRUE";
    video._startSeconds = startSeconds;
    video._endSeconds = endSeconds;
    video._time = window.DATE_UTILS.parseYmdToTime(video["公開日"] || video["公開月"]);
    video._searchText = [
      video["title"],
      video["title_kana"],
      video["artist"],
      video["artist_kana"],
      video["waku_name"],
      video["カテゴリ"],
      video["platform"],
      window.TAG_CONFIG?.getPlatformLabel?.(platform),
      video["動画種別"],
      video["担当区分"],
      video["コラボライバー"],
      video["コラボユニット"],
      video._is3D ? "3D" : "",
      video._isShorts ? "Shorts" : "",
      types.join(" "),
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

function getDateTagLabel(value) {
  return window.DATE_UTILS.getDateTagLabel(value);
}

function getPlatformLabel(value) {
  return window.TAG_CONFIG.getPlatformLabel(value);
}

function sortCollabTagsForDisplay(values) {
  const tags = Array.isArray(values) ? values : [];
  if (window.isCollabTagOrderReady && typeof window.sortCollabTagValues === "function") {
    return window.sortCollabTagValues(tags);
  }
  return [...tags];
}

function clearDateTag() {
  window.FilterState.setState({ date: "" });

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

  const activeTags = window.FilterState.getActiveChips();

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

    chip.className = tagData.state === "exclude"
      ? 'exclusion-style-chip px-3 py-1 rounded-full text-sm whitespace-nowrap transition'
      : 'tag-button tag-xs tag-active-chip';

    chip.textContent = tagData.state === "exclude" ? `- ${tagData.label}` : tagData.label;
    if (tagData.state === "exclude") {
      chip.setAttribute("aria-label", `${tagData.label}を除外条件から外す`);
    }
    chip.dataset.filterChipState = tagData.state;
    if (tagData.source) chip.dataset.activeChipSource = tagData.source;
    
    chip.addEventListener('click', () => {
      // 解除処理

      if (tagData.state === "exclude") {
        window.FilterState.setTagState(tagData.group, tagData.value, "none");
        applyFilters();
        return;
      }
    
        if (tagData.source === 'videoType') {
        window.FilterState.setTagState(tagData.group, tagData.value, "none");
        applyFilters();
        return;
      }

      if (tagData.source === 'date') {
        clearDateTag();
        return;
      }

      if (tagData.source === 'platform') {
        window.FilterState.setTagState(tagData.group, tagData.value, "none");
        renderPlatformTags();
        applyFilters();
        return;
      }

      switch (tagData.group) {
        case "category":
            window.FilterState.setTagState(tagData.group, tagData.value, "none");
            renderCategoryTags([...new Set(allVideos.map(v => v["カテゴリ"]).filter(Boolean))].sort());
          break;
        default:
          window.FilterState.setTagState(tagData.group, tagData.value, "none");
          break;
      }

      applyFilters();
    });

    activeTagChipsInner.appendChild(chip);
  });
}

if (activeTagChipsInner) {
  activeTagChipsInner.addEventListener('click', event => {
    const chip = event.target.closest('[data-active-chip-source="date"][data-filter-chip-state="include"]');
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

function createListTagElement(label, group, value, isActive, onClick) {
  const kindMap = {
    category: "tag-style",
    platform: "tag-platform",
    format: "tag-format",
    role: "tag-role-filter"
  };
  const kind = kindMap[group] || "tag-format";
  const tag = document.createElement('button');

  tag.type = 'button';
  tag.className = getTagButtonClass(kind, isActive);
  tag.textContent = label;
  tag.dataset.filterGroup = group;
  tag.dataset.filterValue = value;
  tag.addEventListener('click', onClick);

  return tag;
}

function handleListTagClick(group, value, options = {}) {
  const { allowExclude = true, beforeApply = null } = options;
  const nextState = window.FilterState.toggleTag(group, value);

  if (!allowExclude && nextState === "exclude") {
    window.FilterState.setTagState(group, value, "none");
  }

  if (typeof beforeApply === "function") beforeApply();
  syncFilterControlsAfterListTagClick();
  applyFilters();
}

function syncFilterControlsAfterListTagClick() {
  if (Array.isArray(allVideos)) {
    renderCategoryTags([...new Set(allVideos.map(video => video["カテゴリ"]).filter(Boolean))].sort());
  }

  renderPlatformTags();
  renderDateTags();
  window.dispatchEvent(new CustomEvent("tagFilterStateChanged"));
}

function captureListTagScrollSource(event) {
  const button = event.target.closest('#videoList button[data-filter-group][data-filter-value]');
  if (!button) return;

  const sourceCard = button.closest('[data-video-key]');
  pendingListTagScrollVideoKey = sourceCard?.dataset.videoKey || null;
}

document.addEventListener('click', captureListTagScrollSource, true);

function parseSearchQuery(query) {
  const tokens = String(query || "").trim().split(/\s+/).filter(Boolean);
  const excludeTerms = [];
  const groups = [[]];

  tokens.forEach(token => {
    if (token.startsWith("-") && token.length > 1) {
      excludeTerms.push(token.slice(1).toLowerCase());
      return;
    }

    if (token === "OR") {
      if (groups[groups.length - 1].length) groups.push([]);
      return;
    }

    groups[groups.length - 1].push(token.toLowerCase());
  });

  return {
    excludeTerms,
    groups: groups.filter(group => group.length)
  };
}

function matchesSearchQuery(video, query) {
  const rawQuery = String(query || "").trim();
  if (!rawQuery) return true;

  const text = video._searchText || "";
  const { excludeTerms, groups } = parseSearchQuery(rawQuery);
  const hasExcludedTerm = excludeTerms.some(term => text.includes(term));
  if (hasExcludedTerm) return false;

  if (!groups.length) return true;

  return groups.some(group => group.every(term => text.includes(term)));
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
    if (getRepeatMode() === REPEAT_MODE_ALL) {
      const currentVideo = getCurrentVideo();
      if (currentVideo) startEndCountdownMonitor(currentVideo);
    } else {
      stopEndCountdownMonitor();
    }
    requestNowPlayingFloatingButtonUpdate();
  });
}

if (randomModeBtn) {
  updateRandomModeButton();

  randomModeBtn.addEventListener('click', () => {
    setRandomModeEnabled(!isRandomModeEnabled());
    resetRandomPlayQueue();
    updateRandomModeButton();
    requestNowPlayingFloatingButtonUpdate();
  });
}

    // モバイル用フィルターモーダル制御
document.getElementById('openFilterModal')?.addEventListener('click', () => {
  document.getElementById('filterModal').classList.remove('hidden');
});

document.getElementById('closeFilterModal')?.addEventListener('click', () => {
  document.getElementById('filterModal').classList.add('hidden');
});

window.addEventListener('scroll', requestNowPlayingFloatingButtonUpdate, { passive: true });
window.addEventListener('resize', requestNowPlayingFloatingButtonUpdate);
window.visualViewport?.addEventListener('resize', requestNowPlayingFloatingButtonUpdate);

if (window.ResizeObserver) {
  const nowPlayingFloatingResizeObserver = new ResizeObserver(requestNowPlayingFloatingButtonUpdate);
  [fixedPlayerEl, document.getElementById('nowPlayingWrapper'), playerFrameWrapper].forEach(element => {
    if (element) nowPlayingFloatingResizeObserver.observe(element);
  });
}

const nowPlayingFloatingMutationObserver = new MutationObserver(scheduleNowPlayingFloatingButtonSettledUpdate);
[fixedPlayerEl, document.getElementById('nowPlayingWrapper'), playerFrameWrapper].forEach(element => {
  if (element) {
    nowPlayingFloatingMutationObserver.observe(element, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }
});


  const randomPlayButton = document.getElementById('randomPlayButton');
    randomPlayButton.addEventListener('click', () => {
  playRandomVideoFromCurrentList();
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
      style="max-width:360px; min-width:0; width:100%;">
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
  const { roleOrder } = window.TAG_CONFIG;
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
    playRandomVideoFromCurrentList();
  });
}

       [searchInput, sortOrder].forEach(el => {
  el.addEventListener('change', applyFilters);
  el.addEventListener('input', applyFilters);
});


     // リセットボタン
  resetButton.addEventListener('click', () => {
  window.FilterState.resetState();
    renderCategoryTags([...new Set(allVideos.map(v => v["カテゴリ"]).filter(Boolean))].sort());
  renderDateTags();
  renderPlatformTags();
    
  document.getElementById('modalCategoryFilter').value = "";
  document.getElementById('modalDateFilter').value = "";
  document.getElementById('modalTypeFilter').value = "";
  document.getElementById('modalRoleFilter').value = "";
  document.getElementById('modalSearchInput').value = "";
  document.getElementById('modalSortOrder').value = "desc";
  applyFilters();
  window.dispatchEvent(new CustomEvent("tagFilterStateChanged"));
});
      }

// ===== タグボタンの描画 =====
function isDesktopFilterContainer(container) {
  return container?.id?.startsWith("desktop");
}

function isMobileFilterContainer(container) {
  return container?.id?.startsWith("modal");
}

function applyDesktopFilterTagClick(group, value, renderUpdatedTags) {
  window.FilterState.toggleTag(group, value);
  if (typeof renderUpdatedTags === "function") renderUpdatedTags();
  applyFilters();
  window.dispatchEvent(new CustomEvent("tagFilterStateChanged"));
}

function applyMobileFilterTagClick(group, value, renderUpdatedTags) {
  window.FilterState.toggleTag(group, value);
  if (typeof renderUpdatedTags === "function") renderUpdatedTags();
  applyFilters();
  window.dispatchEvent(new CustomEvent("tagFilterStateChanged"));
}

function renderPlatformTags() {
  const containers = [
    document.getElementById('modalPlatformTags'),
    document.getElementById('desktopPlatformTags')
  ].filter(Boolean);

  containers.forEach(container => {
    container.innerHTML = '';

    window.TAG_CONFIG.platformValues.forEach(p => {
      const btn = document.createElement('button');
      const isActive = window.FilterState.isTagIncluded("platform", p);

      btn.className = getTagButtonClass("tag-platform", isActive, { size: "tag-sm" });

        btn.textContent = getPlatformLabel(p);
        btn.dataset.filterGroup = "platform";
        btn.dataset.filterValue = p;

      btn.onclick = () => {
        if (isDesktopFilterContainer(container)) {
          applyDesktopFilterTagClick("platform", p, renderPlatformTags);
          return;
        }

        if (isMobileFilterContainer(container)) {
          applyMobileFilterTagClick("platform", p, renderPlatformTags);
          return;
        }

        window.FilterState.setTagState("platform", p, isActive ? "none" : "include");
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
      const isActive = window.FilterState.isTagIncluded("category", category);

      btn.className = getTagButtonClass("tag-style", isActive, { size: "tag-sm" });

        btn.textContent = category;
        btn.dataset.filterGroup = "category";
        btn.dataset.filterValue = category;

      btn.onclick = () => {
        const modalCategoryFilter = document.getElementById('modalCategoryFilter');
        if (modalCategoryFilter) modalCategoryFilter.value = "";

        if (isDesktopFilterContainer(container)) {
          applyDesktopFilterTagClick("category", category, () => renderCategoryTags(categories));
          return;
        }

        if (isMobileFilterContainer(container)) {
          applyMobileFilterTagClick("category", category, () => renderCategoryTags(categories));
          return;
        }

        window.FilterState.setTagState("category", category, isActive ? "none" : "include");

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
      const isActive = window.FilterState.isTagIncluded("date", opt.value);

      btn.className = getTagButtonClass("tag-time", isActive, { size: "tag-sm" });

        btn.textContent = opt.label;
        btn.dataset.filterGroup = "time";
        btn.dataset.filterValue = opt.value;

      btn.onclick = () => {
        const modalDate = document.getElementById('modalDateFilter');
        if (modalDate) modalDate.value = "";

        if (isDesktopFilterContainer(container)) {
          applyDesktopFilterTagClick("date", opt.value, renderDateTags);
          return;
        }

        if (isMobileFilterContainer(container)) {
          applyMobileFilterTagClick("date", opt.value, renderDateTags);
          return;
        }

        window.FilterState.setTagState("date", opt.value, isActive ? "none" : "include");

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
        const searchQuery = searchInput.value;
        const now = new Date();
        const filterState = window.FilterState.getState();
        let filtered = allVideos.filter(video => {
  return matchesSearchQuery(video, searchQuery) &&
    
// フィルタ条件
    (!filterState.include.category || video["カテゴリ"] === filterState.include.category) &&
    (!filterState.include.collab || video._collabTags.includes(filterState.include.collab)) &&
    (!filterState.include.role || video._roles.includes(filterState.include.role)) &&
    (!filterState.include.platform || video._platform === filterState.include.platform) &&
    window.DATE_UTILS.getDateFilterMatch(filterState.include.date, video._time, now) &&
  (
!filterState.include.flag.includes("3D") ||
  video._is3D
) &&
(
!filterState.include.flag.includes("Shorts") ||
video._isShorts
) &&
(
 filterState.include.format.length === 0 ||
  filterState.include.format.every(tag => video._types.includes(tag))
 )
});

const coll = new Intl.Collator('ja');

function videoTime(v) {
  return v._time;
}

const order = sortOrder.value || "desc";

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

const visibleVideos = getVisibleFilteredVideos(filtered);

        currentFilteredVideos = visibleVideos;
resetRandomPlayQueue();
renderVideoList(visibleVideos);
renderActiveTagChips();
      }


// ===== 動画一覧の描画 =====
function updateResultCounts(totalCount, visibleCount) {
  const countElement = document.getElementById('songCount');
  const desktopResultCount = document.getElementById('desktopResultCount');
  const desktopResultTotal = document.getElementById('desktopResultTotal');
  const desktopResultVisible = document.getElementById('desktopResultVisible');

  if (countElement) {
    countElement.innerHTML = `
      <span class="text-xs">全</span>
      <span class="text-base font-semibold text-gray-700">${totalCount}</span>
      <span class="text-xs">件中</span>
      <span class="text-xl font-bold text-blue-600">${visibleCount}</span>
      <span class="text-xs">件表示</span>
    `;
  }

  if (desktopResultCount && desktopResultTotal && desktopResultVisible) {
    desktopResultTotal.textContent = String(totalCount);
    desktopResultVisible.textContent = String(visibleCount);
  }
}

function renderVideoList(videos) {
  videoList.innerHTML = '';

    // 件数表示を更新
  const countElement = document.getElementById('songCount');
  updateResultCounts(allVideos.length, videos.length);

  const oldNotice = document.getElementById('autoPlayNotice');
if (oldNotice) oldNotice.remove();

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

    const key = getVideoKey(video);
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
const normalizedPlatform = video._platform;
let roleTagRow = null;

if (
  category ||
  normalizedPlatform ||
  roles.length ||
  typeTags.length ||
  video._is3D ||
  video._isShorts
) {
  roleTagRow = document.createElement('div');
  roleTagRow.className = 'flex flex-wrap gap-1.5 mt-2';

  if (category) {
    roleTagRow.appendChild(createListTagElement(
      category,
      "category",
      category,
      window.FilterState.isTagIncluded("category", category),
      () => {
        handleListTagClick("category", category, {
          beforeApply: () => {
            const modalCategoryFilter = document.getElementById('modalCategoryFilter');
            if (modalCategoryFilter) modalCategoryFilter.value = "";
          }
        });
      }
    ));
  }

  if (normalizedPlatform) {
    roleTagRow.appendChild(createListTagElement(
      getPlatformLabel(normalizedPlatform),
      "platform",
      normalizedPlatform,
      window.FilterState.isTagIncluded("platform", normalizedPlatform),
      () => {
        handleListTagClick("platform", normalizedPlatform);
      }
    ));
  }

  typeTags.forEach(type => {
    roleTagRow.appendChild(createListTagElement(
      type,
      "format",
      type,
      window.FilterState.isTagIncluded("format", type),
      () => {
        handleListTagClick("format", type);
      }
    ));
  });

  if (video._is3D) {
    roleTagRow.appendChild(createListTagElement(
      "3D",
      "format",
      "3D",
      window.FilterState.isTagIncluded("format", "3D"),
      () => {
        handleListTagClick("format", "3D");
      }
    ));
  }

  if (video._isShorts) {
    roleTagRow.appendChild(createListTagElement(
      "Shorts",
      "format",
      "Shorts",
      window.FilterState.isTagIncluded("format", "Shorts"),
      () => {
        handleListTagClick("format", "Shorts");
      }
    ));
  }

  roles.forEach(role => {
    roleTagRow.appendChild(createListTagElement(
      role,
      "role",
      role,
      window.FilterState.isTagIncluded("role", role),
      () => {
        handleListTagClick("role", role, {
          beforeApply: () => {
            const modalRoleFilter = document.getElementById('modalRoleFilter');
            if (modalRoleFilter) modalRoleFilter.value = "";
          }
        });
      }
    ));
  });
    }

// 3行目：コラボタグ
const collabLivers = sortCollabTagsForDisplay(video._collabLivers);
const collabUnits = sortCollabTagsForDisplay(video._collabUnits);

let tagRow = null;

if (collabLivers.length || collabUnits.length) {
  tagRow = document.createElement('div');
  tagRow.className = 'flex flex-wrap gap-1.5 mt-2';

  collabLivers.forEach(name => {
    const tag = document.createElement('button');
    tag.type = 'button';

    const isActive = window.FilterState.isTagIncluded("collab", name);
    tag.className = getTagButtonClass("tag-collab-liver", isActive);

    tag.textContent = name;
    tag.dataset.filterGroup = "collab";
    tag.dataset.filterValue = name;

    tag.addEventListener('click', () => {
      handleListTagClick("collab", name);
    });

    tagRow.appendChild(tag);
  });

  collabUnits.forEach(unit => {
    const tag = document.createElement('button');
    tag.type = 'button';

    const isActive = window.FilterState.isTagIncluded("collab", unit);
    tag.className = getTagButtonClass("tag-collab-unit", isActive);

    tag.textContent = unit;
    tag.dataset.filterGroup = "collab";
    tag.dataset.filterValue = unit;

    tag.addEventListener('click', () => {
      handleListTagClick("collab", unit);
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

  const handledListTagScroll = scrollToListTagFilterSource(pendingListTagScrollVideoKey);
  pendingListTagScrollVideoKey = null;

  // スクロール実行
  if (!handledListTagScroll && playingElement) {
    window.ScrollUtils.scrollElementIntoComfortView(playingElement);
  }

  updateNowPlayingFilteredOutNotice({ scroll: !handledListTagScroll && !playingElement });
  requestNowPlayingFloatingButtonUpdate();
  window.dispatchEvent(new CustomEvent("videoListRendered"));
}

window.addEventListener("collabTagOrderReady", () => {
  if (!Array.isArray(currentFilteredVideos) || !currentFilteredVideos.length) return;
  window.renderVideoList(currentFilteredVideos);
});

function scrollToListTagFilterSource(sourceVideoKey) {
  if (!sourceVideoKey) return false;

  const sourceElement = [...videoList.querySelectorAll('[data-video-key]')]
    .find(item => item.dataset.videoKey === sourceVideoKey);

  if (sourceElement) {
    window.ScrollUtils.scrollElementIntoComfortView(sourceElement);
    return true;
  }

  window.ScrollUtils.scrollToResultCountOrListTop();
  return true;
}

function getNowPlayingCardElement() {
  if (!nowPlayingKey) return null;
  return [...videoList.querySelectorAll('[data-video-key]')]
    .find(item => item.dataset.videoKey === nowPlayingKey) || null;
}

function isNowPlayingCardVisible() {
  const card = getNowPlayingCardElement();
  return window.ScrollUtils.isElementComfortablyVisible(card);
}

function getNowPlayingFloatingButton() {
  if (nowPlayingFloatingButton) return nowPlayingFloatingButton;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'nowPlayingFloatingButton';
  button.className = 'back-to-top-button now-playing-floating-button';
  button.textContent = '♪';
  button.setAttribute('aria-label', '再生中のカードへ移動');
  button.title = '再生中へ';
  button.addEventListener('click', scrollToNowPlayingCard);
  document.body.appendChild(button);

  nowPlayingFloatingButton = button;
  return button;
}

function syncNowPlayingFloatingButtonOffset(button, shouldShow) {
  const playerOffset = window.ScrollUtils.getPlayerBottomOffset();
  const isPlayerVisible = playerOffset > 0;
  const backToTopButton = document.getElementById('backToTopButton');

  button.style.setProperty('--back-to-top-player-offset', `${playerOffset}px`);
  button.classList.toggle('is-player-visible', isPlayerVisible);

  if (backToTopButton) {
    backToTopButton.style.setProperty('--back-to-top-player-offset', `${playerOffset}px`);
    backToTopButton.classList.toggle('has-now-playing-companion', shouldShow);
    backToTopButton.dispatchEvent(new Event('now-playing-companion-change'));
  }
}

function updateNowPlayingFloatingButton() {
  const button = getNowPlayingFloatingButton();
  const shouldShow = Boolean(nowPlayingKey) && !isNowPlayingCardVisible();

  button.classList.toggle('is-visible', shouldShow);
  syncNowPlayingFloatingButtonOffset(button, shouldShow);
}

function scheduleNowPlayingFloatingButtonSettledUpdate() {
  requestNowPlayingFloatingButtonUpdate();
  window.setTimeout(requestNowPlayingFloatingButtonUpdate, 300);
  window.setTimeout(requestNowPlayingFloatingButtonUpdate, 700);
}

function requestNowPlayingFloatingButtonUpdate() {
  if (nowPlayingFloatingUpdateFrame !== null) return;

  nowPlayingFloatingUpdateFrame = requestAnimationFrame(() => {
    nowPlayingFloatingUpdateFrame = null;
    updateNowPlayingFloatingButton();
  });
}

function scrollToNowPlayingCard() {
  if (!nowPlayingKey) return;

  const playingElement = getNowPlayingCardElement();
  if (playingElement) {
    window.ScrollUtils.scrollElementIntoComfortView(playingElement);
    scheduleNowPlayingFloatingButtonSettledUpdate();
    return;
  }

  const notice = document.getElementById('nowPlayingFilteredOutNotice');
  const countElement = document.getElementById('songCount');
  window.ScrollUtils.scrollElementIntoComfortView(notice || countElement || videoList);
  scheduleNowPlayingFloatingButtonSettledUpdate();
}

function updateNowPlayingFilteredOutNotice(options = {}) {
  const { scroll = false } = options;
  const oldNotice = document.getElementById('nowPlayingFilteredOutNotice');
  if (oldNotice) oldNotice.remove();

  if (!nowPlayingKey || !currentFilteredVideos.length) return;

  const isVisible = currentFilteredVideos.some(video => getVideoKey(video) === nowPlayingKey);
  if (isVisible) return;

  const countElement = document.getElementById('songCount');
  if (!countElement) return;

  const notice = document.createElement('div');
  notice.id = 'nowPlayingFilteredOutNotice';
  notice.className = 'auto-play-notice';
  notice.textContent = '再生中の曲は今の絞り込み条件では表示されていません';
  countElement.insertAdjacentElement('afterend', notice);

  if (scroll) {
    window.ScrollUtils.scrollElementIntoComfortView(notice);
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
    window.ScrollUtils.scrollElementIntoComfortView(playingElement);
  }
}

function clearNowPlayingState() {
  nowPlayingKey = null;
  currentPlayingVideo = null;
  playbackHistory = [];
  updateNowPlayingHighlight();
  updateNowPlayingFilteredOutNotice();
  requestNowPlayingFloatingButtonUpdate();
}

function updateNowPlaying(video) {
  const nowPlayingTitle = document.getElementById('nowPlayingTitle');
  const label = `${video["title"]} - ${video["artist"]}`;
  nowPlayingTitle.textContent = label;
  nowPlayingTitle.title = label;
  window.NowPlayingMarquee?.refresh(label);
  nowPlayingKey = getVideoKey(video);
  currentPlayingVideo = video;
  updateNowPlayingHighlight();
  updateNowPlayingFilteredOutNotice();
  requestNowPlayingFloatingButtonUpdate();
}

// ===== 動画の再生処理 =====
function loadVideo(video, item) {
  resetEndCountdownForVideo(video);
  resetFullVersionPromptForVideo(video);
  const start = video._startSeconds ?? parseTimeToSeconds(video["start"], 0);
  let videoId = video["videoId"];
  let platform = video._platform || (video["platform"] || "").toLowerCase();

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

  startEndCountdownMonitor(video);
  startFullVersionPromptMonitor(video);

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
    
  stopEndCountdownMonitor();
  startFullVersionPromptMonitor(video);

  } else {
    alert(`未対応の platform: ${platform}`);
    return;
  }

  

  recordPlaybackHistoryForNext(video);
  updateNowPlaying(video);
}

// ===== プレイヤーを閉じる =====
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    stopEndCountdownMonitor();
    stopFullVersionPromptMonitor();
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
    clearNowPlayingState();
    fixedPlayerEl.style.display = 'none';
  });
}




  // 古い埋め込みプレイヤーを削除（固定プレイヤーを使うので他のプレイヤーは削除）
  document.querySelectorAll('.video-player-container').forEach(el => el.remove());

// ===== 前へ/次へ =====
const prevVideoBtn = document.getElementById('prevVideoBtn');
const nextVideoBtn = document.getElementById('nextVideoBtn');

function playAdjacentVideo(direction) {
  const list = getAdjacentPlaybackList();
  if (!list.length) return;

  const currentIndex = list.findIndex(v => getVideoKey(v) === nowPlayingKey);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const newIndex = (safeCurrentIndex + direction + list.length) % list.length;
  loadVideo(list[newIndex], null);
}

function playNextVideo() {
  if (isRandomModeEnabled()) {
    playRandomNextVideo();
  } else {
    playAdjacentVideo(1);
  }
}

function playPreviousVideo() {
  if (isRandomModeEnabled() && playPreviousFromHistory()) return;

  playAdjacentVideo(-1);
}

if (prevVideoBtn) {
  prevVideoBtn.setAttribute('aria-label', '前の曲（Shift + A）');
  prevVideoBtn.title = '前の曲（Shift + A）';

  prevVideoBtn.addEventListener('click', () => {
    playPreviousVideo();
  });
}

if (nextVideoBtn) {
  nextVideoBtn.setAttribute('aria-label', '次の曲（Shift + D）');
  nextVideoBtn.title = '次の曲（Shift + D）';

  nextVideoBtn.addEventListener('click', () => {
    playNextVideo();
  });
}

// ===== キーボードショートカット =====
function isTypingTarget(target) {
  if (!(target instanceof Element)) return false;

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'));
}

function isPlayerVisible() {
  return Boolean(
    fixedPlayerEl &&
    getComputedStyle(fixedPlayerEl).display !== 'none'
  );
}

document.addEventListener('keydown', event => {
  if (isTypingTarget(event.target)) return;
  if (!isPlayerVisible()) return;
  if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

  const key = event.key.toLowerCase();
  const code = event.code;

  if ((key === 'a' || code === 'KeyA') && prevVideoBtn) {
    event.preventDefault();
    prevVideoBtn.click();
  } else if ((key === 'd' || code === 'KeyD') && nextVideoBtn) {
    event.preventDefault();
    nextVideoBtn.click();
  }
});
