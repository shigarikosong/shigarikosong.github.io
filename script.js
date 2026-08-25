// ===== 要素の取得 =====
    const fixedPlayerEl = document.getElementById('fixedPlayer');
    const playerIframe = document.getElementById('playerIframe');
    const youtubePlayerEl = document.getElementById('youtubePlayer');
    const tiktokPlayerEl = document.getElementById('tiktokPlayer');
    const fixedPlayerInner = document.getElementById('fixedPlayerInner');
    const playerStageDock = document.getElementById('playerStageDock');
    const playerStage = document.getElementById('playerStage');
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
    const MANUAL_PLAY_TEST_KEY = 'manualPlayTestMode';
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

function isManualPlayTestModeEnabled() {
  return localStorage.getItem(MANUAL_PLAY_TEST_KEY) === '1';
}

function setManualPlayTestModeEnabled(on) {
  const enabled = Boolean(on);
  localStorage.setItem(MANUAL_PLAY_TEST_KEY, enabled ? '1' : '0');
  window.dispatchEvent(new CustomEvent('manualPlayTestModeChange', {
    detail: { enabled }
  }));
}

window.isManualPlayTestModeEnabled = isManualPlayTestModeEnabled;
window.setManualPlayTestModeEnabled = setManualPlayTestModeEnabled;

function shouldCueYouTubeVideo(options = {}) {
  if (options.autoplay === false) return true;
  if (options.autoplay === true) return false;
  return isManualPlayTestModeEnabled();
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

function showManualPlayTestModeNotice(enabled) {
  const oldNotice = document.getElementById('manualPlayTestNotice');
  if (oldNotice) oldNotice.remove();

  const notice = document.createElement('div');
  notice.id = 'manualPlayTestNotice';
  notice.className = 'manual-play-test-notice';
  notice.textContent = enabled
    ? '検証モード: YouTube手動再生'
    : '検証モード: YouTube通常再生';
  document.body.appendChild(notice);

  window.setTimeout(() => {
    notice.remove();
  }, 2400);
}

window.showManualPlayTestModeNotice = showManualPlayTestModeNotice;

function applyManualPlayTestModeFromUrl() {
  const manualPlay = new URLSearchParams(location.search).get('manualPlay');
  if (manualPlay !== '1' && manualPlay !== '0') return;

  const enabled = manualPlay === '1';
  setManualPlayTestModeEnabled(enabled);
  showManualPlayTestModeNotice(enabled);
}

applyManualPlayTestModeFromUrl();

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
const DEFAULT_FULL_VERSION_PROMPT_TEXT = "Full ver. を再生";

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
  if (nextVideo) loadVideo(nextVideo, null, options.loadVideoOptions || {});
}

// ===== リピート終了時処理 =====
function playCurrentVideoAgain(options = {}) {
  const currentVideo = getCurrentVideo();
  if (!currentVideo) return;

  loadVideo(currentVideo, null, options.loadVideoOptions || {});
}

