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
- `renderVideoList()` は `script.js` が持ち、枠名表示とコラボメンバー収納もカード生成時に処理する。補助スクリプトから上書きしない
- `renderActiveTagChips()` は include と exclude の両方を表示する。exclude は `- Shorts` のように表示する
- ランダム再生、Next / Previous、全曲リピート時の対象は `currentFilteredVideos` を基準にする
- リスト内タグの3状態クリックは `script.js` の `handleListTagClick()` が担当する
- 動画カード内の再生は左側の再生ボタンが担当する。曲名・アーティスト名は検索語の置き換えに使う
- PCフィルター内タグの3状態クリックは、`script.js` と `desktop-filter-panel.js` が担当する
- モバイルフィルター内タグの3状態クリックは、`script.js` と `mobile-filter-modal.js` が担当する
- `exclusion-style-sync.js` はタグクリックやリセットを横取りしない。除外スタイル同期だけを行う
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
- `selectedCollabTags`（Collab includeの実体。`selectedCollabTag` は互換用）
- `selectedRoleTags`（Riko Part includeの実体。`selectedRoleTag` は互換用）
- `selectedPlatformTag`
- `selected3DTag`
- `selectedShortsTag`
- `selectedVideoTypeTags`

## 補助スクリプトについて

現在、以下の補助スクリプトがタグ・フィルター周りに関係している。

- `mobile-filter-modal.js`
- `desktop-filter-panel.js`
- `exclusion-style-sync.js`
- `playing-scroll-position.js`
- `filter-scroll-position.js`

特に `exclusion-style-sync.js` は、除外状態の見た目を後から同期しているため、今後も本体のフィルター処理へ少しずつ統合していきたい。

`time-tag-active.js` は削除済み。復活させる前に、`script.js` の `renderDateTags()` と `renderActiveTagChips()`、`filter-state.js` のdate状態で対応できないか確認する。

## 今後Codex/ChatGPTに依頼するときのルール

- まずこの `DEVELOPMENT_NOTES.md` を読ませる
- いきなり全体整理を頼まない
- 「タグ周りだけ」「再生周りだけ」のように範囲を限定する
- 変更前に、どのファイルを触る予定か説明してもらう
- `applyFilters` や `renderVideoList` を上書きする新しい補助JSを追加しない方針で進める
- 枠名表示のために削除済みの `waku-name-display.js` を復活させず、カード項目は `renderVideoList()` の正式な描画工程へ追加する
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

## Tailwind CSSの生成

- 公開ページではTailwind CDNを使用せず、生成済みの`tailwind.generated.css`を読み込む
- Tailwindクラスを`index.html`またはJavaScript内で追加・変更した場合は、`pnpm run build:css`を実行する
- `tailwind.generated.css`は公開に必要なファイルなので、CSSを再生成した場合は差分へ含める
- Tailwindの探索対象は`tailwind.config.js`で管理し、動的なクラス名を追加する場合は生成漏れがないか確認する

## 動画JSONの検査

- `scripts/validate-video-data.mjs`は`data/videos.json`と`data/meta.json`の公開前検査を担当する
- ローカルでは`pnpm run validate:data`で実行する
- JSON自動更新Workflowは一時ファイルを検査し、成功した場合だけ`data/`へコピーする
- Format、Riko Part、Collabの値は追加を妨げないため固定リスト検査をせず、必須項目・固定ID・参照・再生元・時刻・日付など、壊れたデータだけをエラーにする


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
- イラスト

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

YouTube再生とAPI準備待ちは `script.js` が担当する。初回の早い再生操作は `YT.Player` の生成だけで実行せず、`onReady` 後に待機中の最新動画を1回だけ読み込む。削除済みの `youtube-stability.js` による `loadVideo()` の上書きを復活させない。
開始秒 `start` の反映も関係するため、タグ整理とは別作業にする。

### TikTok再生

TikTok埋め込みは `script.js` 内の `loadTikTokEmbed` 周辺が関係し、公式Embed Playerの `player/v1/{POST_ID}` iframeを使用する。固定プレイヤーの再生／一時停止は公式の `postMessage` APIで操作し、`onPlayerReady` / `onStateChange` でボタン状態を同期する。
PCブラウザではTikTok埋め込み自体が不安定なことがある。

### プレイヤー位置・高さ

以下のファイルが関係している。

- `script.js`
- `player-collapse.js`
- `style.css`
- `scroll-utils.js`
- `loading-status.js`
- `playing-scroll-position.js`
- `filter-scroll-position.js`

タグ整理と同時に触らない。

`playerStageDock` は中央配置と将来の四隅配置、`playerStage` は動画の実幅、`playerFrameWrapper` は動画の実高さを担当する。通常YouTubeは16:9、Shorts/TikTokは9:16を基準にし、配置とサイズ計算を混在させない。YouTube行の `player_aspect` に `9:16` または `16:9` があればShorts判定より優先し、空欄・未対応値は自動判定へ戻す。TikTokは縦型を維持する。

横動画と縦動画を切り替える際は、次の埋め込みを読み込む前に新しい比率のstageサイズを同期し、レイアウト確定後にも再適用する。前の動画の比率を残したまま新しい動画を読み込まないこと。

`playerResizeHandle` は方向判定後、上下ドラッグでは比率を維持したサイズ変更、左右ドラッグではサイズを維持した水平移動を行う。水平位置は画面幅に対する0〜1の割合で保存し、縦横動画切替・resize・orientationchange時に再計算して画面内へクランプする。ハンドルと `.player-window-actions` はstageと同じ水平位置へ追従させる。

### スクロール挙動

以下のファイルが関係している。

- `playing-scroll-position.js`
- `filter-scroll-position.js`
- `scroll-utils.js`

タグ整理中はなるべく触らない。

PCフィルターの「閉じる」とモバイルフィルターモーダルの「閉じる」は、再生中カードが表示リスト内にあればそこへ、なければ結果件数または動画一覧先頭へ即時ジャンプする。


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
