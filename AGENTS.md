# Project Guide

この文書は、このリポジトリで開発・保守を始めるときの入口です。チャットが変わった場合も、最初にこの文書と作業内容に対応する仕様書を確認してください。

## Workspace

- 作業場所: `/Users/cyring_edit/Documents/GitHub/shigarikosong-clean`
- 本番: https://shigarikosong.github.io/
- Preview: https://shigarikosong-github-io.pages.dev/
- タグ定義・表示順の正本: `tag-config.js`
- 動画データの正本: `data/videos.json`

作業前に、作業場所と現在のブランチ、未コミット差分を確認してください。

## Working Agreement

- 作業ブランチはユーザーが作成する。
- Codexは指定された既存ブランチで作業し、別ブランチを作らない。
- Codexは明示的に依頼されない限り、commit、push、PR作成を行わない。
- Preview確認、push、マージはユーザーが行う。
- Codexは作業完了時にコミット名案を渡す。
- `.DS_Store`と`.github/.DS_Store`には触れず、コミットへ含めない。
- 既存の未コミット差分は勝手に戻さず、今回の変更と分けて扱う。
- 挙動変更と無関係なリファクタリング、整形、ファイル更新を混ぜない。

作業完了前に、ブランチ、変更ファイル、差分内容を確認してください。変更範囲に応じたテストを行い、未確認事項があれば報告します。

## Verification Policy

- Codexは、変更した機能に直接関係するテストと必要な静的確認を優先する。
- 文書だけの変更では、原則として全自動テストを実行せず、差分、参照、Markdownリンクなどを確認する。
- CSSだけの変更では、必要なCSS生成と関連差分を確認し、無関係なロジックテストを重複実行しない。
- 共通基盤、複数機能にまたがる処理、動画データ検査、テスト基盤、GitHub Actionsを変更した場合は、Codex側でも`pnpm test`を実行する。
- Pull RequestではGitHub Actionsが全自動テスト、動画JSON検査、Tailwind CSS生成差分を最終確認する。
- GitHub Actionsが成功した検査を、理由なくCodex側で再実行しない。失敗した場合は、該当ログと関連テストを確認して対応する。
- UIの見た目と実際の操作感は、ユーザーがCloudflare PagesのPreviewで最終確認する。

## Documentation

変更対象に応じて、次の正本を確認・更新してください。

- [フィルタータグ仕様](docs/filter-tag-rules.md): 検索、タグ状態、絞り込み、リセット、絞り込み後スクロール
- [プレイヤー挙動仕様](docs/player-behavior-rules.md): YouTube / TikTok、前後移動、Repeat / Random、サイズ、Now Playing
- [動画収録状況の自動確認](docs/content-coverage-monitor.md): Wiki監視、Issue通知、対象外コマンド
- [手動チェックリスト](docs/manual-checklist.md): Previewとマージ前の回帰確認

同じ仕様を複数の文書へ重複して書かず、詳細は上記の担当文書へ集約してください。この文書には作業開始に必要な案内と、リポジトリ全体に共通するルールだけを置きます。

## Main Files

- `index.html`: ページ構造、モーダル、固定プレイヤー、スクリプト読み込み順
- `style.css`: サイト固有の見た目とレスポンシブ調整
- `tailwind.generated.css`: 公開時に読み込む生成済みTailwind CSS
- `script.js`: データ読み込み、一覧描画、検索・絞り込みの統合、再生ライフサイクル
- `video-normalizer.js`: JSON行から検索・絞り込み・再生用の内部形式を作る
- `search-utils.js`: AND / OR / 除外検索の解析と一致判定
- `video-query.js`: 検索・include条件・日付・並び順による表示候補の作成
- `filter-state.js`: include / exclude状態の共通API
- `filter-tag-view.js`: タグの選択・除外表示とアクセシブルネーム
- `mobile-filter-modal.js`: モバイルフィルターモーダル
- `desktop-filter-panel.js`: デスクトップフィルターパネル
- `filter-scroll-position.js` / `scroll-utils.js`: 絞り込み後と再生中カードへのスクロール補正
- `playback-policy.js`: YouTubeの即時再生と手動再生モードの判定
- `playback-transition-policy.js`: 終了時のRepeat / Random遷移
- `player-size-policy.js`: 通常動画・Shorts・TikTokのプレイヤーサイズ計算
- `loading-status.js`: 読み込み状態表示とページトップボタン

カード項目、アクティブ条件、フィルター、再生処理を変更するときは、既存の正式な生成・更新経路へ反映してください。補助スクリプトから`renderVideoList()`、`applyFilters()`、`loadVideo()`などを後から上書きする経路は追加しません。

## Important Boundaries

- フィルター状態の読み書きは`window.FilterState`へ集約する。
- 検索解析は`SearchUtils`、表示候補作成は`VideoQuery`、除外適用は`FilterState`の担当を維持する。
- `currentFilteredVideos`は実際に表示されている一覧と一致させ、Random / Next / Previousの対象をずらさない。
- 動画カードは`script.js`の既存生成関数で組み立て、別のカード描画経路を作らない。
- `loadVideo()`を再生の入口として維持し、YouTube / TikTok固有処理を呼び出し側へ複製しない。
- プレイヤーの縦横比・最小サイズ・画面内クランプは`player-size-policy.js`で計算し、DOM操作や保存処理と混在させない。
- フィルターとプレイヤーはスクロール補正にも関係するため、変更後は固定UIに対象が隠れないことを確認する。

## Data Changes

スプレッドシートまたはJSONの列を変更するときは、少なくとも次を確認してください。

- `video-normalizer.js`の正規化
- `scripts/validate-video-data.mjs`の公開前検査
- `scripts/video-normalizer.test.mjs`と関連テスト
- `data/meta.json`を含む自動更新Workflow

空欄を許可する項目を一律に必須化しません。固定ID、参照先、再生元、日付、時刻など、公開時に壊れるデータを検査対象にします。

## Commands

依存関係の準備:

```sh
pnpm install
```

Tailwindクラスを追加・変更した場合:

```sh
pnpm run build:css
```

生成された`tailwind.generated.css`も変更へ含めます。

動画JSONの検査:

```sh
pnpm run validate:data
```

全自動テスト:

```sh
pnpm test
```

Pull Requestでは、GitHub Actionsが動画JSONの検査、全自動テスト、Tailwind CSSの生成差分を同じ構成で確認します。

主要ロジックの回帰テスト:

```sh
pnpm run test:regressions
```

動画収録状況のローカル確認:

```sh
pnpm run audit:content
```

テストの詳細と手動確認項目は[手動チェックリスト](docs/manual-checklist.md)を使用してください。UI変更の最終確認は、ユーザーがCloudflare PagesのPreviewで行います。

## Completion Report

作業完了時は、次を簡潔に報告してください。

- 変更したファイルと実装内容
- 実行したテスト・確認
- Previewで確認が必要な項目や残る制約
- コミット名案
