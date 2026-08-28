import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const WIKI_VIDEO_LIST_URL =
  "https://wikiwiki.jp/nijisanji/%E5%8F%B8%E8%B3%80%E3%82%8A%E3%81%93/%E5%8B%95%E7%94%BB%E4%B8%80%E8%A6%A7";
export const WIKI_SONG_SUMMARY_URL =
  "https://wikiwiki.jp/nijisanji/%E6%AD%8C%E5%94%B1%E3%81%BE%E3%81%A8%E3%82%81/%E5%8B%95%E7%94%BB/2024%E5%B9%B4%E3%83%87%E3%83%93%E3%83%A5%E3%83%BC";

const FETCH_TIMEOUT_MS = 20_000;
const MINIMUM_SOURCE_COUNTS = Object.freeze({
  wikiSongs: 180,
  wikiEditedVideos: 200,
  songSummary: 100,
});

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value) {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalYouTubeUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function mediaKey(platform, id) {
  return `${String(platform).toLowerCase()}:${String(id).trim()}`;
}

export function parseMediaReference(value, platformHint = "") {
  const rawValue = decodeHtmlEntities(String(value || "").trim());
  const normalizedHint = String(platformHint || "").trim().toLowerCase();

  if (normalizedHint === "youtube" && /^[A-Za-z0-9_-]{11}$/.test(rawValue)) {
    return {
      platform: "youtube",
      id: rawValue,
      url: canonicalYouTubeUrl(rawValue),
    };
  }

  if (normalizedHint === "tiktok" && /^\d{15,22}$/.test(rawValue)) {
    return {
      platform: "tiktok",
      id: rawValue,
      url: `https://www.tiktok.com/player/v1/${rawValue}`,
    };
  }

  let url;
  try {
    url = new URL(rawValue);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  if (hostname === "youtu.be") {
    const videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return {
        platform: "youtube",
        id: videoId,
        url: canonicalYouTubeUrl(videoId),
      };
    }
  }

  if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
    let videoId = url.searchParams.get("v") || "";
    if (!videoId) {
      const pathParts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "live", "embed"].includes(pathParts[0])) {
        videoId = pathParts[1] || "";
      }
    }

    if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return {
        platform: "youtube",
        id: videoId,
        url: canonicalYouTubeUrl(videoId),
      };
    }
  }

  if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) {
    const pathMatch = url.pathname.match(/\/(?:video|v1)\/(\d{15,22})(?:\/|$)/);
    if (pathMatch) {
      return {
        platform: "tiktok",
        id: pathMatch[1],
        url: rawValue,
      };
    }
  }

  return null;
}

export function extractMediaLinks(html, source) {
  const records = new Map();
  const anchorPattern =
    /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of String(html || "").matchAll(anchorPattern)) {
    const media = parseMediaReference(match[2]);
    if (!media) continue;

    const key = mediaKey(media.platform, media.id);
    const title = stripHtml(match[3]) || `${media.platform} ${media.id}`;
    const existing = records.get(key);

    if (existing) {
      existing.sources.add(source);
      if (existing.title === `${existing.platform} ${existing.id}`) {
        existing.title = title;
      }
      continue;
    }

    records.set(key, {
      ...media,
      title,
      sources: new Set([source]),
    });
  }

  return records;
}

const GENERIC_MEDIA_TITLES = new Set([
  "YouTube版",
  "TikTok版",
  "こちら",
  "ファンメイド楽曲",
  "動画",
]);

export function choosePreferredMediaTitle(currentTitle, candidateTitle, fallback) {
  const current = String(currentTitle || "").trim();
  const candidate = String(candidateTitle || "").trim();

  if (!current || current === fallback) return candidate || fallback;
  if (!candidate || candidate === fallback) return current;
  if (GENERIC_MEDIA_TITLES.has(current) && !GENERIC_MEDIA_TITLES.has(candidate)) {
    return candidate;
  }

  return current;
}

