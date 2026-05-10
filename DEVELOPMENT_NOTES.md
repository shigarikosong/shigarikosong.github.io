# 開発メモ

## 重要ルール

- フィルター状態は `filterState` のみを正とする
- DOMのclass名やtextContentから状態を推測しない
- タグボタンには必ず `data-filter-group` と `data-filter-value` を付ける
- 絞り込み判定は `videoMatchesFilters(video, filterState)` に集約する
- PC/モバイル/カード上タグは同じ状態を描画するだけ
- `applyFilters()` を別ファイルから上書きしない
- `renderVideoList()` を別ファイルから上書きしない
- 新機能はまず小さい関数に分け、既存挙動を変えないPRにする