function handleVideoEnded() {
  const repeatMode = getRepeatMode();

  stopEndCountdownMonitor();
  stopFullVersionPromptMonitor();

  if (repeatMode === REPEAT_MODE_OFF) return;

  if (repeatMode === REPEAT_MODE_ONE) {
    playCurrentVideoAgain({ loadVideoOptions: { autoplay: true } });
    return;
  }

  if (isRandomModeEnabled()) {
    playRandomNextVideo({
      autoPlayableOnly: true,
      loadVideoOptions: { autoplay: true }
    });
  } else {
    playAdjacentVideo(1, { loadVideoOptions: { autoplay: true } });
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
    const hasPreviousTimeSample = lastEndCountdownTime !== null;

    if (!endOverrunGraceStartedAt && hasPreviousTimeSample && !cameFromSeek) {
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

// ===== full_numberからフル版への誘導 =====
function getFullVersionTargetVideo(video) {
  if (!video?._fullNumber) return null;

  return allVideos.find(candidate => candidate._number && candidate._number === video._fullNumber) || null;
}

function getFullVersionPromptText(video) {
  return video?._fullButtonText || DEFAULT_FULL_VERSION_PROMPT_TEXT;
}

function getPlayerWindowActions() {
  let actions = document.querySelector(".player-window-actions");
  if (actions) return actions;

  const actionsHost = playerStageDock || fixedPlayerEl?.firstElementChild;
  if (!actionsHost) return null;

  actions = document.createElement("div");
  actions.className = "player-window-actions";
  actionsHost.prepend(actions);
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
  button.textContent = DEFAULT_FULL_VERSION_PROMPT_TEXT;
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

  const buttonText = getFullVersionPromptText(video);
  const targetLabel = `${targetVideo["title"]} - ${targetVideo["artist"]}`;
  button.textContent = buttonText;
  button.title = `${buttonText}: ${targetLabel}`;
  button.setAttribute("aria-label", `${buttonText}: ${targetLabel}`);
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
  if (fullVersionPromptTimer) {
    clearInterval(fullVersionPromptTimer);
    fullVersionPromptTimer = null;
  }

  fullVersionPromptVideoKey = getVideoKey(video);

  if (!getFullVersionTargetVideo(video)) {
    hideFullVersionPromptUi();
    return;
  }

  checkFullVersionPrompt(video);
  if (!isTikTokVideo(video)) {
    fullVersionPromptTimer = setInterval(() => checkFullVersionPrompt(video), 500);
  }
}

function refreshFullVersionPromptForCurrentVideo() {
  const currentVideo = getCurrentVideo();
  if (!currentVideo || getVideoKey(currentVideo) !== nowPlayingKey) return;

  startFullVersionPromptMonitor(currentVideo);
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
const PLAYER_CONTROL_ICONS = Object.freeze({
  play: './assets/icon/icon-play.png?v=2',
  pause: './assets/icon/icon-pause.png?v=2',
  repeat: './assets/icon/icon-repeat.png?v=2',
  repeatOne: './assets/icon/icon-repeat-one.png?v=2',
  shuffle: './assets/icon/icon-shuffle.png?v=2'
});
const TIKTOK_PLAYER_STATES = Object.freeze({
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3
});
const TIKTOK_COMMAND_RETRY_DELAYS = Object.freeze([300, 900, 1800]);
let isYouTubePlaybackRequested = false;
let isTikTokPlaybackRequested = false;
let isTikTokPlayerReady = false;
let isTikTokPlayerFrameLoaded = false;
let isTikTokPlaybackControlActivated = false;
let pendingTikTokPlaybackCommand = null;
let tiktokPlaybackCommandTimers = [];

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

function setPlayerControlLabel(button, label) {
  if (!button) return;

  button.setAttribute('aria-label', label);
  button.title = label;
  const text = button.querySelector('.player-control-label');
  if (text) text.textContent = label;
}

function getCurrentPlaybackPlatform() {
  return String(
    currentPlayingVideo?._platform || currentPlayingVideo?.platform || ''
  ).trim().toLowerCase();
}

function getYouTubePlayerState() {
  if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return null;

  try {
    return ytPlayer.getPlayerState();
  } catch (error) {
    console.warn('YouTube player state could not be read:', error);
    return null;
  }
}

function syncYouTubePlaybackIntentFromState(playerState) {
  const playingState = window.YT?.PlayerState?.PLAYING ?? 1;
  const endedState = window.YT?.PlayerState?.ENDED ?? 0;
  const pausedState = window.YT?.PlayerState?.PAUSED ?? 2;
  const cuedState = window.YT?.PlayerState?.CUED ?? 5;

  if (playerState === playingState) {
    isYouTubePlaybackRequested = true;
  } else if (
    playerState === pausedState ||
    playerState === endedState ||
    playerState === cuedState
  ) {
    isYouTubePlaybackRequested = false;
  }
}

function syncTikTokPlaybackIntentFromState(playerState) {
  if (playerState === TIKTOK_PLAYER_STATES.playing) {
    isTikTokPlaybackRequested = true;
  } else if (
    playerState === TIKTOK_PLAYER_STATES.paused ||
    playerState === TIKTOK_PLAYER_STATES.ended
  ) {
    isTikTokPlaybackRequested = false;
  }
}

function renderPlayPauseButton(button, isPlaybackRequested) {
  const label = isPlaybackRequested ? '一時停止' : '再生';

  button.dataset.state = isPlaybackRequested ? 'playing' : 'paused';
  setPlayerControlIcon(
    button,
    isPlaybackRequested ? PLAYER_CONTROL_ICONS.pause : PLAYER_CONTROL_ICONS.play
  );
  setPlayerControlLabel(button, label);
}

function updatePlayPauseButton(playerState = null, sourcePlatform = null) {
  const btn = document.getElementById('playPauseBtn');
  if (!btn) return;

  const platform = getCurrentPlaybackPlatform();
  const isYouTube = platform.includes('youtube');
  const isTikTok = platform === 'tiktok';

  if (
    (sourcePlatform === 'youtube' && !isYouTube) ||
    (sourcePlatform === 'tiktok' && !isTikTok)
  ) {
    return;
  }

  const canControlYouTube = Boolean(
    isYouTube &&
    ytPlayer &&
    typeof ytPlayer.playVideo === 'function' &&
    typeof ytPlayer.pauseVideo === 'function'
  );
  const canUseTikTokButton = Boolean(
    isTikTok &&
    (isTikTokPlayerReady || isTikTokPlayerFrameLoaded) &&
    getTikTokPlayerIframe()?.contentWindow
  );

  if (isTikTok) {
    btn.disabled = !canUseTikTokButton;

    if (!canUseTikTokButton) {
      btn.dataset.state = 'unavailable';
      setPlayerControlIcon(btn, PLAYER_CONTROL_ICONS.play);
      setPlayerControlLabel(btn, 'TikTokプレイヤーを準備しています');
      return;
    }

    if (!isTikTokPlaybackControlActivated) {
      btn.disabled = true;
      btn.dataset.state = 'awaiting-first-play';
      setPlayerControlIcon(btn, PLAYER_CONTROL_ICONS.play);
      setPlayerControlLabel(btn, 'TikTok画面内から最初に再生してください');
      return;
    }

    btn.disabled = false;
    syncTikTokPlaybackIntentFromState(playerState);
    renderPlayPauseButton(btn, isTikTokPlaybackRequested);
    return;
  }

  btn.disabled = !canControlYouTube;

  if (!isYouTube) {
    const label = '再生する動画がありません';

    btn.dataset.state = 'unavailable';
    setPlayerControlIcon(btn, PLAYER_CONTROL_ICONS.play);
    setPlayerControlLabel(btn, label);
    return;
  }

  if (!canControlYouTube) {
    btn.dataset.state = 'unavailable';
    setPlayerControlIcon(btn, PLAYER_CONTROL_ICONS.play);
    setPlayerControlLabel(btn, 'プレイヤーを準備しています');
    return;
  }

  syncYouTubePlaybackIntentFromState(playerState);
  renderPlayPauseButton(btn, isYouTubePlaybackRequested);
}

function toggleYouTubePlayback() {
  const btn = document.getElementById('playPauseBtn');
  if (!btn || btn.disabled || !ytPlayer) return;

  const bufferingState = window.YT?.PlayerState?.BUFFERING ?? 3;
  const pausedState = window.YT?.PlayerState?.PAUSED ?? 2;

  if (isYouTubePlaybackRequested) {
    isYouTubePlaybackRequested = false;
    ytPlayer.pauseVideo();
    updatePlayPauseButton(pausedState);
  } else {
    isYouTubePlaybackRequested = true;
    ytPlayer.playVideo();
    updatePlayPauseButton(bufferingState);
  }
}

function toggleTikTokPlayback() {
  const btn = document.getElementById('playPauseBtn');
  if (
    !btn ||
    btn.disabled ||
    (!isTikTokPlayerReady && !isTikTokPlayerFrameLoaded)
  ) return;

  if (isTikTokPlaybackRequested) {
    sendTikTokPlayerMessage('pause');
  } else {
    sendTikTokPlayerMessage('play');
  }
}

function toggleCurrentPlayback() {
  if (getCurrentPlaybackPlatform() === 'tiktok') {
    toggleTikTokPlayback();
    return;
  }

  toggleYouTubePlayback();
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
    [REPEAT_MODE_ALL]: PLAYER_CONTROL_ICONS.repeat,
    [REPEAT_MODE_ONE]: PLAYER_CONTROL_ICONS.repeatOne,
    [REPEAT_MODE_OFF]: PLAYER_CONTROL_ICONS.repeat
  };
  const label = labels[mode];

  btn.dataset.state = mode;
  setPlayerControlLabel(btn, label);
  setPlayerControlIcon(btn, icons[mode]);
}

function updateRandomModeButton() {
  const btn = document.getElementById('randomModeBtn');
  if (!btn) return;

  const on = isRandomModeEnabled();
  const label = on ? 'シャッフルON' : 'シャッフルOFF';

  btn.dataset.state = on ? 'on' : 'off';
  setPlayerControlLabel(btn, label);
  setPlayerControlIcon(btn, PLAYER_CONTROL_ICONS.shuffle);
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
    var selectedCollabTags = new Set();
    var selectedRoleTag = "";
    var selectedRoleTags = new Set();
    var selectedPlatformTag = "";
    var selected3DTag = null;
    var selectedShortsTag = null;
    const COLLAB_MEMBER_COMPACT_THRESHOLD = 5;
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

function normalizePlayerAspect(value) {
  const aspect = String(value ?? "").trim();
  return aspect === "9:16" || aspect === "16:9" ? aspect : "";
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
    const fullButtonText = String(video["full_button_text"] ?? "").trim();
    const playerAspect = normalizePlayerAspect(video["player_aspect"]);
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
    video._fullButtonText = fullButtonText;
    video._playerAspect = playerAspect;
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

function clearDateTag(options = {}) {
  const { scrollAfterUpdate = true } = options;
  window.FilterState.setState({ date: "" });

  const modalDateFilter = document.getElementById('modalDateFilter');
  if (modalDateFilter) modalDateFilter.value = "";

  renderDateTags();
  applyFilters({ scrollAfterUpdate });
}

function getSearchInputs() {
  return [
    document.getElementById('searchInput'),
    document.getElementById('modalSearchInput')
  ].filter(Boolean);
}

function getSearchQuery() {
  return searchInput?.value || "";
}

function syncSearchInputs(value) {
  getSearchInputs().forEach(input => {
    input.value = value;
  });
}

function updateSearchClearUi() {
  const hasSearch = Boolean(getSearchQuery().trim());
  document.getElementById('clearSearchInput')?.classList.toggle('hidden', !hasSearch);
}

function clearSearchQuery(options = {}) {
  const { scrollAfterUpdate = true } = options;
  syncSearchInputs("");
  updateSearchClearUi();
  applyFilters({ scrollAfterUpdate });
}

function applySearchQuery(value, options = {}) {
  const { sourceVideoKey = null, scrollAfterUpdate = true } = options;
  syncSearchInputs(String(value || "").trim());
  pendingListTagScrollVideoKey = sourceVideoKey;
  updateSearchClearUi();
  applyFilters({ scrollAfterUpdate });
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
  const searchQuery = getSearchQuery().trim();

  if (activeTags.length === 0 && !searchQuery) {
  activeTagChips.classList.add('hidden');
  updateActiveTagChipsPosition();
  return;
}

activeTagChips.classList.remove('hidden');
updateActiveTagChipsPosition();

if (searchQuery) {
    const searchChip = document.createElement('button');
    searchChip.type = 'button';
    searchChip.className = 'search-active-chip';
    searchChip.title = searchQuery;
    searchChip.setAttribute('aria-label', `検索語「${searchQuery}」をクリア`);
    searchChip.innerHTML = `<span class="search-active-chip__label">検索：</span><span class="search-active-chip__text"></span><span class="search-active-chip__close" aria-hidden="true">×</span>`;
    searchChip.querySelector('.search-active-chip__text').textContent = searchQuery;
    searchChip.addEventListener('click', () => {
      clearSearchQuery();
    });
    activeTagChipsInner.appendChild(searchChip);
  }

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

// ===== YouTubeプレイヤーの準備 =====
    let ytPlayer = null;
let ytApiReady = false;
let ytPlayerReady = false;
let pendingYouTubeVideoLoad = null;

function isYouTubePlayerReady() {
  return ytPlayerReady;
}

window.isYouTubePlayerReady = isYouTubePlayerReady;

function clearPendingYouTubeVideoLoad() {
  pendingYouTubeVideoLoad = null;
}

function executePendingYouTubeVideoLoad() {
  if (!pendingYouTubeVideoLoad || !ytPlayerReady || !ytPlayer) return;

  const pendingLoad = pendingYouTubeVideoLoad;
  let loaded = false;

  if (!pendingLoad.autoplay && typeof ytPlayer.cueVideoById === 'function') {
    ytPlayer.cueVideoById({
      videoId: pendingLoad.videoId,
      startSeconds: pendingLoad.start
    });
    loaded = true;
  } else if (typeof ytPlayer.loadVideoById === 'function') {
    ytPlayer.loadVideoById({
      videoId: pendingLoad.videoId,
      startSeconds: pendingLoad.start
    });
    loaded = true;
  } else if (typeof ytPlayer.cueVideoById === 'function') {
    ytPlayer.cueVideoById({
      videoId: pendingLoad.videoId,
      startSeconds: pendingLoad.start
    });
    loaded = true;
  }

  if (loaded && pendingYouTubeVideoLoad === pendingLoad) {
    pendingYouTubeVideoLoad = null;
  }
}

function syncYouTubeApiReadyFromGlobal() {
  if (!ytApiReady && window.YT && typeof window.YT.Player === 'function') {
    ytApiReady = true;
  }

  if (ytApiReady) tryInitYtPlayer();
}

function requestYouTubeVideoLoad(videoId, start, options = {}) {
  pendingYouTubeVideoLoad = {
    videoId,
    start,
    autoplay: options.autoplay !== false
  };

  syncYouTubeApiReadyFromGlobal();
  executePendingYouTubeVideoLoad();
}

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
      onReady: () => {
        ytPlayerReady = true;
        executePendingYouTubeVideoLoad();
        updatePlayPauseButton(getYouTubePlayerState(), 'youtube');
        requestAnimationFrame(applyStoredPlayerSizePreference);
      },
      onStateChange: (e) => {
        console.log('YouTube state:', e.data, 'repeatMode:', getRepeatMode(), 'randomMode:', isRandomModeEnabled());
        updatePlayPauseButton(e.data, 'youtube');

        if (e.data === YT.PlayerState.PLAYING) {
          refreshFullVersionPromptForCurrentVideo();
        }

        if (e.data === YT.PlayerState.ENDED) {
          handleVideoEnded();
        }
      }
    }
  });
}

syncYouTubeApiReadyFromGlobal();


// ===== JSONデータ取得 =====
async function fetchJsonArray(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} request failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new TypeError(`${label} response was not an array`);
  }

  return data;
}