function findNamedAnchor(html, anchorName, fromIndex = 0) {
  const escapedName = anchorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<a\\b[^>]*\\bname\\s*=\\s*["']${escapedName}["'][^>]*>`,
    "i",
  );
  const match = pattern.exec(String(html || "").slice(fromIndex));
  return match ? fromIndex + match.index : -1;
}

export function extractNamedSection(html, startAnchor, endAnchor) {
  const startIndex = findNamedAnchor(html, startAnchor);
  if (startIndex < 0) {
    throw new Error(`Wiki section anchor not found: ${startAnchor}`);
  }

  const endIndex = findNamedAnchor(html, endAnchor, startIndex + 1);
  if (endIndex < 0) {
    throw new Error(`Wiki section anchor not found: ${endAnchor}`);
  }

  return String(html).slice(startIndex, endIndex);
}

export function extractEditedVideosSection(html) {
  const startIndex = findNamedAnchor(html, "edited_videos");
  if (startIndex < 0) {
    throw new Error("Wiki section anchor not found: edited_videos");
  }

  const columnEndIndex = String(html).indexOf(
    '<div class="column-left">',
    startIndex,
  );
  if (columnEndIndex < 0) {
    throw new Error("Wiki edited videos section end was not found");
  }

  return String(html).slice(startIndex, columnEndIndex);
}

export function extractRikoSongSummarySection(html) {
  const anchorIndex = findNamedAnchor(html, "RikoShiga");
  if (anchorIndex < 0) {
    throw new Error("Song summary anchor not found: RikoShiga");
  }

  const nextHeadingIndex = String(html).indexOf("<h4", anchorIndex + 1);
  if (nextHeadingIndex < 0) {
    throw new Error("Song summary section end was not found");
  }

  return String(html).slice(anchorIndex, nextHeadingIndex);
}

function mergeMediaMaps(...maps) {
  const merged = new Map();

  for (const map of maps) {
    for (const [key, record] of map) {
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, {
          ...record,
          sources: new Set(record.sources),
        });
        continue;
      }

      for (const source of record.sources) existing.sources.add(source);
      existing.title = choosePreferredMediaTitle(
        existing.title,
        record.title,
        `${existing.platform} ${existing.id}`,
      );
    }
  }

  return merged;
}

function ensureMinimumCount(label, records, minimum) {
  if (records.size < minimum) {
    throw new Error(
      `${label} returned ${records.size} media links; expected at least ${minimum}. The Wiki layout may have changed.`,
    );
  }
}

export function extractWikiSources(mainHtml, songSummaryHtml) {
  const wikiSongs = extractMediaLinks(
    extractNamedSection(mainHtml, "songs", "official_videos"),
    "司賀りこWiki 歌動画",
  );
  const wikiEditedVideos = extractMediaLinks(
    extractEditedVideosSection(mainHtml),
    "司賀りこWiki 投稿動画",
  );
  const songSummary = extractMediaLinks(
    extractRikoSongSummarySection(songSummaryHtml),
    "にじさんじWiki 歌唱まとめ",
  );

  ensureMinimumCount(
    "Wiki song section",
    wikiSongs,
    MINIMUM_SOURCE_COUNTS.wikiSongs,
  );
  ensureMinimumCount(
    "Wiki edited video section",
    wikiEditedVideos,
    MINIMUM_SOURCE_COUNTS.wikiEditedVideos,
  );
  ensureMinimumCount(
    "Wiki song summary",
    songSummary,
    MINIMUM_SOURCE_COUNTS.songSummary,
  );

  return {
    coverage: mergeMediaMaps(wikiSongs, songSummary),
    discovery: wikiEditedVideos,
    counts: {
      wikiSongs: wikiSongs.size,
      wikiEditedVideos: wikiEditedVideos.size,
      songSummary: songSummary.size,
    },
  };
}

