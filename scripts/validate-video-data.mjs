import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SUPPORTED_PLATFORMS = new Set(["YouTube", "TikTok"]);
const SUPPORTED_CATEGORIES = new Set(["ソロ", "コラボ", "あやかき"]);
const SUPPORTED_BOOLEAN_VALUES = new Set(["TRUE", "FALSE"]);
const SUPPORTED_PLAYER_ASPECTS = new Set(["9:16", "16:9"]);
const COMMA_SEPARATED_FIELDS = ["動画種別", "担当区分", "コラボライバー", "コラボユニット"];

function toText(value) {
  if (value === null || value === undefined) return "";
  if (!["string", "number", "boolean"].includes(typeof value)) return "";
  return String(value).trim();
}

function formatValue(value) {
  const formatted = JSON.stringify(value);
  return formatted === undefined ? String(value) : formatted;
}

function getRecordLabel(row, index) {
  const number = toText(row?.number);
  const title = toText(row?.title);
  const details = [
    number ? `number=${formatValue(number)}` : "",
    title ? `title=${formatValue(title)}` : ""
  ].filter(Boolean).join(", ");

  return `動画データ ${index + 1}行目${details ? ` (${details})` : ""}`;
}

function parseTimeToSeconds(value) {
  const text = toText(value);
  if (!text) return null;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Math.floor(Number(text));

  const parts = text.split(":");
  if (parts.length < 2 || parts.length > 3) return Number.NaN;
  if (!parts.every(part => /^\d+$/.test(part.trim()))) return Number.NaN;

  const numbers = parts.map(part => Number(part.trim()));
  const seconds = numbers.pop();
  const minutes = numbers.pop();
  const hours = numbers.pop() || 0;
  if (minutes > 59 || seconds > 59) return Number.NaN;

  return (hours * 3600) + (minutes * 60) + seconds;
}

function isValidDate(value) {
  const match = toText(value).match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function extractYouTubeVideoId(value) {
  const text = toText(value);
  if (/^[0-9A-Za-z_-]{11}$/.test(text)) return text;

  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      return /^[0-9A-Za-z_-]{11}$/.test(id) ? id : "";
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com") {
      const pathParts = url.pathname.split("/").filter(Boolean);
      const id = url.searchParams.get("v") ||
        (["embed", "shorts", "live"].includes(pathParts[0]) ? pathParts[1] : "") || "";
      return /^[0-9A-Za-z_-]{11}$/.test(id) ? id : "";
    }
  } catch {
    return "";
  }

  return "";
}

function extractTikTokPostId(value) {
  const text = toText(value);
  if (/^\d+$/.test(text)) return text;
  return text.match(/\/video\/(\d+)/)?.[1] || "";
}

function validateCommaSeparatedField(row, field, label, errors) {
  const rawValue = toText(row[field]);
  if (!rawValue) return;

  const values = rawValue.split(",").map(value => value.trim());
  if (values.some(value => !value)) {
    errors.push(`${label}: ${field} に空のタグがあります (${formatValue(row[field])})`);
  }

  const nonEmptyValues = values.filter(Boolean);
  const duplicates = [...new Set(nonEmptyValues.filter((value, index) => nonEmptyValues.indexOf(value) !== index))];
  if (duplicates.length) {
    errors.push(`${label}: ${field} に重複タグがあります (${duplicates.map(formatValue).join(", ")})`);
  }
}