async function loadVideoData() {
  window.LoadingStatus?.showVideoListLoading();

  try {
    const data = await fetchJsonArray(sheetJsonUrl, 'video data');
    if (!data.length) {
      throw new Error('video data was empty');
    }

    const invalidRowIndex = data.findIndex(video => !video || !video.title || !video.videoId);
    if (invalidRowIndex >= 0) {
      throw new Error(`video data row ${invalidRowIndex + 1} was missing required fields`);
    }

    window.LoadingStatus?.showVideoListPreparing(data.length);
    requestAnimationFrame(() => {
      window.LoadingStatus?.showVideoListRendering();
    });

    allVideos = normalizeVideos(data);
    populateFilters(allVideos);
    applyFilters({ scrollAfterUpdate: false });
    requestAnimationFrame(() => {
      adjustFixedPlayerBottom();
      updateActiveTagChipsPosition();
    });
  } catch (error) {
    console.error('video data fetch failed', { url: sheetJsonUrl, error });
    window.LoadingStatus?.showVideoListError();
  }
}

async function loadMetaData() {
  try {
    const data = await fetchJsonArray(metaSheetUrl, 'meta data');
    const lastUpdate = data.find(row => row["項目"] === "最終更新日");
    if (lastUpdate) {
      document.getElementById("lastUpdated").textContent =
        `最終更新日：${lastUpdate["値"]}`;
    }
  } catch (error) {
    console.error('meta data fetch failed', { url: metaSheetUrl, error });
  }
}

loadVideoData();
loadMetaData();

// ===== フィルターUIの操作 =====
    const repeatModeBtn = document.getElementById('repeatModeBtn');
    const randomModeBtn = document.getElementById('randomModeBtn');
    const playPauseBtn = document.getElementById('playPauseBtn');

if (playPauseBtn) {
  updatePlayPauseButton();
  playPauseBtn.addEventListener('click', toggleCurrentPlayback);
}

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
    refreshFullVersionPromptForCurrentVideo();
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
const PLAYER_HEIGHT_KEY = 'playerHeightPx';
const PLAYER_SIZE_PREFERENCE_KEY = 'playerSizePreference';
const PLAYER_HORIZONTAL_POSITION_KEY = 'playerHorizontalPosition';
const DEFAULT_PLAYER_H = 360;
const DEFAULT_PLAYER_HORIZONTAL_POSITION = 1;
const MIN_LANDSCAPE_PLAYER_H = 200;
const MIN_EMBED_VIEWPORT = 200;
const MIN_PLAYER_SIZE_PREFERENCE = MIN_EMBED_VIEWPORT / (16 / 9);
const COMPACT_PLAYER_ACTIONS_MAX_WIDTH = 300;
const PLAYER_LAYOUT_LANDSCAPE = 'landscape';
const PLAYER_LAYOUT_SHORTS = 'shorts';
const PLAYER_LAYOUT_TIKTOK = 'tiktok';
const PLAYER_ASPECT_RATIOS = Object.freeze({
  [PLAYER_LAYOUT_LANDSCAPE]: 16 / 9,
  [PLAYER_LAYOUT_SHORTS]: 9 / 16,
  [PLAYER_LAYOUT_TIKTOK]: 9 / 16
});
let activePlayerLayout = PLAYER_LAYOUT_LANDSCAPE;
let playerHorizontalPosition = readStoredPlayerHorizontalPosition();
let playerSizePreference = readStoredPlayerSizePreference();
let isPlayerHandleInteractionActive = false;

function clampPlayerHorizontalPosition(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_PLAYER_HORIZONTAL_POSITION;
  return Math.min(1, Math.max(0, number));
}

function readStoredPlayerHorizontalPosition() {
  const stored = localStorage.getItem(PLAYER_HORIZONTAL_POSITION_KEY);
  if (stored === null || stored.trim() === '') return DEFAULT_PLAYER_HORIZONTAL_POSITION;
  return clampPlayerHorizontalPosition(stored);
}

function clampPlayerSizePreference(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_PLAYER_H;
  return Math.max(MIN_PLAYER_SIZE_PREFERENCE, number);
}

function readStoredPlayerSizePreference() {
  const storedPreference = localStorage.getItem(PLAYER_SIZE_PREFERENCE_KEY);
  if (storedPreference !== null && storedPreference.trim() !== '') {
    return clampPlayerSizePreference(storedPreference);
  }

  const legacyHeight = localStorage.getItem(PLAYER_HEIGHT_KEY);
  if (legacyHeight !== null && legacyHeight.trim() !== '') {
    return clampPlayerSizePreference(legacyHeight);
  }

  return DEFAULT_PLAYER_H;
}

function persistPlayerSizePreference() {
  localStorage.setItem(
    PLAYER_SIZE_PREFERENCE_KEY,
    playerSizePreference.toFixed(2)
  );
}

function getPlayerLayoutForVideo(video) {
  if (isTikTokVideo(video)) return PLAYER_LAYOUT_TIKTOK;
  if (video?._playerAspect === "9:16") return PLAYER_LAYOUT_SHORTS;
  if (video?._playerAspect === "16:9") return PLAYER_LAYOUT_LANDSCAPE;
  return video?._isShorts ? PLAYER_LAYOUT_SHORTS : PLAYER_LAYOUT_LANDSCAPE;
}

function setPlayerLayoutForVideo(video) {
  activePlayerLayout = getPlayerLayoutForVideo(video);
  playerStage?.setAttribute('data-player-layout', activePlayerLayout);
  playerStageDock?.setAttribute('data-player-layout', activePlayerLayout);
}

function getPlayerAspectRatio(layout = activePlayerLayout) {
  return PLAYER_ASPECT_RATIOS[layout] || PLAYER_ASPECT_RATIOS[PLAYER_LAYOUT_LANDSCAPE];
}

function getViewportSize() {
  const viewport = window.visualViewport;
  return {
    width: Math.max(1, Math.floor(viewport?.width || window.innerWidth || document.documentElement.clientWidth)),
    height: Math.max(1, Math.floor(viewport?.height || window.innerHeight || document.documentElement.clientHeight))
  };
}

function getStyleNumber(style, property) {
  const value = Number.parseFloat(style?.[property]);
  return Number.isFinite(value) ? value : 0;
}

