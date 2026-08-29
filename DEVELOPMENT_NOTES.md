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

- `filter-state.js` はinclude / excludeのタグ状態を非公開領域で保持し、`window.FilterState`として読み書き・アクティブチップ用データ・除外判定のAPIを公開する
- `filter-tag-view.js` は `FilterState` を読み、タグ生成時にinclude / exclude / noneの表示クラス・文言・アクセシブルネームを確定する
- `search-utils.js` は検索文字列のAND / OR / 除外解析と、正規化済み動画テキストとの一致判定を持つ
- `video-normalizer.js` はJSON行からタグ配列・platform・時刻・表示フラグ・検索用文字列などの内部フィールドを作る
- `video-query.js` は検索済み条件・include条件・日付・並び順を受け取り、表示候補の動画配列を作る。exclude条件は引き続き`FilterState`が担当する
- フィルター適用は、`FilterState.getState()`、`SearchUtils.parseSearchQuery()`、`VideoQuery.filterAndSortVideos()`、`FilterState.filterExcludedVideos()`の順に行う。この境界は`scripts/filter-pipeline.test.mjs`で一連確認する
- `playback-policy.js` はYouTubeを即時再生するかcueで待機するかを判定し、手動再生モードを個別の`autoplay`指定より優先する
- `playback-transition-policy.js` は再生終了時のRepeat / Randomに応じた停止・同曲・次曲・ランダム遷移と、自動連続再生対象を判定する
- `player-size-policy.js` は通常動画・Shorts・TikTokのレイアウト選択と、希望サイズ・利用可能領域から最終プレイヤーサイズを求める純粋な計算を担当する
- `loadVideo()` は動画データの確認とplatform振り分けを担当し、YouTube / TikTok固有の読み込み、監視開始、終了処理は名前付きのライフサイクル関数へ分ける
- `script.js` は検索・include条件・exclude条件を反映した表示リストを作り、`currentFilteredVideos` を実際に見えているリストに合わせる
- `renderVideoList()` は `script.js` が持ち、一覧差し替えと描画後処理を担当する。カード内の再生・検索・メタ情報・通常タグ・コラボタグは同ファイルの名前付き生成関数で組み立て、補助スクリプトから上書きしない
- 動画JSONとmeta JSONは`script.js`の専用読み込み関数で取得・確認し、`loading-status.js`は状態表示とページトップボタンだけを担当する
- `loading-status.js`から`window.fetch`、`populateFilters()`、`renderVideoList()`、`loadVideo()`を上書きしない
- `renderActiveTagChips()` は include と exclude の両方を表示し、検索語・タグ条件のチップ生成と解除は同ファイルの名前付き関数へ分ける。Timeなど特定チップだけの別クリック監視を追加しない
- Platform / Category / Timeの上部フィルタータグは、`script.js` の `renderFilterTagButtons()` でボタン生成とPC・モバイルのクリック経路を共通化し、各 `render*Tags()` は値と固有処理だけを渡す
- `populateFilters()` は動画データ由来の選択肢収集・描画だけを担当し、検索・リセット・モバイルランダム再生のイベントは `initializeFilterControls()` で一度だけ登録する
- ランダム再生、Next / Previous、全曲リピート時の対象は `currentFilteredVideos` を基準にする
- リスト内タグの3状態クリックは `script.js` の `handleListTagClick()` が担当する
- 動画カード内の再生は左側の再生ボタンが担当する。曲名・アーティスト名は検索語の置き換えに使う
- PCフィルター内タグの3状態クリックは、`script.js` と `desktop-filter-panel.js` が担当する
- モバイルフィルター内タグの3状態クリックは、`script.js` と `mobile-filter-modal.js` が担当する
- include / exclude表示は各タグの正式な描画工程から `FilterTagView` を明示的に呼び、描画後の全ボタン探索では同期しない
- `time-tag-active.js` は削除済み。Timeタグは `script.js` / `FilterState` 側で扱う
- タグ系補助スクリプトは `index.html` で明示読み込みする。`loading-status.js` から後追い読み込みしない

## 触るときの注意

以下の関数・APIはタグや表示に深く関係しているため、変更時は要注意。

- `applyFilters`
- `renderVideoList`
- `renderActiveTagChips`
- `loadVideo`
- `FilterState.getState()` / `setState()` / `resetState()`
- `FilterState.toggleTag()` / `setTagState()`
- `FilterState.filterExcludedVideos()`

## 補助スクリプトについて

現在、以下の補助スクリプトがタグ・フィルター周りに関係している。

- `mobile-filter-modal.js`
- `desktop-filter-panel.js`
- `filter-tag-view.js`
- `filter-scroll-position.js`

