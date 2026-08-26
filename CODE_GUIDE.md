# コードの見方

このサイトは、現在 `index.html` にページの構造・見た目・動きがまとまっています。

今後の整理では、役割ごとに以下のように分けていくと扱いやすくなります。

## index.html

ページの骨組みです。

主に以下を置く場所です。

- タイトル
- ヘッダー
- 絞り込みボタン
- 曲リストを表示する場所
- 固定プレイヤーを表示する場所
- CSSやJavaScriptの読み込み

文章やボタンの並びを変えたいときは、まずこのファイルを見ます。

## style.css

ページの見た目を決めるファイルです。

主に以下を調整する場所です。

- 背景色
- 文字の見た目
- 曲リストのカード
- タグの見た目
- 固定プレイヤーの位置やサイズ

「色を変えたい」「余白を広げたい」「スマホで見た目を整えたい」というときは、このファイルを見ます。

## script.js

ページの動きを決めるファイルです。

主に以下を担当する場所です。

- Googleスプレッドシートから曲データを読み込む
- 検索・絞り込み条件を一覧へ反映する
- タグで絞り込む
- 並び順を変える
- YouTubeやTikTokを再生する
- ランダム再生する

「検索条件を増やしたい」「ランダム再生を変えたい」「スプレッドシートの列を増やしたい」というときは、このファイルを見ます。

プレイヤー読み込みでは、`loadVideo()`を入口として、YouTube / TikTokの読み込みとプレイヤーを閉じる処理をそれぞれの名前付き関数へ分けています。動画切替時の監視開始・停止を変更するときは、この入口と各platform用関数を一緒に確認します。

## video-normalizer.js

`data/videos.json`の各行を、検索・絞り込み・再生で使う内部形式へ変換する共通ファイルです。

スプレッドシートの列や`_roles`、`_types`、`_playerAspect`などの内部項目を変更するときは、このファイルと`scripts/video-normalizer.test.mjs`を一緒に確認します。

## search-utils.js

検索欄の文字列を解析する小さな共通ファイルです。

主に以下を担当します。

- 空白区切りのAND検索
- `OR`検索
- `-除外語`検索
- 解析した検索条件と動画データの一致判定

検索演算子のルールを変えたいときは、このファイルと`scripts/search-utils.test.mjs`を一緒に確認します。

## video-query.js

正規化済み動画へ検索・include条件・並び順を適用し、一覧へ渡す候補を作る共通ファイルです。

Collab / Riko PartのOR条件、FormatのAND条件、日付や並び順を変更するときは、このファイルと`scripts/video-query.test.mjs`を一緒に確認します。除外条件は`filter-state.js`が担当します。

## filter-tag-view.js

PC・モバイル・動画カードのタグを作るときに、選択・除外状態のクラスと表示を決める小さな共通ファイルです。

除外時のマイナス表示や色、読み上げ用ラベルを変えたいときは、このファイルと`scripts/filter-tag-view.test.mjs`を一緒に確認します。

## filter-state.js

include / excludeのタグ状態を非公開で保持し、PC・モバイル・動画カードへ共通の読み書きAPIを公開するファイルです。

タグ状態を変更するときは古いグローバル変数を追加せず、`window.FilterState`のAPIと`scripts/filter-state.test.mjs`を一緒に確認します。

検索から表示候補の作成、除外適用までのファイル間連携を変更するときは、`scripts/filter-pipeline.test.mjs`も一緒に確認します。このテストは`tag-config.js`、`date-utils.js`、`search-utils.js`、`video-query.js`、`filter-state.js`を同じ環境へ読み込みます。

## playback-policy.js

YouTube動画をすぐ再生するか、プレイヤー内の再生ボタンを待つかを決める小さな共通ファイルです。

手動再生モードと`autoplay`指定の優先順位を変えたいときは、このファイルと`scripts/playback-policy.test.mjs`を一緒に確認します。

## playback-transition-policy.js

動画終了時に停止するか、同じ動画・次の動画・ランダム動画へ進むかを決める小さな共通ファイルです。

Repeat・Random・自動連続再生で扱う動画を変えたいときは、このファイルと`scripts/playback-transition-policy.test.mjs`を一緒に確認します。

## 初心者向けの更新手順

1. まず Googleスプレッドシートだけで更新できる内容か確認する
2. 文章や配置なら `index.html` を見る
3. 色や見た目なら `style.css` を見る
4. 検索、絞り込み、再生の動きなら `script.js` を見る
5. 変更後は GitHub Pages の公開ページで表示を確認する

大きな変更をChatGPTやCodexに頼むときは、「どのファイルを変更したいか」を一緒に伝えると失敗しにくくなります。