function getAvailablePlayerSize() {
  const viewport = getViewportSize();
  const innerStyle = fixedPlayerInner ? getComputedStyle(fixedPlayerInner) : null;
  const horizontalPadding = getStyleNumber(innerStyle, 'paddingLeft') + getStyleNumber(innerStyle, 'paddingRight');
  const verticalPadding = getStyleNumber(innerStyle, 'paddingTop') + getStyleNumber(innerStyle, 'paddingBottom');
  const innerWidth = fixedPlayerInner?.clientWidth || Math.min(viewport.width, 896);
  const dockStyle = playerStageDock ? getComputedStyle(playerStageDock) : null;
  const actionsSpace = getStyleNumber(dockStyle, 'paddingTop') || 40;
  const nowPlayingHeight = document.getElementById('nowPlayingWrapper')?.offsetHeight || 0;
  const viewportSideMargin = Math.min(24, Math.max(0, viewport.width - 1));
  const availableWidth = Math.max(
    1,
    Math.floor(Math.min(viewport.width - viewportSideMargin, innerWidth - horizontalPadding))
  );
  const availableHeight = Math.max(
    1,
    Math.floor(viewport.height - nowPlayingHeight - 8 - verticalPadding - actionsSpace - 12)
  );

  return { width: availableWidth, height: availableHeight };
}

function getPlayerHorizontalOffsetBounds(stageWidth) {
  const viewport = window.visualViewport;
  const viewportWidth = Math.max(
    1,
    viewport?.width || window.innerWidth || document.documentElement.clientWidth
  );
  const viewportLeft = Number.isFinite(viewport?.offsetLeft) ? viewport.offsetLeft : 0;
  const viewportRight = viewportLeft + viewportWidth;
  const dockRect = playerStageDock?.getBoundingClientRect();
  const dockCenter = dockRect
    ? dockRect.left + (dockRect.width / 2)
    : viewportLeft + (viewportWidth / 2);
  const width = Math.max(1, Number(stageWidth) || playerStage?.getBoundingClientRect().width || 1);
  const sideMargin = Math.min(12, Math.max(0, (viewportWidth - width) / 2));
  let min = viewportLeft + sideMargin - (dockCenter - (width / 2));
  let max = viewportRight - sideMargin - (dockCenter + (width / 2));

  if (min > max) {
    const center = (min + max) / 2;
    min = center;
    max = center;
  }

  return { min, max };
}

function applyPlayerHorizontalPosition(options = {}) {
  const { persist = false, stageWidth } = options;
  const bounds = getPlayerHorizontalOffsetBounds(stageWidth);
  const offset = bounds.min + ((bounds.max - bounds.min) * playerHorizontalPosition);
  const offsetPx = `${Math.round(offset)}px`;

  playerStageDock?.style.setProperty('--player-stage-offset-x', offsetPx);

  if (persist) {
    localStorage.setItem(
      PLAYER_HORIZONTAL_POSITION_KEY,
      playerHorizontalPosition.toFixed(4)
    );
  }

  return offset;
}

function setPlayerHorizontalOffset(offset, options = {}) {
  const bounds = getPlayerHorizontalOffsetBounds(options.stageWidth);
  const clampedOffset = Math.min(bounds.max, Math.max(bounds.min, Number(offset) || 0));
  const distance = bounds.max - bounds.min;

  playerHorizontalPosition = distance > 0
    ? clampPlayerHorizontalPosition((clampedOffset - bounds.min) / distance)
    : DEFAULT_PLAYER_HORIZONTAL_POSITION;

  return applyPlayerHorizontalPosition(options);
}

function getPreferredMinimumHeight(layout = activePlayerLayout) {
  if (layout === PLAYER_LAYOUT_LANDSCAPE) return MIN_LANDSCAPE_PLAYER_H;
  return Math.ceil(MIN_EMBED_VIEWPORT / getPlayerAspectRatio(layout));
}

function calculatePlayerSize(preferredSize, layout = activePlayerLayout) {
  const available = getAvailablePlayerSize();
  const ratio = getPlayerAspectRatio(layout);
  const requestedSize = clampPlayerSizePreference(preferredSize);
  const preferredMinimumHeight = getPreferredMinimumHeight(layout);
  const maxRatioHeight = Math.min(available.height, available.width / ratio);
  const useCompactVerticalSize = (
    ratio < 1 &&
    requestedSize < preferredMinimumHeight &&
    available.width >= MIN_EMBED_VIEWPORT &&
    available.height >= MIN_EMBED_VIEWPORT
  );
  const useCompactLandscapeSize = (
    ratio >= 1 &&
    requestedSize < preferredMinimumHeight &&
    available.width >= MIN_EMBED_VIEWPORT &&
    available.height >= MIN_EMBED_VIEWPORT
  );
  let width;
  let height;

  if (useCompactVerticalSize) {
    height = Math.min(available.height, Math.max(MIN_EMBED_VIEWPORT, requestedSize));
    width = Math.min(available.width, Math.max(MIN_EMBED_VIEWPORT, height * ratio));
  } else if (useCompactLandscapeSize) {
    height = Math.min(available.height, MIN_EMBED_VIEWPORT);
    width = Math.min(
      available.width,
      Math.max(MIN_EMBED_VIEWPORT, requestedSize * ratio)
    );
  } else if (maxRatioHeight >= preferredMinimumHeight) {
    height = Math.max(preferredMinimumHeight, Math.min(requestedSize, maxRatioHeight));
    width = height * ratio;
  } else if (available.width >= MIN_EMBED_VIEWPORT && available.height >= MIN_EMBED_VIEWPORT) {
    if (ratio < 1) {
      height = Math.min(available.height, Math.max(MIN_EMBED_VIEWPORT, requestedSize));
      width = Math.min(available.width, Math.max(MIN_EMBED_VIEWPORT, height * ratio));
    } else {
      width = Math.min(available.width, Math.max(MIN_EMBED_VIEWPORT, requestedSize * ratio));
      height = Math.min(available.height, Math.max(MIN_EMBED_VIEWPORT, width / ratio));
    }
  } else if (available.width < MIN_EMBED_VIEWPORT) {
    width = available.width;
    height = Math.min(
      available.height,
      Math.max(Math.min(MIN_EMBED_VIEWPORT, available.height), width / ratio)
    );
  } else {
    height = available.height;
    width = Math.min(
      available.width,
      Math.max(Math.min(MIN_EMBED_VIEWPORT, available.width), height * ratio)
    );
  }

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  };
}

function getYouTubeIframeElement() {
  return document.querySelector('#youtubePlayer iframe') || document.getElementById('youtubePlayer');
}

function getYouTubePlayerElement() {
  return document.getElementById('youtubePlayer');
}

function applyPlayerDimensions(size) {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const widthPx = `${width}px`;
  const heightPx = `${height}px`;

  playerStageDock?.style.setProperty('--player-stage-width', widthPx);

  if (playerStage) {
    playerStage.style.width = widthPx;
    playerStage.setAttribute('data-player-layout', activePlayerLayout);
  }

  if (playerFrameWrapper) {
    playerFrameWrapper.style.width = widthPx;
    playerFrameWrapper.style.height = heightPx;
  }

  [getYouTubeIframeElement(), tiktokPlayerEl, playerIframe].forEach(element => {
    if (!element) return;
    element.classList.remove('aspect-video');
    element.style.width = '100%';
    element.style.height = '100%';
  });

  const tiktokIframe = tiktokPlayerEl?.querySelector('iframe');
  if (tiktokIframe) {
    tiktokIframe.style.width = '100%';
    tiktokIframe.style.height = '100%';
  }

  applyPlayerHorizontalPosition({ stageWidth: width });

  if (
    activePlayerLayout !== PLAYER_LAYOUT_TIKTOK &&
    ytPlayer &&
    typeof ytPlayer.setSize === 'function'
  ) {
    try {
      ytPlayer.setSize(width, height);
    } catch (error) {
      console.warn('YouTube player size update failed:', error);
    }
  }
}

function updateFixedPlayerOffsets() {
  const nowPlayingWrapperEl = document.getElementById('nowPlayingWrapper');
  if (!fixedPlayerEl || !nowPlayingWrapperEl) return;

  if (getComputedStyle(fixedPlayerEl).display === 'none') {
    document.body.style.paddingBottom = '0px';
    return;
  }

  const nowPlayingHeight = nowPlayingWrapperEl.offsetHeight || 0;
  fixedPlayerEl.style.bottom = `${nowPlayingHeight + 8}px`;

  if (fixedPlayerEl.classList.contains('is-collapsed')) {
    document.body.style.paddingBottom = `${nowPlayingHeight + 12}px`;
    return;
  }

  const total = (fixedPlayerEl.offsetHeight || 0) + nowPlayingHeight + 12;
  document.body.style.paddingBottom = `${total}px`;
}

