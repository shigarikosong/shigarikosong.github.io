import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = new URL('../', import.meta.url);

export function videoRow(videoId, overrides = {}) {
  return {
    videoId,
    title: videoId,
    artist: 'Artist',
    platform: 'YouTube',
    start: 0,
    ...overrides
  };
}

export async function createAppFixture(t, rows, options = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  virtualConsole.on('error', (...args) => errors.push(args));
  const dom = new JSDOM(fs.readFileSync(new URL('index.html', root), 'utf8'), {
    url: 'https://site.test/',
    runScripts: 'outside-only',
    virtualConsole
  });
  const { window } = dom;
  const { document } = window;
  t.after(() => {
    window.close();
    assert.deepEqual(errors, [], 'page execution should not report errors');
  });

  const frames = new Map();
  const intervals = new Map();
  const scrolls = [];
  let nextId = 1;
  let now = Date.UTC(2026, 8, 9);
  window.Math.random = () => 0;
  window.Date.now = () => now;
  window.requestAnimationFrame = callback => {
    const id = nextId++;
    frames.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = id => frames.delete(id);
  window.setInterval = callback => {
    const id = nextId++;
    intervals.set(id, callback);
    return id;
  };
  window.clearInterval = id => intervals.delete(id);
  window.scrollTo = (...args) => scrolls.push(args);
  window.alert = message => errors.push(message);
  window.matchMedia = query => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {}
  });
  window.fetch = async url => {
    const pathname = new URL(url, window.location.href).pathname;
    assert.ok(['/data/videos.json', '/data/meta.json'].includes(pathname), `unexpected fetch: ${url}`);
    return {
      ok: true,
      json: async () => structuredClone(pathname === '/data/videos.json' ? rows : [])
    };
  };

  const youtube = { commands: [], time: 0, duration: 120, state: -1, events: null };
  window.YT = {
    PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    Player: class {
      constructor(id, config) { youtube.events = config.events; }
      loadVideoById(request) { youtube.commands.push({ type: 'load', ...request }); }
      cueVideoById(request) { youtube.commands.push({ type: 'cue', ...request }); }
      getCurrentTime() { return youtube.time; }
      getDuration() { return youtube.duration; }
      getPlayerState() { return youtube.state; }
      setSize() {}
      stopVideo() { youtube.commands.push({ type: 'stop' }); }
      playVideo() { youtube.commands.push({ type: 'play' }); }
      pauseVideo() { youtube.commands.push({ type: 'pause' }); }
    }
  };
  youtube.ready = () => youtube.events.onReady();
  youtube.emitState = state => {
    youtube.state = state;
    youtube.events.onStateChange({ data: state });
  };
  Object.entries(options.storage || {}).forEach(([key, value]) => window.localStorage.setItem(key, value));

  // Use the page's load order and real core/filter scripts; external media is simulated.
  const context = dom.getInternalVMContext();
  for (const element of document.querySelectorAll('script[src^="./"]')) {
    const name = new URL(element.src).pathname.slice(1);
    vm.runInContext(fs.readFileSync(new URL(name, root), 'utf8'), context, { filename: name });
    if (name === 'desktop-filter-panel.js') break;
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(window.allVideos.length, rows.length, 'initial data loading should finish');

  return {
    window, document, youtube, scrolls,
    visibleKeys: () => Array.from(document.querySelectorAll('#videoList [data-video-key]'), card => card.dataset.videoKey),
    play(key) {
      const card = Array.from(document.querySelectorAll('#videoList [data-video-key]'))
        .find(element => element.dataset.videoKey === key);
      assert.ok(card, `missing card: ${key}`);
      card.querySelector('.video-card-play-button').click();
    },
    async flushFrames(count = 3) {
      for (let i = 0; i < count; i++) {
        const pending = [...frames];
        frames.clear();
        pending.forEach(([, callback]) => callback(now));
        await Promise.resolve();
      }
    },
    sampleTime(seconds, elapsedMs = 500) {
      now += elapsedMs;
      youtube.time = seconds;
      for (const [id, callback] of [...intervals]) {
        if (intervals.has(id)) callback();
      }
    },
    activeMonitorCount: () => intervals.size
  };
}
