# 動画収録状況の自動確認

司賀りこWikiに掲載された動画と`data/videos.json`を週1回照合し、結果をGitHub Issueへ記録します。

## 実行タイミング

- 毎週日曜日 10:23（日本時間）
- GitHub Actionsの`Check content coverage`から手動実行可能

定期実行は`main`へWorkflowがマージされた後に有効になります。

## 通知方法

初回実行時に、`動画収録確認（自動監視）`というIssueを1件作成します。以後は、候補の有無にかかわらず同じIssueへ実行結果をコメントします。

GitHub通知を受け取る場合は、作成された監視IssueをSubscribeします。

以下の場合もIssueへ明示します。

- 新しい候補がない
- 以前に報告された候補が未登録のまま残っている
- Wikiの取得に失敗した
- WikiのHTML構造が変わり、想定件数を取得できなかった

## 確認する情報

### 収録対象一覧との照合

毎回、次の現在内容を`data/videos.json`と比較します。

- 司賀りこWiki「歌動画」
- にじさんじWiki「歌唱まとめ」の司賀りこ欄

Wikiにあり、サイト未登録かつ対象外指定もない動画を候補にします。過去動画が後からWikiへ追加された場合も検出できます。

### 投稿動画欄の新規追加

司賀りこWiki「投稿動画」は、歌・ダンス以外の動画も多いため、初回確認時点の動画IDを基準として保存しています。

初回確認後に投稿動画欄へ現れた新しい動画IDだけを候補にします。タイトルだけでは内容を自動判断せず、候補を見て収録対象かどうかを人が判断します。

## 候補を確認した後

### サイトへ追加する場合

従来どおりスプレッドシートへ追加し、`data/videos.json`を更新します。次回の照合では登録済みとして候補から消えます。

### 収録対象外の場合

監視Issueへ、候補に表示されたコマンドをコメントします。理由は省略できますが、後から判断を確認できるよう末尾へ残すことを推奨します。

```text
/ignore youtube:VIDEO_ID 収録対象外とした理由
```

TikTokは次の形式です。

```text
/ignore tiktok:POST_ID 投稿が非公開
```

対象外指定を取り消す場合は、同じIDを`/unignore`でコメントします。

```text
/unignore youtube:VIDEO_ID
```

コマンドは上から順に処理されるため、後から書いた`/unignore`でIssueコメント由来の指定を解除できます。第三者のコメントで候補が消えないよう、Owner・Member・Collaboratorのコメントだけを判断に使用します。

既存の判断記録やコード上で固定したい例外は、引き続き`data/content-coverage-rules.json`の`ignored`でも管理できます。

例：

```json
{
  "key": "youtube:VIDEO_ID",
  "reason": "収録対象外とした理由"
}
```

TikTokの例：

```json
{
  "key": "tiktok:POST_ID",
  "reason": "投稿が非公開"
}
```

`data/content-coverage-rules.json`にある対象外指定は`/unignore`では解除されません。必要な場合はJSON側を変更してください。

`editedVideosBaseline.ids`は初回確認時点を表すため、通常の運用では追加・更新しません。新しい候補を単にbaselineへ足すと、判断記録が分からなくなるため、登録または対象外指定のどちらかで扱います。

## ローカル実行

ネットワークへ接続できる環境で次を実行します。

```sh
pnpm run audit:content
```

監査スクリプトはサイトデータを変更しません。確認結果を標準出力へ表示するだけです。

このローカルコマンドはGitHub Issueへ接続しないため、Issueコメント由来の対象外指定は読み込みません。定期Workflowでは、信頼できるコメント本文を`--decisions-file`で監査スクリプトへ渡します。

## 安全策

- Wiki取得はタイムアウト付きで最大3回試行する
- 対象セクションが見つからない場合は失敗する
- 抽出件数が想定最低数を下回る場合は失敗する
- 失敗を「候補なし」として扱わない
- 候補をスプレッドシートやJSONへ自動追加しない
- Issueの対象外コマンドは、リポジトリ管理に関われる利用者のコメントだけを受け付ける
- Workflowは標準Linux runnerを使い、実行上限を5分とする
- artifactやcacheは保存しない

## 関連ファイル

- `.github/workflows/content-coverage-monitor.yml`
- `scripts/content-coverage-audit.mjs`
- `scripts/content-coverage-audit.test.mjs`
- `data/content-coverage-rules.json`