function setPlayerSizePreference(value, options = {}) {
  const { persist = true } = options;
  playerSizePreference = clampPlayerSizePreference(value);
  const size = calculatePlayerSize(playerSizePreference);
  applyPlayerDimensions(size);

  if (persist) {
    persistPlayerSizePreference();
  }

  updateFixedPlayerOffsets();
  return size;
}

function applyStoredPlayerSizePreference() {
  playerSizePreference = readStoredPlayerSizePreference();
  setPlayerSizePreference(playerSizePreference, { persist: false });
}

function syncPlayerDimensionsBeforeVideoLoad() {
  applyStoredPlayerSizePreference();
  requestAnimationFrame(() => {
    applyStoredPlayerSizePreference();
    requestAnimationFrame(applyStoredPlayerSizePreference);
  });
}

function getMaxPlayerHeight() {
  return calculatePlayerSize(Number.MAX_SAFE_INTEGER).height;
}

function adjustFixedPlayerBottom() {
  if (!fixedPlayerEl || getComputedStyle(fixedPlayerEl).display === 'none') {
    updateFixedPlayerOffsets();
    return;
  }

  if (!fixedPlayerEl.classList.contains('is-collapsed')) {
    if (isPlayerHandleInteractionActive) {
      updateFixedPlayerOffsets();
      return;
    }
    applyStoredPlayerSizePreference();
  } else {
    updateFixedPlayerOffsets();
  }
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

function getTikTokPlayerIframe() {
  return tiktokPlayerEl?.querySelector('.tiktok-player-iframe') || null;
}

function resetTikTokPlaybackControl() {
  tiktokPlaybackCommandTimers.forEach(clearTimeout);
  tiktokPlaybackCommandTimers = [];
  pendingTikTokPlaybackCommand = null;
  isTikTokPlayerReady = false;
  isTikTokPlayerFrameLoaded = false;
  isTikTokPlaybackControlActivated = false;
  isTikTokPlaybackRequested = false;
}

function postTikTokPlayerMessage(type) {
  const iframe = getTikTokPlayerIframe();
  if (!iframe?.contentWindow) return false;

  iframe.contentWindow.postMessage({
    type,
    'x-tiktok-player': true
  }, '*');
  return true;
}

function clearPendingTikTokPlaybackCommand() {
  tiktokPlaybackCommandTimers.forEach(clearTimeout);
  tiktokPlaybackCommandTimers = [];
  pendingTikTokPlaybackCommand = null;
}

function sendTikTokPlayerMessage(type) {
  if (
    (!isTikTokPlayerReady && !isTikTokPlayerFrameLoaded) ||
    !postTikTokPlayerMessage(type)
  ) {
    return false;
  }

  clearPendingTikTokPlaybackCommand();
  pendingTikTokPlaybackCommand = type;
  tiktokPlaybackCommandTimers = TIKTOK_COMMAND_RETRY_DELAYS.map(delay => (
    setTimeout(() => {
      if (pendingTikTokPlaybackCommand !== type) return;
      postTikTokPlayerMessage(type);
    }, delay)
  ));
  const lastRetryDelay = TIKTOK_COMMAND_RETRY_DELAYS[
    TIKTOK_COMMAND_RETRY_DELAYS.length - 1
  ] || 0;
  tiktokPlaybackCommandTimers.push(setTimeout(() => {
    if (pendingTikTokPlaybackCommand === type) {
      clearPendingTikTokPlaybackCommand();
    }
  }, lastRetryDelay + 250));
  return true;
}

function parseTikTokPlayerMessage(data) {
  if (typeof data !== 'string') return data;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function handleTikTokPlayerMessage(event) {
  const iframe = getTikTokPlayerIframe();
  if (!iframe?.contentWindow) return;

  const message = parseTikTokPlayerMessage(event.data);
  if (!message || message['x-tiktok-player'] !== true) return;

  if (message.type === 'onPlayerReady') {
    isTikTokPlayerReady = true;
    updatePlayPauseButton(null, 'tiktok');
    if (pendingTikTokPlaybackCommand) {
      postTikTokPlayerMessage(pendingTikTokPlaybackCommand);
    }
    return;
  }

  if (message.type === 'onStateChange') {
    isTikTokPlayerReady = true;
    const playerState = Number(message.value);
    const isStartingPlayback = (
      playerState === TIKTOK_PLAYER_STATES.playing ||
      playerState === TIKTOK_PLAYER_STATES.buffering
    );

    if (isStartingPlayback && !isTikTokPlaybackControlActivated) {
      isTikTokPlaybackControlActivated = true;
      isTikTokPlaybackRequested = true;
    }

    const commandWasAccepted = (
      pendingTikTokPlaybackCommand === 'play' && (
        playerState === TIKTOK_PLAYER_STATES.playing ||
        playerState === TIKTOK_PLAYER_STATES.buffering
      )
    ) || (
      pendingTikTokPlaybackCommand === 'pause' &&
      playerState === TIKTOK_PLAYER_STATES.paused
    );

    if (commandWasAccepted) clearPendingTikTokPlaybackCommand();
    updatePlayPauseButton(playerState, 'tiktok');
  }
}

function loadTikTokEmbed(tiktokId) {
  if (!tiktokPlayerEl || !tiktokId) return;

  resetTikTokPlaybackControl();

  const iframe = document.createElement('iframe');
  iframe.className = 'tiktok-player-iframe';
  iframe.src = `https://www.tiktok.com/player/v1/${encodeURIComponent(tiktokId)}?controls=1&autoplay=0`;
  iframe.title = 'TikTok動画プレイヤー';
  iframe.loading = 'eager';
  iframe.allow = 'autoplay; encrypted-media; fullscreen';
  iframe.setAttribute('allowfullscreen', '');
  iframe.addEventListener('load', () => {
    if (iframe !== getTikTokPlayerIframe()) return;
    isTikTokPlayerFrameLoaded = true;
    updatePlayPauseButton(null, 'tiktok');
  }, { once: true });
  tiktokPlayerEl.replaceChildren(iframe);
}

window.addEventListener('message', handleTikTokPlayerMessage);

window.addEventListener('resize', () => {
  requestAnimationFrame(adjustFixedPlayerBottom);
  requestAnimationFrame(updateActiveTagChipsPosition);
});

window.addEventListener('orientationchange', () => {
  setTimeout(adjustFixedPlayerBottom, 50);
  setTimeout(updateActiveTagChipsPosition, 50);
});

window.visualViewport?.addEventListener('resize', adjustFixedPlayerBottom);
window.visualViewport?.addEventListener('resize', updateActiveTagChipsPosition);

(function observePlayerWindowActionsLayout() {
  const actions = document.querySelector('.player-window-actions');
  if (!actions || !playerStageDock) return;

  let updateFrame = null;
  let lastActionsSpace = null;

  const updateLayout = () => {
    updateFrame = null;
    const width = actions.getBoundingClientRect().width;
    actions.classList.toggle('is-compact-layout', width <= COMPACT_PLAYER_ACTIONS_MAX_WIDTH);

    const actionsHeight = Math.ceil(actions.getBoundingClientRect().height);
    const actionsSpace = Math.max(40, actionsHeight + 12);
    if (actionsSpace === lastActionsSpace) return;

    lastActionsSpace = actionsSpace;
    playerStageDock.style.setProperty('--player-window-actions-space', `${actionsSpace}px`);
    requestAnimationFrame(adjustFixedPlayerBottom);
  };

  const scheduleUpdate = () => {
    if (updateFrame !== null) cancelAnimationFrame(updateFrame);
    updateFrame = requestAnimationFrame(updateLayout);
  };

  if (window.ResizeObserver) {
    new ResizeObserver(scheduleUpdate).observe(actions);
  }

  window.addEventListener('resize', scheduleUpdate);
  window.visualViewport?.addEventListener('resize', scheduleUpdate);
  scheduleUpdate();
})();

(function enablePlayerResize() {
  if (!resizeHandle) return;

  const MOUSE_AXIS_ACTIVATION_THRESHOLD = 7;
  const TOUCH_AXIS_ACTIVATION_THRESHOLD = 12;
  const KEYBOARD_MOVE_STEP = 24;
  const KEYBOARD_RESIZE_STEP = 20;
  let dragging = false;
  let horizontalDragActive = false;
  let verticalDragActive = false;
  let axisActivationThreshold = MOUSE_AXIS_ACTIVATION_THRESHOLD;
  let startX = 0;
  let startY = 0;
  let horizontalAnchorX = 0;
  let horizontalAnchorOffset = 0;
  let verticalAnchorY = 0;
  let verticalAnchorPreference = 0;
  let latestDragPoint = null;
  let dragUpdateFrame = null;
  let pointerDisabledElement = null;
  let previousPointerEvents = '';
  let prevUserSelect = '';
  let prevCursor = '';
  let prevOverflow = '';
  const preventScroll = (event) => event.preventDefault();

  const lockScroll = () => {
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('touchmove', preventScroll, { passive: false });
  };

  const disableIframePointer = () => {
    const active = getActivePlayerElement();
    if (!active) return;

    pointerDisabledElement = active;
    previousPointerEvents = active.style.pointerEvents;
    active.style.pointerEvents = 'none';
  };

  const enableIframePointer = () => {
    if (!pointerDisabledElement) return;

    pointerDisabledElement.style.pointerEvents = previousPointerEvents;
    pointerDisabledElement = null;
    previousPointerEvents = '';
  };

  const unlockScroll = () => {
    document.body.style.overflow = prevOverflow;
    document.removeEventListener('touchmove', preventScroll, { passive: false });
  };

  const updateDragAxisPresentation = () => {
    const dragAxis = horizontalDragActive && verticalDragActive
      ? 'both'
      : horizontalDragActive
        ? 'horizontal'
        : verticalDragActive
          ? 'vertical'
          : '';

    if (dragAxis) {
      resizeHandle.dataset.dragAxis = dragAxis;
    } else {
      resizeHandle.removeAttribute('data-drag-axis');
    }

    document.body.style.cursor = dragAxis === 'horizontal'
      ? 'ew-resize'
      : dragAxis === 'vertical'
        ? 'ns-resize'
        : dragAxis === 'both'
          ? 'move'
          : 'grabbing';
  };

  const start = (x, y, threshold = MOUSE_AXIS_ACTIVATION_THRESHOLD) => {
    dragging = true;
    isPlayerHandleInteractionActive = true;
    horizontalDragActive = false;
    verticalDragActive = false;
    axisActivationThreshold = threshold;
    startX = x;
    startY = y;
    verticalAnchorPreference = playerSizePreference;
    latestDragPoint = null;
    if (dragUpdateFrame !== null) {
      cancelAnimationFrame(dragUpdateFrame);
      dragUpdateFrame = null;
    }
    prevUserSelect = document.body.style.userSelect;
    prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    resizeHandle.classList.add('is-dragging');
    resizeHandle.removeAttribute('data-drag-axis');
    disableIframePointer();
    lockScroll();
    fixedPlayerEl?.dispatchEvent(new CustomEvent('player-handle-interaction-start'));
  };

  const applyMove = (x, y) => {
    if (!dragging) return;
    const dx = x - startX;
    const dy = y - startY;

    const wasHorizontalDragActive = horizontalDragActive;
    const wasVerticalDragActive = verticalDragActive;

    if (!horizontalDragActive && Math.abs(dx) >= axisActivationThreshold) {
      horizontalDragActive = true;
      horizontalAnchorX = startX + (Math.sign(dx) * axisActivationThreshold);
      horizontalAnchorOffset = applyPlayerHorizontalPosition();
    }
    if (!verticalDragActive && Math.abs(dy) >= axisActivationThreshold) {
      verticalDragActive = true;
      verticalAnchorY = startY + (Math.sign(dy) * axisActivationThreshold);
      verticalAnchorPreference = playerSizePreference;
    }

    if (!horizontalDragActive && !verticalDragActive) return;

    if (
      wasHorizontalDragActive !== horizontalDragActive ||
      wasVerticalDragActive !== verticalDragActive
    ) {
      updateDragAxisPresentation();
    }

    const size = verticalDragActive
      ? setPlayerSizePreference(
        verticalAnchorPreference - (y - verticalAnchorY),
        { persist: false }
      )
      : null;

    if (horizontalDragActive) {
      setPlayerHorizontalOffset(horizontalAnchorOffset + (x - horizontalAnchorX), {
        stageWidth: size?.width
      });
    }
  };

  const flushPendingMove = () => {
    if (dragUpdateFrame !== null) {
      cancelAnimationFrame(dragUpdateFrame);
      dragUpdateFrame = null;
    }

    const point = latestDragPoint;
    latestDragPoint = null;
    if (point) applyMove(point.x, point.y);
  };

  const scheduleMove = (x, y) => {
    if (!dragging) return;
    latestDragPoint = { x, y };
    if (dragUpdateFrame !== null) return;

    dragUpdateFrame = requestAnimationFrame(() => {
      dragUpdateFrame = null;
      const point = latestDragPoint;
      latestDragPoint = null;
      if (point) applyMove(point.x, point.y);
    });
  };

  const end = () => {
    if (!dragging) return;
    flushPendingMove();
    if (horizontalDragActive) {
      applyPlayerHorizontalPosition({ persist: true });
    }
    if (verticalDragActive) {
      persistPlayerSizePreference();
    }
    dragging = false;
    isPlayerHandleInteractionActive = false;
    horizontalDragActive = false;
    verticalDragActive = false;
    document.body.style.userSelect = prevUserSelect;
    document.body.style.cursor = prevCursor;
    resizeHandle.classList.remove('is-dragging');
    resizeHandle.removeAttribute('data-drag-axis');
    enableIframePointer();
    unlockScroll();
    fixedPlayerEl?.dispatchEvent(new CustomEvent('player-handle-interaction-end'));
  };

  window.addEventListener('blur', end);
  document.addEventListener('mouseleave', end);
  document.addEventListener('mouseup', end);
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', end);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) end();
  });

  resizeHandle.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    start(event.clientX, event.clientY);
  });

  window.addEventListener('mousemove', (event) => scheduleMove(event.clientX, event.clientY));
  window.addEventListener('mouseup', end);

  resizeHandle.addEventListener('touchstart', (event) => {
    event.preventDefault();
    event.stopPropagation();
    start(
      event.touches[0].clientX,
      event.touches[0].clientY,
      TOUCH_AXIS_ACTIVATION_THRESHOLD
    );
  }, { passive: false });

  window.addEventListener('touchmove', (event) => {
    if (!dragging || !event.touches[0]) return;
    event.preventDefault();
    scheduleMove(event.touches[0].clientX, event.touches[0].clientY);
  }, { passive: false });

  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);

  resizeHandle.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const currentOffset = applyPlayerHorizontalPosition();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      setPlayerHorizontalOffset(currentOffset + (KEYBOARD_MOVE_STEP * direction), { persist: true });
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const direction = event.key === 'ArrowUp' ? 1 : -1;
      setPlayerSizePreference(
        playerSizePreference + (KEYBOARD_RESIZE_STEP * direction)
      );
    }
  });
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