export function getRegisteredMediaKeys(videos) {
  const keys = new Set();

  for (const video of videos) {
    const platform = String(video?.platform || "").trim().toLowerCase();
    const media = parseMediaReference(video?.videoId, platform);
    if (media) keys.add(mediaKey(media.platform, media.id));
  }

  return keys;
}

function getRuleKeySet(entries) {
  return new Set(
    (Array.isArray(entries) ? entries : [])
      .map((entry) => (typeof entry === "string" ? entry : entry?.key))
      .filter(Boolean),
  );
}

export function extractReportedKeys(text) {
  const keys = new Set();
  const pattern = /<!--\s*content-audit-id:([^\s]+)\s*-->/g;
  for (const match of String(text || "").matchAll(pattern)) {
    keys.add(match[1]);
  }
  return keys;
}

export function findCoverageCandidates({
  coverage,
  discovery,
  registeredKeys,
  ignoredKeys,
  discoveryBaselineKeys,
  reportedKeys = new Set(),
}) {
  const candidates = new Map();

  const addCandidate = (key, record, lane) => {
    const existing = candidates.get(key);
    if (existing) {
      existing.lanes.add(lane);
      for (const source of record.sources) existing.sources.add(source);
      return;
    }

    candidates.set(key, {
      ...record,
      key,
      lanes: new Set([lane]),
      sources: new Set(record.sources),
    });
  };

  for (const [key, record] of coverage) {
    if (registeredKeys.has(key) || ignoredKeys.has(key)) continue;
    addCandidate(key, record, "coverage");
  }

  for (const [key, record] of discovery) {
    if (
      registeredKeys.has(key) ||
      ignoredKeys.has(key) ||
      discoveryBaselineKeys.has(key)
    ) {
      continue;
    }
    addCandidate(key, record, "discovery");
  }

  const sortedCandidates = [...candidates.values()].sort((left, right) =>
    left.key.localeCompare(right.key, "ja"),
  );

  return {
    newCandidates: sortedCandidates.filter(
      (candidate) => !reportedKeys.has(candidate.key),
    ),
    knownCandidates: sortedCandidates.filter((candidate) =>
      reportedKeys.has(candidate.key),
    ),
  };
}

function formatCheckedAt(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replaceAll("/", "-");
}

function platformLabel(platform) {
  return platform === "youtube" ? "YouTube" : "TikTok";
}

function candidateLines(candidate) {
  const sources =
    candidate.sources instanceof Set
      ? candidate.sources
      : new Set(candidate.sources || []);
  const lanes =
    candidate.lanes instanceof Set
      ? candidate.lanes
      : new Set(candidate.lanes || []);
  const sourceText = [...sources].join(" / ");
  const laneText = lanes.has("coverage")
    ? "収録対象一覧との照合"
    : "投稿動画欄の初回確認後の追加";

  return [
    `- [${candidate.title}](${candidate.url})`,
    `  - ${platformLabel(candidate.platform)} ID: \`${candidate.id}\``,
    `  - 検出: ${laneText}（${sourceText}）`,
    `  <!-- content-audit-id:${candidate.key} -->`,
  ];
}

export function createMarkdownReport(result) {
  const lines = [
    `## ${result.checkedAt} JST`,
    "",
    "動画収録状況の定期確認を完了しました。",
    "",
    `- Wiki「歌動画」: ${result.sourceCounts.wikiSongs}件`,
    `- Wiki「投稿動画」: ${result.sourceCounts.wikiEditedVideos}件`,
    `- Wiki「歌唱まとめ」: ${result.sourceCounts.songSummary}件`,
    `- サイト登録済み動画ID: ${result.registeredCount}件`,
    `- 新しい未登録候補: **${result.newCandidates.length}件**`,
    `- 既報の未登録候補: ${result.knownCandidates.length}件`,
    "",
  ];

  if (!result.newCandidates.length && !result.knownCandidates.length) {
    lines.push("**新しい候補はありません。**", "");
  }

  if (result.newCandidates.length) {
    lines.push("### 新しい未登録候補", "");
    for (const candidate of result.newCandidates) {
      lines.push(...candidateLines(candidate), "");
    }
  }

  if (result.knownCandidates.length) {
    lines.push("### 既報・未登録の候補", "");
    for (const candidate of result.knownCandidates) {
      lines.push(...candidateLines(candidate), "");
    }
  }

  lines.push(
    "候補は自動追加されません。内容を確認し、追加または対象外を判断してください。",
    "",
  );

  return lines.join("\n");
}

