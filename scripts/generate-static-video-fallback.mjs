import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FALLBACK_LIMIT = 30;
const START_MARKER = '<!-- STATIC_VIDEO_FALLBACK_START -->';
const END_MARKER = '<!-- STATIC_VIDEO_FALLBACK_END -->';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseTimeToSeconds(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Math.floor(Number(text));

  const parts = text.split(':').map(part => part.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some(part => !/^\d+$/.test(part))) {
    return 0;
  }

  const numbers = parts.map(Number);
  const seconds = numbers.pop();
  const minutes = numbers.pop();
  const hours = numbers.pop() || 0;
  if (minutes > 59 || seconds > 59) return 0;
  return (hours * 3600) + (minutes * 60) + seconds;
}

function extractYouTubeVideoId(value) {
  const text = String(value ?? '').trim();
  if (/^[0-9A-Za-z_-]{11}$/.test(text)) return text;

  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);
    if (host === 'youtu.be') return parts[0] || '';
    if (
      host === 'youtube.com' || host.endsWith('.youtube.com') ||
      host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com')
    ) {
      return url.searchParams.get('v') || (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : '') || '';
    }
  } catch {
    return '';
  }

  return '';
}

function extractTikTokPostId(value) {
  const text = String(value ?? '').trim();
  if (/^\d+$/.test(text)) return text;
  return text.match(/\/video\/(\d+)/)?.[1] || '';
}

function getVideoUrl(video) {
  const platform = String(video.platform ?? '').trim().toLowerCase();
  const videoId = platform === 'tiktok'
    ? extractTikTokPostId(video.videoId)
    : extractYouTubeVideoId(video.videoId);
  if (!videoId) return '';

  if (platform === 'tiktok') {
    return `https://www.tiktok.com/@riko14218/video/${encodeURIComponent(videoId)}`;
  }

  const startSeconds = parseTimeToSeconds(video.start);
  const baseUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  return startSeconds > 0 ? `${baseUrl}&t=${startSeconds}s` : baseUrl;
}

function splitTags(value) {
  return String(value ?? '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

function renderField(label, value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return `\n          <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(text)}</dd></div>`;
}

function renderVideoEntry(video) {
  const title = String(video.title ?? '').trim();
  const artist = String(video.artist ?? '').trim();
  const publishedAt = String(video['公開月'] ?? '').trim();
  const formats = [
    ...splitTags(video['動画種別']),
    video['3D'] === 'TRUE' ? '3D' : '',
    video.Shorts === 'TRUE' ? 'Shorts' : ''
  ].filter(Boolean).join(', ');
  const url = getVideoUrl(video);
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(publishedAt)
    ? `<time datetime="${escapeHtml(publishedAt)}">${escapeHtml(publishedAt)}</time>`
    : escapeHtml(publishedAt);

  return `
      <article class="static-video-entry">
        <h2>${escapeHtml(title)}</h2>
        <dl>${artist ? renderField('アーティスト', artist) : ''}${
          publishedAt ? `\n          <div><dt>公開日</dt><dd>${dateValue}</dd></div>` : ''
        }${renderField('動画・配信名', video.waku_name)}${renderField('カテゴリ', video['カテゴリ'])}${
          renderField('プラットフォーム', video.platform)
        }${renderField('担当', splitTags(video['担当区分']).join(', '))}${renderField('形式', formats)}${
          renderField('コラボ', splitTags(video['コラボライバー']).join(', '))
        }${renderField('コラボユニット', splitTags(video['コラボユニット']).join(', '))}</dl>
        ${url ? `<a href="${escapeHtml(url)}">${escapeHtml(video.platform || '動画')}で見る</a>` : ''}
      </article>`;
}

function renderFallback(videos, limit = FALLBACK_LIMIT) {
  const latestVideos = videos
    .map((video, index) => ({ video, index }))
    .sort((left, right) => {
      const dateComparison = String(right.video['公開月'] ?? '')
        .localeCompare(String(left.video['公開月'] ?? ''));
      return dateComparison || left.index - right.index;
    })
    .slice(0, limit)
    .map(entry => entry.video);
  const entries = latestVideos.map(renderVideoEntry).join('');
  return `${START_MARKER}
    <section class="static-video-fallback" data-static-video-fallback aria-label="最新の動画記録">
      <h2 class="static-video-fallback-title">最新の動画記録</h2>
      <p class="static-video-fallback-note">動画一覧を読み込めない場合に備え、最新${latestVideos.length}件を掲載しています。</p>${entries}
    </section>
    ${END_MARKER}`;
}

function updateIndexHtml(indexHtml, videos, limit = FALLBACK_LIMIT) {
  const start = indexHtml.indexOf(START_MARKER);
  const end = indexHtml.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Static video fallback markers were not found in index.html');
  }

  return `${indexHtml.slice(0, start)}${renderFallback(videos, limit)}${indexHtml.slice(end + END_MARKER.length)}`;
}

function generate({ rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') } = {}) {
  const dataPath = path.join(rootDir, 'data/videos.json');
  const indexPath = path.join(rootDir, 'index.html');
  const videos = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  if (!Array.isArray(videos) || !videos.length) {
    throw new Error('data/videos.json must contain at least one video');
  }

  const currentHtml = fs.readFileSync(indexPath, 'utf8');
  const nextHtml = updateIndexHtml(currentHtml, videos);
  fs.writeFileSync(indexPath, nextHtml);
  console.log(`Generated ${Math.min(videos.length, FALLBACK_LIMIT)} static video fallback entries.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generate();

export {
  END_MARKER,
  FALLBACK_LIMIT,
  START_MARKER,
  escapeHtml,
  extractTikTokPostId,
  extractYouTubeVideoId,
  generate,
  getVideoUrl,
  parseTimeToSeconds,
  renderFallback,
  updateIndexHtml
};
