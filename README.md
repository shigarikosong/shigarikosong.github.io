## サイトの使い方

このサイトは、司賀りこさんの歌ってみた・踊ってみた・歌枠などを探しやすくまとめた非公式ファンアーカイブです。

開発者向けメモ: [フィルタータグ仕様](docs/filter-tag-rules.md) / [プレイヤー挙動仕様](docs/player-behavior-rules.md) / [手動チェックリスト](docs/manual-checklist.md) / [動画収録状況の自動確認](docs/content-coverage-monitor.md)

タグ定義・表示順は `tag-config.js` を正本とします。

### 検索する

画面上部の検索欄から、曲名・アーティスト名・タグ・コラボ名などで検索できます。

検索欄では、スペース区切りのAND検索、`OR`、`-除外語` も使えます。

### タグで絞り込む

「絞り込み」から、以下の条件で表示する動画を絞り込めます。

- Sort：新しい順、古い順、タイトル順、アーティスト順
- Style：ソロ、コラボ、あやかき
- Platform：YouTube、TikTok
- Time：最近、1年以内、1年以上前
- Format：3D、Shorts、歌枠、ライブ、イラストなど
- Riko Part：VOCAL、DANCE、CHORUS、MOVIEなど
- Collab：コラボライバー、コラボユニット

タグは複数組み合わせて使えます。  
選択中の条件に合う動画数は、検索欄付近に表示されます。

### 動画を再生する

リスト内カード左側の再生ボタンを押すと、画面下部に再生プレイヤーが表示されます。曲名やアーティスト名を押すと、その文字列で一覧を検索できます。

再生中は以下の操作ができます。

- シャッフル：現在の絞り込み結果をランダムな順番で再生
- 前へ：前の動画を再生
- 再生／一時停止：YouTube動画の再生状態を切り替え
- 次へ：次の動画を再生
- リピート：OFF、全体リピート、1曲リピートを切り替え
- 小さくする：再生を続けたままプレイヤーを収納
- 開く：収納したプレイヤーを再表示
- 閉じる：再生を止めてプレイヤーを閉じる

TikTok動画の再生・一時停止は、埋め込み動画内で操作します。

### 注意事項

TikTokの埋め込みは、YouTubeに比べて音量や表示サイズの挙動が異なる場合があります。

## Tailwind CSSの更新

公開ページは、リポジトリ内の`tailwind.generated.css`をそのまま読み込みます。Tailwindのクラスを`index.html`またはJavaScript内で追加・変更した場合は、次のコマンドでCSSを再生成してください。

```sh
pnpm install
pnpm run build:css
```

生成後は`tailwind.generated.css`も変更と一緒にコミットします。GitHub PagesやCloudflare PagesでTailwindのビルドを実行する必要はありません。

## 動画JSONの検査

`data/videos.json`と`data/meta.json`は、次のコマンドで検査できます。

```sh
pnpm run validate:data
```

固定IDの重複、`full_number`の参照切れ、必須項目、動画ID、時刻範囲、日付、`player_aspect`などを確認します。JSON自動更新Workflowでも、取得データをリポジトリへ反映する前に同じ検査を実行します。

## 動画収録状況の自動確認

司賀りこWikiと`data/videos.json`を週1回照合し、候補の有無にかかわらずGitHubの監視Issueへ結果を記録します。

ローカルでは次のコマンドで同じ照合を実行できます。

```sh
pnpm run audit:content
```

対象外動画や初回確認時点の基準は`data/content-coverage-rules.json`で管理します。詳しい運用は[動画収録状況の自動確認](docs/content-coverage-monitor.md)を確認してください。

## 自動テスト

動画データ検査、動画正規化、検索から除外までのフィルターパイプライン、タグ表示、再生・遷移方針、プレイヤーサイズ、検索演算子、スクロール補正の回帰テストは、まとめて次のコマンドで実行できます。

```sh
pnpm test
```

動画正規化・フィルターパイプライン・タグ表示・再生・遷移方針・プレイヤーサイズ・検索・スクロールの回帰テストだけを実行する場合は、`pnpm run test:regressions`を使用します。
