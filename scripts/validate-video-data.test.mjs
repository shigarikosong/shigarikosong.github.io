import assert from "node:assert/strict";
import test from "node:test";

import { validateVideoData } from "./validate-video-data.mjs";

function createVideo(overrides = {}) {
  return {
    number: "1",
    title: "テスト楽曲",
    artist: "テストアーティスト",
    videoId: "dQw4w9WgXcQ",
    start: "0",
    end: "",
    platform: "YouTube",
    カテゴリ: "ソロ",
    公開月: "2026-08-25",
    動画種別: "Full",
    担当区分: "VOCAL",
    コラボライバー: "",
    コラボユニット: "",
    "3D": "FALSE",
    Shorts: "FALSE",
    full_number: "",
    full_button_text: "",
    player_aspect: "",
    ...overrides
  };
}

const validMeta = [{ 項目: "最終更新日", 値: "2026/08/25" }];

test("現在の基本スキーマを受け入れる", () => {
  const result = validateVideoData([createVideo()], validMeta);
  assert.deepEqual(result.errors, []);
});

test("YouTube URLとTikTok URLを受け入れる", () => {
  const videos = [
    createVideo({ videoId: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
    createVideo({
      number: "2",
      platform: "TikTok",
      videoId: "https://www.tiktok.com/@example/video/1234567890123456789"
    })
  ];
  const result = validateVideoData(videos, validMeta);
  assert.deepEqual(result.errors, []);
});

test("number重複とfull_number参照切れを検出する", () => {
  const videos = [
    createVideo({ full_number: "99" }),
    createVideo({ title: "重複行", videoId: "M7lc1UVf-VE" })
  ];
  const result = validateVideoData(videos, validMeta);

  assert(result.errors.some(error => error.includes("number") && error.includes("重複")));
  assert(result.errors.some(error => error.includes("full_number") && error.includes("参照先")));
});

test("時刻範囲・縦横比・フラグの不正を検出する", () => {
  const video = createVideo({
    start: "1:02:03",
    end: "1:00:00",
    player_aspect: "4:3",
    Shorts: "YES"
  });
  const result = validateVideoData([video], validMeta);

  assert(result.errors.some(error => error.includes("end は start より後")));
  assert(result.errors.some(error => error.includes("player_aspect")));
  assert(result.errors.some(error => error.includes("Shorts")));
});

test("同じ動画・開始位置と重複タグを検出する", () => {
  const videos = [
    createVideo({ 動画種別: "Full, Full" }),
    createVideo({ number: "2", title: "同じ開始位置" })
  ];
  const result = validateVideoData(videos, validMeta);

  assert(result.errors.some(error => error.includes("同じ動画・開始位置")));
  assert(result.errors.some(error => error.includes("重複タグ")));
});

test("metaの最終更新日を検査する", () => {
  const result = validateVideoData([createVideo()], [{ 項目: "最終更新日", 値: "2026/02/30" }]);
  assert(result.errors.some(error => error.includes("meta.json") && error.includes("実在する日付")));
});