export function validateVideoData(videos, metaRows) {
  const errors = [];
  const normalizedRows = [];
  const numberOwners = new Map();
  const sourceKeyOwners = new Map();

  if (!Array.isArray(videos)) {
    errors.push("videos.json のルートは配列にしてください");
  } else if (!videos.length) {
    errors.push("videos.json に動画データがありません");
  } else {
    videos.forEach((row, index) => {
      const label = getRecordLabel(row, index);
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        errors.push(`${label}: 各レコードはオブジェクトにしてください`);
        return;
      }

      const number = toText(row.number);
      const title = toText(row.title);
      const videoId = toText(row.videoId);
      const platform = toText(row.platform);
      const category = toText(row["カテゴリ"]);
      const threeD = toText(row["3D"]);
      const shorts = toText(row.Shorts);
      const fullNumber = toText(row.full_number);
      const fullButtonText = toText(row.full_button_text);
      const playerAspect = toText(row.player_aspect);
      const publishedDate = toText(row["公開日"]);
      const publishedMonth = toText(row["公開月"]);

      if (!number) {
        errors.push(`${label}: number は必須です`);
      } else if (!/^\d+$/.test(number)) {
        errors.push(`${label}: number は数字の固定IDにしてください (${formatValue(row.number)})`);
      } else if (numberOwners.has(number)) {
        errors.push(`${label}: number ${formatValue(number)} が ${numberOwners.get(number)} と重複しています`);
      } else {
        numberOwners.set(number, label);
      }

      if (!title) errors.push(`${label}: title は必須です`);
      if (!videoId) errors.push(`${label}: videoId は必須です`);

      if (!SUPPORTED_PLATFORMS.has(platform)) {
        errors.push(`${label}: platform は YouTube または TikTok にしてください (${formatValue(row.platform)})`);
      }

      if (!SUPPORTED_CATEGORIES.has(category)) {
        errors.push(`${label}: カテゴリが未対応です (${formatValue(row["カテゴリ"])})`);
      }

      [["3D", threeD], ["Shorts", shorts]].forEach(([field, value]) => {
        if (!SUPPORTED_BOOLEAN_VALUES.has(value)) {
          errors.push(`${label}: ${field} は TRUE または FALSE にしてください (${formatValue(row[field])})`);
        }
      });

      if (!publishedDate && !publishedMonth) {
        errors.push(`${label}: 公開日または公開月は必須です`);
      }
      [["公開日", publishedDate], ["公開月", publishedMonth]].forEach(([field, value]) => {
        if (value && !isValidDate(value)) {
          errors.push(`${label}: ${field} は YYYY-MM-DD 形式の実在する日付にしてください (${formatValue(row[field])})`);
        }
      });

      if (playerAspect && !SUPPORTED_PLAYER_ASPECTS.has(playerAspect)) {
        errors.push(`${label}: player_aspect は 9:16、16:9、または空欄にしてください (${formatValue(row.player_aspect)})`);
      }

      if (fullNumber && !/^\d+$/.test(fullNumber)) {
        errors.push(`${label}: full_number は参照先numberの数字にしてください (${formatValue(row.full_number)})`);
      }
      if (fullButtonText && !fullNumber) {
        errors.push(`${label}: full_button_text を使う場合は full_number も指定してください`);
      }

      const startSeconds = parseTimeToSeconds(row.start);
      const endSeconds = parseTimeToSeconds(row.end);
      if (Number.isNaN(startSeconds)) {
        errors.push(`${label}: start の時刻形式が不正です (${formatValue(row.start)})`);
      }
      if (Number.isNaN(endSeconds)) {
        errors.push(`${label}: end の時刻形式が不正です (${formatValue(row.end)})`);
      }
      if (!Number.isNaN(startSeconds) && !Number.isNaN(endSeconds) && endSeconds !== null && endSeconds <= (startSeconds ?? 0)) {
        errors.push(`${label}: end は start より後の時刻にしてください (${formatValue(row.start)} -> ${formatValue(row.end)})`);
      }

      let normalizedSourceId = "";
      if (platform === "YouTube" && videoId) {
        normalizedSourceId = extractYouTubeVideoId(videoId);
        if (!normalizedSourceId) {
          errors.push(`${label}: YouTubeのvideoIdを判別できません (${formatValue(row.videoId)})`);
        }
      } else if (platform === "TikTok" && videoId) {
        normalizedSourceId = extractTikTokPostId(videoId);
        if (!normalizedSourceId) {
          errors.push(`${label}: TikTokの投稿IDを判別できません (${formatValue(row.videoId)})`);
        }
      }

      if (normalizedSourceId && !Number.isNaN(startSeconds)) {
        const sourceKey = `${platform}:${normalizedSourceId}:${startSeconds ?? 0}`;
        if (sourceKeyOwners.has(sourceKey)) {
          errors.push(`${label}: 同じ動画・開始位置が ${sourceKeyOwners.get(sourceKey)} と重複しています`);
        } else {
          sourceKeyOwners.set(sourceKey, label);
        }
      }

      COMMA_SEPARATED_FIELDS.forEach(field => {
        validateCommaSeparatedField(row, field, label, errors);
      });

      normalizedRows.push({ label, number, fullNumber });
    });

    const knownNumbers = new Set(normalizedRows.map(row => row.number).filter(Boolean));
    normalizedRows.forEach(({ label, number, fullNumber }) => {
      if (!fullNumber) return;
      if (fullNumber === number) {
        errors.push(`${label}: full_number に自分自身のnumberは指定できません`);
      } else if (!knownNumbers.has(fullNumber)) {
        errors.push(`${label}: full_number ${formatValue(fullNumber)} の参照先が存在しません`);
      }
    });
  }

  if (!Array.isArray(metaRows)) {
    errors.push("meta.json のルートは配列にしてください");
  } else {
    const lastUpdated = metaRows.find(row => toText(row?.["項目"]) === "最終更新日");
    if (!lastUpdated) {
      errors.push("meta.json に最終更新日の行がありません");
    } else if (!isValidDate(lastUpdated["値"])) {
      errors.push(`meta.json の最終更新日は YYYY-MM-DD または YYYY/MM/DD 形式の実在する日付にしてください (${formatValue(lastUpdated["値"])})`);
    }
  }

  return {
    errors,
    videoCount: Array.isArray(videos) ? videos.length : 0,
    metaCount: Array.isArray(metaRows) ? metaRows.length : 0
  };
}

async function readJson(filePath) {
  const source = await readFile(filePath, "utf8");
  return JSON.parse(source);
}

async function main() {
  const videosPath = process.argv[2] || "data/videos.json";
  const metaPath = process.argv[3] || "data/meta.json";

  try {
    const [videos, metaRows] = await Promise.all([
      readJson(videosPath),
      readJson(metaPath)
    ]);
    const result = validateVideoData(videos, metaRows);

    if (result.errors.length) {
      console.error(`動画データ検査で ${result.errors.length}件のエラーが見つかりました:`);
      result.errors.forEach(error => console.error(`- ${error}`));
      process.exitCode = 1;
      return;
    }

    console.log(`動画データ検査OK: 動画 ${result.videoCount}件 / meta ${result.metaCount}件`);
  } catch (error) {
    console.error(`動画データ検査を実行できませんでした: ${error.message}`);
    process.exitCode = 1;
  }
}

const executedFileUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === executedFileUrl) {
  await main();
}