PC・モバイル・動画カードのタグを追加するときは、`FilterTagView.getPresentation()` と `applyButton()` を描画時に使い、include / exclude状態を後から同期する補助処理を追加しない。

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
- `title`と`artist`は空白だけの場合も含めて必須とし、空欄可能な項目は一律に必須化しない
- Format、Riko Part、Collabの値は追加を妨げないため固定リスト検査をせず、必須項目・固定ID・参照・再生元・時刻・日付など、壊れたデータだけをエラーにする

## 動画収録状況の自動確認

- `scripts/content-coverage-audit.mjs`は、司賀りこWikiの歌動画・投稿動画と歌唱まとめを`data/videos.json`へ照合する
- `data/content-coverage-rules.json`は、投稿動画欄の初回確認時点と、判断済みの対象外動画を管理する
- 投稿動画欄の新しい動画は内容を自動判定せず、人が追加または対象外を判断する候補として扱う
- 監視Issueへ候補なし・候補あり・取得失敗のいずれも記録し、候補をJSONへ自動追加しない
- `editedVideosBaseline.ids`は初回確認時点を表すため、通常の候補処理では更新しない
- 詳細は`docs/content-coverage-monitor.md`を確認する

## 自動回帰テスト

- `pnpm test`で、動画データ検査と動画正規化・絞り込み判定・フィルター状態・タグ表示・再生／遷移方針・プレイヤーサイズ・検索・スクロール補正の全テストを実行する
- `pnpm run test:regressions`で、動画正規化・絞り込み判定・フィルター状態・タグ表示・再生／遷移方針・プレイヤーサイズ・検索・スクロール補正だけを実行する
- `scripts/browser-script-test-utils.mjs`は、本番のブラウザ用スクリプトをNodeの隔離環境で直接読み込む。複数ファイルの連携確認も同じ環境へ読み込み、テスト専用に同じロジックを複製しない
- 動画の内部フィールドを変更した場合は`video-normalizer.test.mjs`、検索からinclude / excludeまでの境界を変更した場合は`filter-pipeline.test.mjs`、include条件や並び順を変更した場合は`video-query.test.mjs`、検索演算子を変更した場合は`search-utils.test.mjs`、タグ状態を変更した場合は`filter-state.test.mjs`、タグのinclude / exclude表示を変更した場合は`filter-tag-view.test.mjs`、YouTubeのcue / autoplay優先順位を変更した場合は`playback-policy.test.mjs`、Repeat / Randomの終了時遷移を変更した場合は`playback-transition-policy.test.mjs`、固定UIを考慮したスクロールを変更した場合は`scroll-utils.test.mjs`を更新する
- プレイヤーの縦横比・最小サイズ・コンパクト表示・画面内クランプを変更した場合は`player-size-policy.test.mjs`を更新する


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
- `filter-scroll-position.js`

タグ整理と同時に触らない。

`playerStageDock` は中央配置と将来の四隅配置、`playerStage` は動画の実幅、`playerFrameWrapper` は動画の実高さを担当する。通常YouTubeは16:9、Shorts/TikTokは9:16を基準にし、配置とサイズ計算を混在させない。YouTube行の `player_aspect` に `9:16` または `16:9` があればShorts判定より優先し、空欄・未対応値は自動判定へ戻す。TikTokは縦型を維持する。

横動画と縦動画を切り替える際は、次の埋め込みを読み込む前に新しい比率のstageサイズを同期し、レイアウト確定後にも再適用する。前の動画の比率を残したまま新しい動画を読み込まないこと。

`playerResizeHandle` は方向判定後、上下ドラッグでは比率を維持したサイズ変更、左右ドラッグではサイズを維持した水平移動を行う。水平位置は画面幅に対する0〜1の割合で保存し、縦横動画切替・resize・orientationchange時に再計算して画面内へクランプする。ハンドルと `.player-window-actions` はstageと同じ水平位置へ追従させる。

展開中の最小化・閉じる操作は一時表示とし、PCでは動画面hover、モバイルではNow Playing操作またはYouTube／TikTokの再生状態変化でも再表示する。iframeを透明要素で覆ってタップを奪わない。モバイルハンドルの移動判定は約8pxとし、描画は1フレーム1回、位置・サイズ保存は操作終了時だけ行う。

### スクロール挙動

以下のファイルが関係している。

- `script.js`
- `filter-scroll-position.js`
- `scroll-utils.js`

タグ整理中はなるべく触らない。

PCフィルターの「閉じる」とモバイルフィルターモーダルの「閉じる」は、再生中カードが表示リスト内にあればそこへ、なければ結果件数または動画一覧先頭へ即時ジャンプする。

再生中カードへの移動は `ScrollUtils.scrollPlayingCardIntoComfortView()` を明示的に呼ぶ。ブラウザ標準の `Element.prototype.scrollIntoView` は上書きしない。


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
