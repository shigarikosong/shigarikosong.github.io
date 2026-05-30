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

## 現在のフィルター構成

- `filter-state.js` は `window.FilterState` として、include / exclude のタグ状態、アクティブチップ用データ、除外判定を持つ
- `script.js` は検索・include条件・exclude条件を反映した表示リストを作り、`currentFilteredVideos` を実際に見えているリストに合わせる
- `renderVideoList()` は `script.js` が持つ。`tag-exclusion.js` から上書きしない
- `renderActiveTagChips()` は include と exclude の両方を表示する。exclude は `- Shorts` のように表示する
- ランダム再生、Next / Previous、全曲リピート時の対象は `currentFilteredVideos` を基準にする
- `tag-exclusion.js` は3状態タグクリックと除外スタイル同期だけを担当する
- `time-tag-active.js` は削除済み。Timeタグは `script.js` / `FilterState` 側で扱う
- タグ系補助スクリプトは `index.html` で明示読み込みする。`loading-status.js` から後追い読み込みしない

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
- `playing-scroll-position.js`
- `filter-scroll-position.js`

特に `tag-exclusion.js` は、タグ状態や見た目を後から補正しているため、今後も本体のフィルター処理へ少しずつ統合していきたい。

`time-tag-active.js` は削除済み。復活させる前に、`script.js` の `renderDateTags()` と `renderActiveTagChips()`、`filter-state.js` のdate状態で対応できないか確認する。

## 今後Codex/ChatGPTに依頼するときのルール

- まずこの `DEVELOPMENT_NOTES.md` を読ませる
- いきなり全体整理を頼まない
- 「タグ周りだけ」「再生周りだけ」のように範囲を限定する
- 変更前に、どのファイルを触る予定か説明してもらう
- `applyFilters` や `renderVideoList` を上書きする新しい補助JSを追加しない方針で進める
- 挙動変更とリファクタリングを同時にしない

## Codex作業フロー

チャットが変わっても同じ進め方にするため、Codexに依頼するときは以下を基本にする。

- 作業前に `pwd` と `git status --short --branch` を確認する
- 作業ブランチはユーザーが作成する
- Codexは、ユーザーが指定した既存ブランチ上でそのまま作業する
- Codexは、ユーザーから明示的に頼まれない限り新しいブランチを作らない
- Codexは、ユーザーから明示的に頼まれない限り commit / push / PR 作成をしない
- push とマージはユーザー側で行う
- Codexは、作業完了時にコミット名案を渡す
- 作業完了時は `git status --short --branch` と `git diff` / `git diff --stat` で差分を確認する
- `.DS_Store` や `.github/.DS_Store` などの不要ファイルは触らない
- `.DS_Store` が作業ツリーに出ていても、コミット対象に含めない
- `.DS_Store` を戻す必要がある場合は、他の変更を巻き戻さず `.DS_Store` だけを対象にする
- 既存の未コミット差分がある場合、Codexは勝手に戻さず、今回の作業対象と分けて扱う
- 動作確認の観点は [手動チェックリスト](docs/manual-checklist.md) を使う


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


## スプレッドシート列メモ

現在コードで参照している主な列名。

- `title`
- `artist`
- `videoId`
- `start`
- `platform`
- `カテゴリ`
- `公開日`
- `公開月`
- `動画種別`
- `担当区分`
- `コラボライバー`
- `コラボユニット`
- `3D`
- `Shorts`
- `waku_name`

列名を変えるとコードが動かなくなる可能性がある。

## テスト環境

本番URL:

- https://shigarikosong.github.io/

検証用URL:

- https://shigarikosong-github-io.pages.dev/

今後は main にマージする前に、Cloudflare Pages の Preview Deployment で動作確認する。

確認項目:

- 動画一覧が読み込まれる
- 検索できる
- 各タグで絞り込みできる
- タグの含める / 除外が想定通り動く
- リセットが効く
- ランダム再生できる
- YouTube の開始秒 `start` が反映される
- TikTok 埋め込みが表示される
- スマホ表示でモーダルが動く
- プレイヤーの開閉・高さ変更が壊れていない
