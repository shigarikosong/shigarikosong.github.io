# DEVELOPMENT_NOTES

このサイトは、司賀りこさんの歌・踊り・歌枠などをまとめる非公式ファンサイトです。

## 開発方針

- 既存の表示・再生挙動を壊さないことを最優先にする
- 大きな変更は一度にしない
- タグ・フィルター周りの変更は、必ず状態管理とUI表示の両方を確認する
- DOMの見た目やclass名だけを頼りに挙動を判断しない
- `textContent` や CSS class からタグ種別を推測する実装はなるべく増やさない
- 補助スクリプトで関数を後から上書きする実装はなるべく増やさない

## 今後の理想

タグ・フィルター状態は、将来的に1か所で管理したい。

例：

- 検索語
- ソート順
- 含めるタグ
- 除外するタグ
- カテゴリ
- Platform
- Time
- Format
- Riko Part
- Collab

をまとめて管理する。

## 触るときの注意

以下の関数・変数はタグや表示に深く関係しているため、変更時は要注意。

- `applyFilters`
- `renderVideoList`
- `renderActiveTagChips`
- `loadVideo`
- `selectedCategoryTag`
- `selectedDateTag`
- `selectedCollabTag`
- `selectedRoleTag`
- `selectedPlatformTag`
- `selected3DTag`
- `selectedShortsTag`
- `selectedVideoTypeTags`

## 補助スクリプトについて

現在、以下の補助スクリプトがタグ・フィルター周りに関係している。

- `mobile-filter-modal.js`
- `desktop-filter-panel.js`
- `tag-exclusion.js`
- `time-tag-active.js`
- `playing-scroll-position.js`
- `filter-scroll-position.js`

特に `tag-exclusion.js` と `time-tag-active.js` は、タグ状態や見た目を後から補正しているため、今後は本体のフィルター処理に統合したい。

## 今後Codex/ChatGPTに依頼するときのルール

- まずこの `DEVELOPMENT_NOTES.md` を読ませる
- いきなり全体整理を頼まない
- 「タグ周りだけ」「再生周りだけ」のように範囲を限定する
- 変更前に、どのファイルを触る予定か説明してもらう
- `applyFilters` や `renderVideoList` を上書きする新しい補助JSを追加しない方針で進める
- 挙動変更とリファクタリングを同時にしない


## 現在のタグ仕様メモ

### Style

- ソロ
- コラボ
- あやかき

### Platform

- youtube
- tiktok

### Time

- 最近
- 1年以内
- 1年以上前

### Format

- 3D
- Shorts
- 歌枠
- ライブ
- Full
- ハイライト
- アカペラ
- 企画
- 比較

### Riko Part

- VOCAL
- DANCE
- CHORUS
- MOVIE
- ILLUSTRATION
- PIANO
- EUPHONIUM
- KALIMBA

### Collab

コラボライバーとコラボユニットがある。
スプレッドシートではカンマ区切りで複数指定する。


## タグの3状態仕様

タグは将来的に以下の3状態で統一したい。

1. 未選択
2. 含める
3. 除外する

クリック順は以下を基本にする。

未選択 → 含める → 除外する → 未選択

### 表示ルール

- 含めるタグは通常のアクティブ色で表示する
- 除外するタグは `- Shorts` のようにマイナス付きで表示する
- アクティブチップにも含める条件と除外条件を表示する
- チップを押すとその条件を解除する

### 絞り込みルール

- 含めるタグに一致する動画だけを表示する
- 除外タグに一致する動画は表示しない
- 含める条件と除外条件が両方ある場合は、両方を満たすものだけ表示する

## 変更時に壊れやすいポイント

### YouTube再生

YouTube再生は `script.js` と `youtube-stability.js` が関係している。
開始秒 `start` の反映も関係するため、タグ整理とは別作業にする。

### TikTok再生

TikTok埋め込みは `script.js` 内の `loadTikTokEmbed` 周辺が関係する。
PCブラウザではTikTok埋め込み自体が不安定なことがある。

### プレイヤー位置・高さ

以下のファイルが関係している。

- `script.js`
- `player-collapse.js`
- `playing-scroll-position.js`
- `filter-scroll-position.js`

タグ整理と同時に触らない。

### スクロール挙動

以下のファイルが関係している。

- `playing-scroll-position.js`
- `filter-scroll-position.js`

タグ整理中はなるべく触らない。