document.getElementById('clearSearchInput')?.addEventListener('click', () => {
  clearSearchQuery();
  searchInput?.focus();
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
  applyFilters({ scrollAfterUpdate: false });
  window.dispatchEvent(new CustomEvent("tagFilterStateChanged"));
}

function applyMobileFilterTagClick(group, value, renderUpdatedTags) {
  window.FilterState.toggleTag(group, value);
  if (typeof renderUpdatedTags === "function") renderUpdatedTags();
  applyFilters({ scrollAfterUpdate: false });
  window.dispatchEvent(new CustomEvent("tagFilterStateChanged", {
    detail: { source: "mobile-filter-modal" }
  }));
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
function findVideoListItemByKey(videoKey) {
  if (!videoKey) return null;

  return [...videoList.querySelectorAll('[data-video-key]')]
    .find(item => item.dataset.videoKey === videoKey) || null;
}

function getFilterScrollTarget(sourceVideoKey) {
  if (sourceVideoKey) {
    return {
      element: findVideoListItemByKey(sourceVideoKey),
      fallbackToListTop: true
    };
  }

  const playingElement = getNowPlayingCardElement();
  if (playingElement) return { element: playingElement, isPlayingCard: true };

  const filteredOutNotice = document.getElementById('nowPlayingFilteredOutNotice');
  if (filteredOutNotice) return { element: filteredOutNotice };

  return { fallbackToListTop: true };
}

function scrollToSettledFilterTarget(options = {}) {
  const { sourceVideoKey = null, behavior = "smooth" } = options;
  const target = getFilterScrollTarget(sourceVideoKey);

  if (target.element) {
    const scrollTargetIntoView = target.isPlayingCard
      ? window.ScrollUtils.scrollPlayingCardIntoComfortView
      : window.ScrollUtils.scrollElementIntoComfortView;
    scrollTargetIntoView(target.element, { behavior });
    scheduleNowPlayingFloatingButtonSettledUpdate();
    return;
  }

  window.ScrollUtils.scrollToResultCountOrListTop({ behavior });
  scheduleNowPlayingFloatingButtonSettledUpdate();
}

function requestSettledFilterScroll(options = {}) {
  const { sourceVideoKey = null, behavior = "smooth" } = options;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollToSettledFilterTarget({ sourceVideoKey, behavior });
    });
  });
}