async function fetchHtml(url) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "shigarikosong-content-monitor/1.0 (+https://github.com/shigarikosong/shigarikosong.github.io)",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      if (!html.includes("<html") || html.length < 10_000) {
        throw new Error(`Unexpected response body (${html.length} bytes)`);
      }
      return html;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }

  throw new Error(`Failed to fetch ${url}: ${lastError?.message || lastError}`);
}

function parseArguments(argv) {
  const options = {
    videos: "data/videos.json",
    rules: "data/content-coverage-rules.json",
    mainHtml: "",
    songSummaryHtml: "",
    reportedFile: "",
    jsonOutput: "",
    markdownOutput: "",
  };

  const optionNames = new Map([
    ["--videos", "videos"],
    ["--rules", "rules"],
    ["--main-html", "mainHtml"],
    ["--song-summary-html", "songSummaryHtml"],
    ["--reported-file", "reportedFile"],
    ["--json-output", "jsonOutput"],
    ["--markdown-output", "markdownOutput"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const optionName = optionNames.get(argv[index]);
    if (!optionName || !argv[index + 1]) {
      throw new Error(`Unknown or incomplete option: ${argv[index]}`);
    }
    options[optionName] = argv[index + 1];
    index += 1;
  }

  return options;
}

function serializableCandidate(candidate) {
  return {
    ...candidate,
    lanes: [...candidate.lanes],
    sources: [...candidate.sources],
  };
}

export async function runAudit(options) {
  const videos = JSON.parse(fs.readFileSync(options.videos, "utf8"));
  const rules = JSON.parse(fs.readFileSync(options.rules, "utf8"));
  const mainHtml = options.mainHtml
    ? fs.readFileSync(options.mainHtml, "utf8")
    : await fetchHtml(WIKI_VIDEO_LIST_URL);
  const songSummaryHtml = options.songSummaryHtml
    ? fs.readFileSync(options.songSummaryHtml, "utf8")
    : await fetchHtml(WIKI_SONG_SUMMARY_URL);

  const sources = extractWikiSources(mainHtml, songSummaryHtml);
  const registeredKeys = getRegisteredMediaKeys(videos);
  const ignoredKeys = getRuleKeySet(rules.ignored);
  const discoveryBaselineKeys = getRuleKeySet(
    rules.editedVideosBaseline?.ids,
  );
  const reportedText = options.reportedFile
    ? fs.readFileSync(options.reportedFile, "utf8")
    : "";
  const reportedKeys = extractReportedKeys(reportedText);
  const { newCandidates, knownCandidates } = findCoverageCandidates({
    coverage: sources.coverage,
    discovery: sources.discovery,
    registeredKeys,
    ignoredKeys,
    discoveryBaselineKeys,
    reportedKeys,
  });

  const result = {
    checkedAt: formatCheckedAt(new Date()),
    sourceCounts: sources.counts,
    registeredCount: registeredKeys.size,
    newCandidates: newCandidates.map(serializableCandidate),
    knownCandidates: knownCandidates.map(serializableCandidate),
  };
  const markdown = createMarkdownReport(result);

  return { result, markdown };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const { result, markdown } = await runAudit(options);

  if (options.jsonOutput) {
    fs.writeFileSync(options.jsonOutput, `${JSON.stringify(result, null, 2)}\n`);
  }
  if (options.markdownOutput) {
    fs.writeFileSync(options.markdownOutput, markdown);
  }

  process.stdout.write(markdown);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
