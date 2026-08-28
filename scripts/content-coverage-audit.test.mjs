import assert from "node:assert/strict";
import test from "node:test";

import {
  choosePreferredMediaTitle,
  createMarkdownReport,
  extractEditedVideosSection,
  extractMediaLinks,
  extractNamedSection,
  extractReportedKeys,
  findCoverageCandidates,
  getRegisteredMediaKeys,
  mediaKey,
  parseMediaReference,
} from "./content-coverage-audit.mjs";

function mediaRecord(platform, id, title = id) {
  const media = parseMediaReference(id, platform);
  return {
    ...media,
    title,
    sources: new Set(["test source"]),
  };
}

test("parseMediaReference normalizes supported YouTube and TikTok URLs", () => {
  assert.deepEqual(
    parseMediaReference("https://www.youtube.com/shorts/25kxmWP378w"),
    {
      platform: "youtube",
      id: "25kxmWP378w",
      url: "https://www.youtube.com/watch?v=25kxmWP378w",
    },
  );
  assert.deepEqual(
    parseMediaReference("https://youtu.be/D4_NuzFsO6s?t=12"),
    {
      platform: "youtube",
      id: "D4_NuzFsO6s",
      url: "https://www.youtube.com/watch?v=D4_NuzFsO6s",
    },
  );
  assert.deepEqual(
    parseMediaReference(
      "https://www.tiktok.com/@riko14218/video/7463017926623333653",
    ),
    {
      platform: "tiktok",
      id: "7463017926623333653",
      url: "https://www.tiktok.com/@riko14218/video/7463017926623333653",
    },
  );
});

test("section helpers isolate song and edited-video content", () => {
  const html = `
    <a class="anchor_super" name="songs"></a>
    <a href="https://youtu.be/25kxmWP378w">Song &amp; title</a>
    <a class="anchor_super" name="official_videos"></a>
    <a class="anchor_super" name="edited_videos"></a>
    <a href="https://www.youtube.com/shorts/D4_NuzFsO6s"><b>Dance</b></a>
    <div class="column-left">menu</div>
  `;

  const songs = extractMediaLinks(
    extractNamedSection(html, "songs", "official_videos"),
    "songs",
  );
  const edited = extractMediaLinks(extractEditedVideosSection(html), "edited");

  assert.deepEqual([...songs.keys()], ["youtube:25kxmWP378w"]);
  assert.equal(songs.get("youtube:25kxmWP378w").title, "Song & title");
  assert.deepEqual([...edited.keys()], ["youtube:D4_NuzFsO6s"]);
  assert.equal(edited.get("youtube:D4_NuzFsO6s").title, "Dance");
});

test("a specific song title is preferred over a generic Wiki link label", () => {
  assert.equal(
    choosePreferredMediaTitle(
      "ファンメイド楽曲",
      "梅雨空とスタインウェイ",
      "youtube yZoMWk58tQo",
    ),
    "梅雨空とスタインウェイ",
  );
  assert.equal(
    choosePreferredMediaTitle(
      "Special Spell",
      "YouTube版",
      "youtube 25kxmWP378w",
    ),
    "Special Spell",
  );
});

test("findCoverageCandidates separates new, reported, registered, baseline, and ignored IDs", () => {
  const coverage = new Map([
    [
      "youtube:25kxmWP378w",
      mediaRecord("youtube", "25kxmWP378w", "new song"),
    ],
    [
      "youtube:D4_NuzFsO6s",
      mediaRecord("youtube", "D4_NuzFsO6s", "reported song"),
    ],
    [
      "youtube:87T794_WY_w",
      mediaRecord("youtube", "87T794_WY_w", "registered song"),
    ],
    [
      "youtube:6B_Qy_KP2_o",
      mediaRecord("youtube", "6B_Qy_KP2_o", "ignored next link"),
    ],
  ]);
  const discovery = new Map([
    [
      "youtube:X4U6eUFCVOo",
      mediaRecord("youtube", "X4U6eUFCVOo", "baseline video"),
    ],
    [
      "youtube:7qKWkW0DFbU",
      mediaRecord("youtube", "7qKWkW0DFbU", "new edited video"),
    ],
  ]);

  const result = findCoverageCandidates({
    coverage,
    discovery,
    registeredKeys: new Set(["youtube:87T794_WY_w"]),
    ignoredKeys: new Set(["youtube:6B_Qy_KP2_o"]),
    discoveryBaselineKeys: new Set(["youtube:X4U6eUFCVOo"]),
    reportedKeys: new Set(["youtube:D4_NuzFsO6s"]),
  });

  assert.deepEqual(
    result.newCandidates.map((candidate) => candidate.key),
    ["youtube:25kxmWP378w", "youtube:7qKWkW0DFbU"],
  );
  assert.deepEqual(
    result.knownCandidates.map((candidate) => candidate.key),
    ["youtube:D4_NuzFsO6s"],
  );
});

test("registered and reported IDs are normalized from site data and Issue comments", () => {
  const registered = getRegisteredMediaKeys([
    {
      platform: "YouTube",
      videoId: "25kxmWP378w",
    },
    {
      platform: "TikTok",
      videoId:
        "https://www.tiktok.com/@riko14218/video/7463017926623333653",
    },
  ]);

  assert(registered.has(mediaKey("youtube", "25kxmWP378w")));
  assert(registered.has(mediaKey("tiktok", "7463017926623333653")));

  const reported = extractReportedKeys(`
    <!-- content-audit-id:youtube:D4_NuzFsO6s -->
    <!-- content-audit-id:tiktok:7463017926623333653 -->
  `);
  assert.deepEqual([...reported], [
    "youtube:D4_NuzFsO6s",
    "tiktok:7463017926623333653",
  ]);
});

test("Markdown report always records a successful no-candidate run", () => {
  const markdown = createMarkdownReport({
    checkedAt: "2026-08-28 10:23",
    sourceCounts: {
      wikiSongs: 232,
      wikiEditedVideos: 289,
      songSummary: 152,
    },
    registeredCount: 422,
    newCandidates: [],
    knownCandidates: [],
  });

  assert.match(markdown, /新しい候補はありません/);
  assert.match(markdown, /2026-08-28 10:23 JST/);
});

test("Markdown report renders serialized candidates and keeps their report marker", () => {
  const markdown = createMarkdownReport({
    checkedAt: "2026-08-28 10:23",
    sourceCounts: {
      wikiSongs: 232,
      wikiEditedVideos: 289,
      songSummary: 152,
    },
    registeredCount: 422,
    newCandidates: [
      {
        platform: "youtube",
        id: "25kxmWP378w",
        key: "youtube:25kxmWP378w",
        title: "new song",
        url: "https://www.youtube.com/watch?v=25kxmWP378w",
        lanes: ["coverage"],
        sources: ["test source"],
      },
    ],
    knownCandidates: [],
  });

  assert.match(markdown, /new song/);
  assert.match(
    markdown,
    /<!-- content-audit-id:youtube:25kxmWP378w -->/,
  );
});