window.requestSettledFilterScroll = requestSettledFilterScroll;

      function applyFilters(options = {}) {
        const { scrollAfterUpdate = true } = options;
        const listTagScrollVideoKey = pendingListTagScrollVideoKey;
        pendingListTagScrollVideoKey = null;
        const searchQuery = searchInput.value;
        const parsedSearchQuery = window.SearchUtils.parseSearchQuery(searchQuery);
        updateSearchClearUi();
        const now = new Date();
        const filterState = window.FilterState.getState();
        let filtered = allVideos.filter(video => {
  return window.SearchUtils.matchesParsedSearchQuery(video, parsedSearchQuery) &&
    
// フィルタ条件
    (!filterState.include.category || video["カテゴリ"] === filterState.include.category) &&
    (
      filterState.include.collab.length === 0 ||
      filterState.include.collab.some(tag => video._collabTags.includes(tag))
    ) &&
    (
      filterState.include.role.length === 0 ||
      filterState.include.role.some(tag => video._roles.includes(tag))
    ) &&
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
updateActiveTagChipsPosition();
updateNowPlayingFilteredOutNotice();
requestNowPlayingFloatingButtonUpdate();
if (scrollAfterUpdate) {
  requestSettledFilterScroll({ sourceVideoKey: listTagScrollVideoKey });
}
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
      <span class="text-xl font-bold text-gray-800">${visibleCount}</span>
      <span class="text-xs">件表示</span>
    `;
  }

  if (desktopResultCount && desktopResultTotal && desktopResultVisible) {
    desktopResultTotal.textContent = String(totalCount);
    desktopResultVisible.textContent = String(visibleCount);
  }
}

function createCollabListTag(value, kind) {
  const tag = document.createElement('button');
  tag.type = 'button';
  tag.className = getTagButtonClass(
    kind === 'liver' ? 'tag-collab-liver' : 'tag-collab-unit',
    window.FilterState.isTagIncluded('collab', value)
  );
  tag.textContent = value;
  tag.dataset.filterGroup = 'collab';
  tag.dataset.filterValue = value;
  tag.addEventListener('click', () => {
    handleListTagClick('collab', value);
  });
  return tag;
}

function createCollabMemberToggle(memberRow, memberCount) {
  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'collab-member-toggle px-2.5 py-1 rounded-full text-xs';
  toggleButton.setAttribute('aria-controls', memberRow.id);

  const setMemberRowVisibility = show => {
    memberRow.classList.toggle('hidden', !show);
    toggleButton.textContent = show ? '-' : `+${memberCount}`;
    toggleButton.setAttribute('aria-expanded', String(show));

    const actionLabel = show
      ? 'コラボメンバーを隠す'
      : `${memberCount}人のコラボメンバーを表示`;
    toggleButton.setAttribute('aria-label', actionLabel);
    toggleButton.title = actionLabel;
  };

  const shouldShowMembers = [...memberRow.children]
    .some(button => button.classList.contains('tag-collab-liver-active'));
  setMemberRowVisibility(shouldShowMembers);
  toggleButton.addEventListener('click', () => {
    setMemberRowVisibility(memberRow.classList.contains('hidden'));
  });

  return toggleButton;
}

function createCollabTagRow(video, cardIndex) {
  const collabLivers = sortCollabTagsForDisplay(video._collabLivers);
  const collabUnits = sortCollabTagsForDisplay(video._collabUnits);
  if (!collabLivers.length && !collabUnits.length) return null;

  const tagRow = document.createElement('div');
  tagRow.className = 'video-card-tag-row video-card-collab-row flex flex-wrap gap-1.5';

  const memberTags = collabLivers.map(name => {
    const tag = createCollabListTag(name, 'liver');
    tag.dataset.collabMember = name;
    return tag;
  });
  const unitTags = collabUnits.map(unit => createCollabListTag(unit, 'unit'));
  const shouldCompactMembers = collabLivers.length > 0 && (
    collabUnits.length > 0 ||
    collabLivers.length >= COLLAB_MEMBER_COMPACT_THRESHOLD
  );

  if (!shouldCompactMembers) {
    memberTags.forEach(tag => tagRow.appendChild(tag));
    unitTags.forEach(tag => tagRow.appendChild(tag));
    return tagRow;
  }

  unitTags.forEach(tag => tagRow.appendChild(tag));

  const memberRow = document.createElement('div');
  memberRow.id = `collab-members-${cardIndex}`;
  memberRow.className = 'collab-member-row basis-full flex flex-wrap gap-1.5';
  memberTags.forEach(tag => memberRow.appendChild(tag));

  tagRow.appendChild(createCollabMemberToggle(memberRow, collabLivers.length));
  tagRow.appendChild(memberRow);
  return tagRow;
}

function renderVideoList(videos) {
  videoList.innerHTML = '';
  const videoListFragment = document.createDocumentFragment();

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

  videos.forEach((video, cardIndex) => {
    const item = document.createElement('div');
    item.className = 'video-card p-3 mb-3 bg-blue-100 rounded-lg shadow-md border-2 border-gray-300';

    const key = getVideoKey(video);
    item.dataset.videoKey = key;

    if (key === nowPlayingKey) {
      item.classList.add('playing');
    }

    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'video-card-play-button';
    playButton.setAttribute('aria-label', `${video["title"] || "この動画"}を再生`);
    playButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8 5.5v13l10-6.5-10-6.5z"></path>
      </svg>
    `;
    playButton.addEventListener('click', () => {
      loadVideo(video, item);
    });

    const content = document.createElement('div');
    content.className = 'video-card-content';
    
    // 1行目：タイトル / アーティスト
    const topRow = document.createElement('div');
    topRow.className = 'video-item-row';

    const title = document.createElement('button');
    title.type = 'button';
    title.className = 'video-title video-search-action';
    title.title = video["title"] || "";
    title.setAttribute('aria-label', `曲名「${video["title"]}」で検索`);
    const titleText = document.createElement('span');
    titleText.className = 'video-search-action-text';
    titleText.textContent = video["title"];
    title.appendChild(titleText);
    title.addEventListener('click', () => {
      applySearchQuery(video["title"], { sourceVideoKey: key });
    });

    topRow.appendChild(title);

    if (video["artist"]) {
      const slash = document.createElement('span');
      slash.className = 'video-title-separator';
      slash.textContent = ' / ';

      const artist = document.createElement('button');
      artist.type = 'button';
      artist.className = 'video-artist video-search-action';
      artist.title = video["artist"];
      artist.setAttribute('aria-label', `アーティスト「${video["artist"]}」で検索`);
      const artistText = document.createElement('span');
      artistText.className = 'video-search-action-text';
      artistText.textContent = video["artist"];
      artist.appendChild(artistText);
      artist.addEventListener('click', () => {
        applySearchQuery(video["artist"], { sourceVideoKey: key });
      });

      topRow.appendChild(slash);
      topRow.appendChild(artist);
    }

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
  roleTagRow.className = 'video-card-tag-row flex flex-wrap gap-1.5';

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

const wakuName = String(video["waku_name"] || '').trim();
if (wakuName) {
  const wakuSpan = document.createElement('span');
  wakuSpan.className = 'video-meta-waku';
  wakuSpan.textContent = wakuName;
  metaRow.appendChild(wakuSpan);
}

// 3行目：コラボタグ
const tagRow = createCollabTagRow(video, cardIndex);

content.appendChild(topRow);
content.appendChild(metaRow);

item.appendChild(playButton);
item.appendChild(content);
if (roleTagRow) item.appendChild(roleTagRow);
if (tagRow) item.appendChild(tagRow);

videoListFragment.appendChild(item);
      });

  videoList.appendChild(videoListFragment);
  updateVideoSearchActionOverflow();
  window.dispatchEvent(new CustomEvent("videoListRendered"));
}

