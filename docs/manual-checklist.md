# Manual Checklist

PR前やPreview Deployment確認時に使う手動チェックリストです。

変更範囲に関係する項目を中心に確認してください。タグ・フィルター・再生まわりを触った場合は、該当セクションをなるべく一通り確認します。

## 1. Basic Display

- [ ] 初期表示で動画一覧が読み込まれる。
- [ ] 初期表示で全件表示になっている。
- [ ] 件数表示が `全 n 件中 m 件表示` の形で崩れていない。
- [ ] ブラウザのコンソールに新しいエラーが出ていない。
- [ ] PC幅で大きなレイアウト崩れがない。
- [ ] スマホ幅で大きなレイアウト崩れがない。

## 2. Search And Sort

- [ ] 曲名またはアーティスト名で検索できる。
- [ ] スペース区切りのAND検索が動く。
- [ ] `OR` 検索が動く。
- [ ] `-除外語` 検索が動く。
- [ ] 新しい順、古い順、タイトル順、アーティスト順が切り替わる。
- [ ] 検索や並び替え後に件数表示が更新される。
- [ ] リセット後、検索語と並び順が初期状態に戻る。

## 3. Tag Filters

- [ ] Style / category タグで絞り込みできる。
- [ ] Platform タグで絞り込みできる。
- [ ] Time タグで絞り込みできる。
- [ ] Time タグの選択状態とアクティブタグチップが一致する。
- [ ] Format タグで絞り込みできる。
- [ ] `3D` と `Shorts` がFormat UI上で従来通り動く。
- [ ] Riko Part / role タグで絞り込みできる。
- [ ] Collab タグで絞り込みできる。
- [ ] 複数タグの組み合わせで絞り込みできる。
- [ ] タグと検索語を組み合わせても絞り込みできる。
- [ ] タグ解除後に件数と一覧が戻る。

## 4. Include / Exclude Tags

- [ ] 対象タグが `none -> include -> exclude -> none` の順で切り替わる。
- [ ] `include` と `exclude` が同じタグで同時に有効にならない。
- [ ] `include` 条件がアクティブタグチップに表示される。
- [ ] `exclude` 条件が `- Shorts` のような除外チップで表示される。
- [ ] アクティブタグチップを押すと、その `include` 条件だけ解除される。
- [ ] 除外チップを押すと、その `exclude` 条件だけ解除される。
- [ ] リセットで `include` と `exclude` の両方が解除される。
- [ ] 除外条件の追加・解除後、PC/モバイル/リスト内タグの赤い除外表示が一致する。
- [ ] 除外表示は `exclusion-style-sync.js` が同期し、タグクリック自体は各UIの担当ファイルで処理されている。

## 5. Desktop Filter Panel

- [ ] PC幅で「絞り込み」パネルを開閉できる。
- [ ] PC幅で件数表示が更新される。
- [ ] PCフィルター内のSortが動く。
- [ ] PCフィルター内の各タグが動く。
- [ ] PCフィルター内のタグ状態がアクティブチップと一致する。
- [ ] PCフィルターの「閉じる」後、再生中カードが表示リスト内にあればそこへ、なければ結果件数または動画一覧の先頭付近へ移動する。
- [ ] PC表示で不自然なスクロールジャンプが増えていない。

## 6. Mobile Filter Modal

- [ ] スマホ幅でフィルターモーダルを開閉できる。
- [ ] モーダル内検索が即時反映され、モーダル内件数も更新される。
- [ ] モーダル内Sortが動く。
- [ ] モーダル内の各タグが選択・解除できる。
- [ ] モーダル内リセットで条件が解除される。
- [ ] モーダルの「閉じる」は現在の条件を維持する。
- [ ] モーダルの「閉じる」後、再生中カードが表示リスト内にあればそこへ、なければ結果件数または動画一覧の先頭付近へ移動する。
- [ ] ページ下部でモーダルを開いて件数が減るタグを選び、閉じても下部に取り残されない。

## 7. Video List Tag Clicks

- [ ] リスト内カードのStyle / Platform / Format / Role / Collabタグを押すと絞り込みできる。
- [ ] リスト内タグに `data-filter-group` と `data-filter-value` が付いている。
- [ ] リスト内タグクリック後、元カードが残る場合はそのカード付近へ戻る。
- [ ] 元カードが非表示になる場合は、noticeまたはリスト上部へ移動する。
- [ ] リスト内タグの選択状態がPC/モバイルフィルターと矛盾しない。

## 8. Playback

- [ ] 曲名クリックで再生できる。
- [ ] YouTube動画が再生できる。
- [ ] YouTube の開始秒 `start` が反映される。
- [ ] TikTok埋め込みが表示される。
- [ ] 再生中カードに `playing` 表示が付く。
- [ ] 絞り込み後も再生中カードが表示対象に残る場合、再生中カードへ移動できる。
- [ ] 再生中カードが非表示になる場合、filtered-out noticeが表示される。
- [ ] プレイヤーを閉じると再生中表示が解除される。
- [ ] プレイヤーの開閉・収納・高さ変更が壊れていない。

## 9. Random / Previous / Next / Repeat

- [ ] ランダム再生できる。
- [ ] 絞り込み後のランダム再生対象が現在の表示リストになっている。
- [ ] 除外条件適用後のランダム再生対象が現在の表示リストになっている。
- [ ] 除外条件適用後、Next / Previous とランダム再生が非表示カードを選ばない。
- [ ] Next / Previous が現在の表示リストに沿って動く。
- [ ] Random ON のPreviousは直前に再生していた曲へ戻る。
- [ ] Random OFF のNextは順番通りに動く。
- [ ] Random ON のNextはランダムキューに沿って動く。
- [ ] Repeat OFF / 1曲リピート / 全曲リピートの表示と動作が大きく崩れていない。
- [ ] 全曲リピート + Random ON でTikTokが自動連続再生対象から外れる。

## 10. Keyboard And Scroll

- [ ] `Shift + A` で前の曲へ移動する。
- [ ] `Shift + D` で次の曲へ移動する。
- [ ] 入力欄、textarea、select、contenteditableにフォーカス中はショートカットが発火しない。
- [ ] 再生中カードへ戻る `♪` ボタンが必要な時だけ表示される。
- [ ] 固定プレイヤーやstickyフィルターに、移動先のカードやnoticeが隠れない。

## 11. Data And Tag Definition Changes

- [ ] タグ定義や表示順を変えた場合、`tag-config.js` が正本になっている。
- [ ] 新しいタグボタンに `data-filter-group` と `data-filter-value` が付いている。
- [ ] Platform内部値は lowercase の `youtube` / `tiktok` のままになっている。
- [ ] Time内部値は `recent` / `year` / `old` のままになっている。
- [ ] スプレッドシート列名を変えていない、または参照コードも合わせて更新している。

## 12. Script Loading And Helper Boundaries

- [ ] `index.html` の読み込み順で `tag-config.js` / `date-utils.js` / `filter-state.js` が、依存するスクリプトより前にある。
- [ ] タグ系補助スクリプトは `index.html` で明示読み込みされ、`loading-status.js` から後追い読み込みされていない。
- [ ] `exclusion-style-sync.js` が `renderVideoList()` を上書きしていない。
- [ ] `exclusion-style-sync.js` がタグクリックを処理していない。
- [ ] `exclusion-style-sync.js` がリセットクリックを処理していない。
- [ ] 旧 `tag-exclusion.js` への読み込み・参照が残っていない。
- [ ] `time-tag-active.js` など削除済み補助スクリプトへの参照が残っていない。

## 13. Pre-Merge Diff Check

- [ ] `git status` で意図したファイルだけが変更されている。
- [ ] `.DS_Store` が差分に含まれていない。
- [ ] `git diff` に見た目変更や大規模差分が混ざっていない。
- [ ] 挙動変更とリファクタリングが不要に混ざっていない。
- [ ] 変更範囲に応じて `README.md`、`DEVELOPMENT_NOTES.md`、`docs/filter-tag-rules.md`、`docs/player-behavior-rules.md` の更新要否を確認した。

## 14. Preview Deployment

- [ ] Cloudflare Pages のPreview Deploymentで確認した。
- [ ] Preview URLで動画一覧が読み込まれる。
- [ ] Preview URLで検索・タグ・再生の主要導線が動く。
- [ ] 本番URLで確認すべき差分がある場合、マージ後の確認項目をPRにメモした。