function updateVideoSearchActionOverflow() {
  updateVideoTitleArtistWidths();

  const actionEntries = [...videoList.querySelectorAll('.video-search-action')]
    .map(button => ({
      button,
      text: button.querySelector('.video-search-action-text')
    }))
    .filter(entry => entry.text);

  actionEntries.forEach(({ button }) => {
    button.classList.remove('is-overflowing');
    button.style.removeProperty('--search-scroll-distance');
    button.style.removeProperty('--search-scroll-duration');
  });

  const overflowMeasurements = actionEntries.map(({ button, text }) => {
    const overflow = text.scrollWidth - button.clientWidth;
    if (overflow <= 1) return null;

    return {
      button,
      distance: overflow + 12,
      duration: Math.min(Math.max((overflow + 12) / 24, 2.8), 8)
    };
  }).filter(Boolean);

  overflowMeasurements.forEach(({ button, distance, duration }) => {
    button.classList.add('is-overflowing');
    button.style.setProperty('--search-scroll-distance', `${distance}px`);
    button.style.setProperty('--search-scroll-duration', `${duration}s`);
  });
}

function updateVideoTitleArtistWidths() {
  const widthBuffer = 8;
  const rowEntries = [...videoList.querySelectorAll('.video-item-row')]
    .map(row => {
      const title = row.querySelector('.video-title');
      if (!title) return null;

      const artist = row.querySelector('.video-artist');
      return {
        row,
        title,
        artist,
        titleText: title.querySelector('.video-search-action-text'),
        artistText: artist?.querySelector('.video-search-action-text'),
        separator: row.querySelector('.video-title-separator')
      };
    })
    .filter(Boolean);

  rowEntries.forEach(({ title, artist }) => {
    [title, artist].filter(Boolean).forEach(element => {
      element.style.removeProperty('flex');
      element.style.removeProperty('width');
    });
  });

  const widthMeasurements = rowEntries.map(entry => {
    const { row, title, artist, titleText, artistText, separator } = entry;
    if (!artist || !titleText || !artistText) return null;

    const rowStyle = window.getComputedStyle(row);
    const gap = parseFloat(rowStyle.columnGap || rowStyle.gap) || 0;
    const reservedWidth = (separator?.offsetWidth || 0) + (gap * 2);
    const availableWidth = Math.max(row.clientWidth - reservedWidth, 0);
    const titleWidth = titleText.scrollWidth + widthBuffer;
    const artistWidth = artistText.scrollWidth + widthBuffer;

    if (titleWidth + artistWidth <= availableWidth) {
      return {
        title,
        artist,
        titleFlex: `0 0 ${titleWidth}px`,
        artistFlex: `0 0 ${artistWidth}px`
      };
    }

    const minTitleWidth = Math.min(titleWidth, Math.max(availableWidth * 0.35, 72));
    const minArtistWidth = Math.min(artistWidth, Math.max(availableWidth * 0.28, 72));

    if (titleWidth <= availableWidth - minArtistWidth) {
      return {
        title,
        artist,
        titleFlex: `0 0 ${titleWidth}px`,
        artistFlex: `0 1 ${Math.max(availableWidth - titleWidth, minArtistWidth)}px`
      };
    }

    if (artistWidth <= availableWidth - minTitleWidth) {
      return {
        title,
        artist,
        titleFlex: `0 1 ${Math.max(availableWidth - artistWidth, minTitleWidth)}px`,
        artistFlex: `0 0 ${artistWidth}px`
      };
    }

    return {
      title,
      artist,
      titleFlex: `0 1 ${Math.max(availableWidth * 0.6, minTitleWidth)}px`,
      artistFlex: `0 1 ${Math.max(availableWidth * 0.4, minArtistWidth)}px`
    };
  }).filter(Boolean);

  widthMeasurements.forEach(({ title, artist, titleFlex, artistFlex }) => {
    title.style.flex = titleFlex;
    artist.style.flex = artistFlex;
  });
}

let videoSearchActionOverflowResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(videoSearchActionOverflowResizeTimer);
  videoSearchActionOverflowResizeTimer = setTimeout(updateVideoSearchActionOverflow, 200);
});

window.addEventListener("collabTagOrderReady", () => {
  if (!Array.isArray(currentFilteredVideos) || !currentFilteredVideos.length) return;
  renderVideoList(currentFilteredVideos);
  updateNowPlayingFilteredOutNotice();
  requestNowPlayingFloatingButtonUpdate();
});

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
    window.ScrollUtils.scrollPlayingCardIntoComfortView(playingElement);
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
    window.ScrollUtils.scrollPlayingCardIntoComfortView(playingElement);
  }
}

function clearNowPlayingState() {
  nowPlayingKey = null;
  currentPlayingVideo = null;
  playbackHistory = [];
  isYouTubePlaybackRequested = false;
  resetTikTokPlaybackControl();
  updatePlayPauseButton();
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
  updatePlayPauseButton();
  updateNowPlayingHighlight();
  updateNowPlayingFilteredOutNotice();
  requestNowPlayingFloatingButtonUpdate();
}

// ===== 動画の再生処理 =====
function loadVideo(video, item, options = {}) {
  resetEndCountdownForVideo(video);
  resetFullVersionPromptForVideo(video);
  const start = video._startSeconds ?? parseTimeToSeconds(video["start"], 0);
  let videoId = video["videoId"];
  let platform = video._platform || (video["platform"] || "").toLowerCase();

  if (!videoId) {
    clearPendingYouTubeVideoLoad();
    alert("videoId が指定されていません");
    return;
  }
  if (!platform) {
    clearPendingYouTubeVideoLoad();
    alert("platform が未指定のため再生できません");
    return;
  }

  setPlayerLayoutForVideo(video);

  if (platform.includes("youtube")) {
  const cueYouTubeVideo = shouldCueYouTubeVideo(options);
  isYouTubePlaybackRequested = !cueYouTubeVideo;
  resetTikTokPlaybackControl();
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
  syncPlayerDimensionsBeforeVideoLoad();
  requestYouTubeVideoLoad(videoId, start, { autoplay: !cueYouTubeVideo });

  startEndCountdownMonitor(video);
  startFullVersionPromptMonitor(video);

  } else if (platform === "tiktok") {
  clearPendingYouTubeVideoLoad();
  isYouTubePlaybackRequested = false;
  if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
    ytPlayer.stopVideo();
  }

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

  fixedPlayerEl.style.display = 'block';
  syncPlayerDimensionsBeforeVideoLoad();

  const tiktokId = getTikTokId(videoId);
  loadTikTokEmbed(tiktokId);
    
  stopEndCountdownMonitor();
  startFullVersionPromptMonitor(video);

  } else {
    clearPendingYouTubeVideoLoad();
    alert(`未対応の platform: ${platform}`);
    return;
  }

  

  recordPlaybackHistoryForNext(video);
  updateNowPlaying(video);
}

// ===== プレイヤーを閉じる =====
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    clearPendingYouTubeVideoLoad();
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
    if (tiktokPlayerEl) {
      tiktokPlayerEl.classList.add('hidden');
      tiktokPlayerEl.replaceChildren();
    }
    resetTikTokPlaybackControl();
    clearNowPlayingState();
    fixedPlayerEl.style.display = 'none';
  });
}




  // 古い埋め込みプレイヤーを削除（固定プレイヤーを使うので他のプレイヤーは削除）
  document.querySelectorAll('.video-player-container').forEach(el => el.remove());

// ===== 前へ/次へ =====
const prevVideoBtn = document.getElementById('prevVideoBtn');
const nextVideoBtn = document.getElementById('nextVideoBtn');

function playAdjacentVideo(direction, options = {}) {
  const list = getAdjacentPlaybackList();
  if (!list.length) return;

  const currentIndex = list.findIndex(v => getVideoKey(v) === nowPlayingKey);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const newIndex = (safeCurrentIndex + direction + list.length) % list.length;
  loadVideo(list[newIndex], null, options.loadVideoOptions || {});
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

  const key = event.key.toLowerCase();
  const code = event.code;

  if (
    event.ctrlKey &&
    event.altKey &&
    event.shiftKey &&
    !event.metaKey &&
    (key === 'm' || code === 'KeyM')
  ) {
    event.preventDefault();
    const enabled = !isManualPlayTestModeEnabled();
    setManualPlayTestModeEnabled(enabled);
    showManualPlayTestModeNotice(enabled);
    return;
  }

  if (!isPlayerVisible()) return;
  if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

  if ((key === 'a' || code === 'KeyA') && prevVideoBtn) {
    event.preventDefault();
    prevVideoBtn.click();
  } else if ((key === 'd' || code === 'KeyD') && nextVideoBtn) {
    event.preventDefault();
    nextVideoBtn.click();
  }
});
