# Filter Tag Rules

## 1. Purpose

This document summarizes the state management rules for tag filtering.

When changing or adding tag, filter, or exclusion behavior, follow the direction in this document first. This is a developer note for maintainers and Codex, not a user-facing help page.

## 2. Basic Tag State Rules

Tags should generally have three states:

- `none`: not selected
- `include`: include matching videos
- `exclude`: exclude matching videos

The default click cycle is:

```text
none -> include -> exclude -> none
```

`include` and `exclude` must not be active for the same tag at the same time.

- When setting a tag to `include`, clear that tag from `exclude`.
- When setting a tag to `exclude`, clear that tag from `include`.
- When returning a tag to `none`, clear both `include` and `exclude`.

## 3. Tag Groups

The current main tag groups are:

- `category`: Style / category
- `platform`: Platform
- `date`: Time
- `format`: Format / video type
- `role`: Riko Part / role
- `collab`: Collab
- `flag`: 3D / Shorts

## 4. UI Entry Points

The following UI entry points should use the same state transition as much as possible:

- Tags inside the video list
- Desktop filter panel
- Mobile filter modal
- Active tag chips
- Exclusion tag chips

Active tag chips display `include` conditions.

Exclusion tag chips display `exclude` conditions with a leading minus sign, for example `- Shorts`.

Clicking a chip should clear only that condition:

- Clicking an active tag chip clears only that `include` condition.
- Clicking an exclusion tag chip clears only that `exclude` condition.

## 5. Implementation Responsibilities

### `script.js`

- Data loading
- Data normalization
- Base `include` filter state
- Applying exclusion conditions to the visible list before rendering
- Three-state click handling for shared Category / Platform / Time filter tags
- `applyFilters()`
- `renderVideoList()`
- Keeps `renderVideoList()` focused on replacing the list and post-render work; named helpers in the same file build the card, playback button, title/artist actions, metadata, primary tags, and Collab tags.
- Video card metadata rendering, including `waku_name`
- Collab member compact rows and their `+N` / `-` disclosure controls
- `renderActiveTagChips()`
- Builds search and filter chips through named helpers and routes each filter-chip removal through `clearActiveFilterChip()`. Do not add a second delegated click path for a specific chip source.
- Three-state click handling for tags inside the video list
- Player, random playback, repeat mode, and related playback behavior
- Calls `SearchUtils.parseSearchQuery()` once per `applyFilters()` call, then reuses the parsed expression for every video match.
- Build replacement video cards in a `DocumentFragment`, append them together, then run overflow measurement and dispatch `videoListRendered`.
- For title/artist overflow updates, batch DOM resets, layout reads, and style writes instead of alternating them for each card.
- Search input remains synchronous. Ignore a repeated input/change event only when its raw value matches the last query actually applied, including queries set by card actions or reset. Keep change-only input supported; do not add a debounce.
- During `applyFilters()`, reuse cards only when the normalized row objects and their order, card count, and include/exclude state all match the last render. New row objects from data reloads must rebuild cards even when playback keys are unchanged.
- Reuse skips card replacement and title/artist width measurement only. Counts, notices, active chips, list-update notifications, playback-list updates, and the existing post-filter scroll decision still run. `videoListRendered` therefore also notifies consumers when a filter update reuses cards.
- Explicit `renderVideoList()` calls still rebuild by default, including asynchronous Collab order updates. Manual member disclosure invalidates reuse so the next filter update keeps its existing disclosure-reset behavior.

### `search-utils.js`

- Parses space-separated AND terms, explicit `AND`, `OR`, and leading-minus exclusion terms.
- Matches the parsed expression against each video's normalized `_searchText`.
- Keeps search parsing independent from list rendering and DOM state.

### `desktop-filter-panel.js`

- Desktop filter panel UI generation
- Tag button rendering
- Sort button rendering
- Three-state click handling for desktop Format / Riko Part / Collab filter tags

### `mobile-filter-modal.js`

- Mobile filter modal UI generation
- Tag button rendering
- Three-state click handling for mobile Format / Riko Part / Collab filter tags
- Result count display inside the modal
- Reset/apply behavior inside the modal
- Applying modal search/sort values to the main filter state
- The mobile filter modal is immediate-apply; bottom actions are `リセット` and `閉じる`, where `閉じる` is not a cancel action.
- Mobile modal search input is also immediate-apply and should update the modal result count while typing.
- Do not rebuild all modal controls or re-run `applyFilters()` when `閉じる` is pressed if tag/search changes have already been applied.
- Sort changes may remain pending until `閉じる`; pending work should be applied once before the existing close-scroll jump runs.
- A mobile modal handler should not rebuild all mobile tag sections again in response to the state-change event that it dispatched itself.
- Hidden desktop/mobile filter UIs should synchronize when opened instead of rebuilding all controls for every state-change event.

### `filter-tag-view.js`

- Reads each tag's `include` / `exclude` / `none` state from `FilterState` while the tag button is created.
- Supplies the include class, display label, `- ` prefix, exclusion class, and include/exclude `aria-label` through `FilterTagView`.
- Does not intercept tag clicks or reset clicks.
- Does not scan existing buttons after rendering or listen for state-change events.
- Tag owners must call `FilterTagView.getPresentation()` and `applyButton()` in their normal render path.
- Category and Collab sorting must use `data-filter-value`, not the visible label that may contain an exclusion prefix.

### `loading-status.js`

- Loading status display
- Back-to-top button
- Exposes `window.LoadingStatus` for explicit video-list loading, preparing, rendering, and error messages.
- Does not replace `window.fetch` or wrap `populateFilters()`, `renderVideoList()`, or `loadVideo()`.

`script.js` owns the explicit `data/videos.json` and `data/meta.json` fetch flow. It checks HTTP status, JSON array shape, and required video fields before normalizing or rendering the list.

## 6. `FilterState` API

Use `window.FilterState` as the shared entrance for reading and updating filter state.

- `getState()`: returns current search, sort, `include`, and `exclude` state.
- `setState(partialState)`: updates selected parts of the state.
- `resetState(options)`: clears filter state. By default it also resets search and sort.
- `toggleTag(group, value)`: moves one tag through `none -> include -> exclude -> none`.
- `setTagState(group, value, state)`: sets one tag to `include`, `exclude`, or `none`.
- `isTagIncluded(group, value)` / `isTagExcluded(group, value)`: checks one normalized tag state.
- `getExcludedValues(group)` / `hasExclusions()`: reads exclusion state for matching.
- `getActiveChips(options)`: returns include/exclude chip data for rendering.
- `passesExclusion(video)` / `filterExcludedVideos(videos)`: applies exclusion matching to videos.
- `getDisplayLabel(group, value)`: returns UI labels for internal values such as platform/date.
- `normalizeValue(group, value)`: normalizes values such as platform/date before comparing state.

Tag state is private to `filter-state.js`. Read and update it only through these APIs; do not add separate global selected-tag variables.

`setState()` uses the same value normalization and include/exclude conflict rules as individual tag updates:

- Supplied include groups replace those groups; omitted include groups keep their values.
- Including a tag clears any previous exclusion of that tag.
- If `exclude` is supplied, it replaces the entire exclusion state. Explicit exclusions clear matching include values and take priority when the same call supplies both states.
- `3D` and `Shorts` are the same logical tags through `format` and `flag`. Includes are stored in `include.flag`; exclusion checks and clearing work through either group, without duplicate chips.
- Search and sort keep their existing partial-update behavior.

The filter pipeline should keep this order:

1. Read the current state with `FilterState.getState()`.
2. Parse the search query once with `SearchUtils.parseSearchQuery()`.
3. Apply search, include, date, and sort rules with `VideoQuery.filterAndSortVideos()`.
4. Apply exclusions with `FilterState.filterExcludedVideos()`.

`scripts/filter-pipeline.test.mjs` loads these browser scripts together and protects this boundary. Do not restore the removed exclusion adapter or bypass `FilterState` with separate selected-tag globals.

`scripts/app-integration.test.mjs` additionally executes the real `script.js` and filter-panel handlers against the page DOM. It checks that rendered cards, `currentFilteredVideos`, and playback targets stay aligned, and that closing an already-applied mobile filter does not render the list again.

### Shared Filter URLs

- Place the share-link icon immediately beside the result count in the desktop toolbar and the mobile main list, not inside the filter panels or individual cards. Keep count and icon on one line. Hide the icon when search is blank, include/exclude are empty, and sort is the default `desc`; zero results may still be shared.
- Copy the current search text, include/exclude tags (including relative Time), and sort order. Share conditions, not a frozen list of video IDs: later data/tag changes and the date of opening can change results. Do not include playback, random/repeat, volume, scroll, manual-play or number-inspection state.
- `filter-share-url.js` owns the versioned fragment format: `#filters=1&q=...&sort=asc&in.collab=...&out.flag=Shorts`. Tag groups are `category`, `platform`, `date`, `format`, `role`, `collab`, and `flag`; repeat multi-value keys. Encode with `URLSearchParams`, omit defaults, deduplicate/sort tag values, and preserve meaningful search text. Shared URLs retain the current origin/path but discard query parameters and unrelated fragments, so Preview links remain on Preview.
- `filter-share.js` owns share controls, copy feedback/fallback, and URL restoration. `script.js` calls initial restoration after data/options are ready and before the first filter application; later data refreshes preserve the user's current conditions. Subsequent `hashchange` events replace all filter conditions through `FilterState.setState()`, not a partial merge, then use the existing `applyFilters()` path. Existing include/exclude conflict handling remains authoritative.
- An empty fragment reached from a shared fragment resets conditions. Unrelated anchors are ignored. Unsupported versions/keys, invalid encoding, repeated scalar keys, invalid fixed values, and fragments longer than 16,000 characters reject the whole payload, show a notice, and display the default list. Do not silently truncate or partially apply a broken link. Data-defined tags that no longer exist remain explicit chip conditions, potentially producing zero results.
- Opening a shared link does not initiate playback. Changing the fragment in an already-open page leaves current playback running; pending mobile applies are cancelled and open controls synchronize to the new conditions. Counts, chips, displayed cards and playback candidates must agree after restoration.
- Copying does not call `applyFilters()`, change the address/history, or interrupt playback. Ordinary filter edits/reset also do not rewrite the address; reloading a received URL restores its original shared conditions. Do not change the canonical URL, page title, description, or sitemap based on shared conditions.
- Announce clipboard success only after it resolves. If copying is unavailable/denied, open a native dialog with a selected read-only URL for manual copying, contain Tab, and restore focus/scroll locking on close, Escape, native close or backdrop click. Suppress stale completions after condition changes, a newer copy, or another open dialog. Oversized conditions report failure instead of copying a truncated URL.
- Regression coverage: `scripts/filter-share-url.test.mjs` for codec boundaries and `scripts/filter-share.test.mjs` for restoration, state preservation, counts, copy outcomes and modal synchronization. Browser/Preview checks cover one-line layouts, touch targets, native clipboard, keyboard navigation and back/forward navigation.

## 7. Data Attribute Rules

Tag definitions, display order, platform values, and date labels are centralized in `tag-config.js` as `window.TAG_CONFIG`.

When adding or changing tags, check `tag-config.js` first. Do not duplicate the same order arrays or label maps in individual UI scripts.

For `roleOrder`, `tag-config.js` is the source of truth for the desktop and mobile filter panel display order.

When adding or changing tag buttons, add these attributes whenever possible:

- `data-filter-group`
- `data-filter-value`

Example:

```html
<button data-filter-group="format" data-filter-value="Shorts">Shorts</button>
```

Do not determine tag type or state from visual classes alone.

- Do not depend on classes such as `text-white`.
- Prefer `data-filter-group` and `data-filter-value`.
- Add data attributes to new tag buttons instead of inferring from labels or container IDs.

## 8. Labels And Internal Values

Platform values are normalized to lowercase internally:

- `youtube`
- `tiktok`

Spreadsheet / JSON platform display values should use official labels: `YouTube` and `TikTok`.

Platform UI labels are centralized in `tag-config.js`; UI should display `YouTube` / `TikTok` while keeping `FilterState` values and `data-filter-value` lowercase.

Time labels and internal values differ:

- `最近` -> `recent`
- `1年以内` -> `year`
- `1年以上前` -> `old`

Date labels are defined in `tag-config.js`. Date parsing and Time filter matching are centralized in `date-utils.js`; check that file first when changing date conditions.

`3D` and `Shorts` are flags, but they can also appear through the Format UI. Handle them carefully when changing Format or flag behavior.

Riko Part / role include conditions can contain multiple values. When multiple Riko Part tags are included, they are matched as OR within the role group. Other tag groups still combine with role as AND.

Example:

```text
Format: 歌枠
Riko Part: VOCAL
Riko Part: DANCE

=> 歌枠 AND (VOCAL OR DANCE)
```

Riko Part exclude conditions remain independent per tag. If any excluded Riko Part tag is present on a video, that video should be excluded.

Collab values combine both columns into the `collab` group:

- `コラボライバー`
- `コラボユニット`

Collab include conditions can contain multiple values. When multiple Collab tags are included, they are matched as OR within the Collab group. Other tag groups still combine with Collab as AND.

Example:

```text
Format: 歌枠
Collab: 倉持めると
Collab: 石神のぞみ

=> 歌枠 AND (倉持めると OR 石神のぞみ)
```

Collab exclude conditions remain independent per tag. If any excluded Collab tag is present on a video, that video should be excluded.

Video list Collab tags should prefer the same collab tag definition order as the filter UI. Tags missing from the definition should stay after known tags while preserving their local order as much as possible.

Video cards compact Collab member tags as follows:

- When a Collab unit exists, keep the unit visible and compact all individual members behind `+N` regardless of member count.
- Without a Collab unit, show all individual members for one to four members and compact all members behind `+N` for five or more members.
- Expanded member rows show every member and use `-` as the collapse control. Do not partially show the first few members.
- Build the compact member row directly inside `script.js` while creating each video card. Do not wrap `renderVideoList()` from `ui-polish.js` or another helper script.

Tag colors use a shared visual hierarchy instead of group-specific colors:

- Unselected tags use neutral gray styling regardless of group.
- Included tags use the site blue as the active state.
- Excluded tags keep the red exclusion styling and minus label.
- Hover and keyboard focus may use a light blue accent, but must not replace the include/exclude state indication.
- Collab member `+N` / `-` controls are secondary disclosure controls, not tags. Keep them transparent with a light gray outline and muted text so they never appear more prominent than ordinary tags.

### Number Inspection

- Normal browsing does not show row numbers, copy controls, or inspection settings. This is a convenience display mode, not authentication; `number` is already in the public JSON.
- Open the site-info dialog and activate its heading button five times consecutively to enable inspection. Clicking, tapping, and keyboard activation use the same handler. A gap of more than two seconds or closing/reopening the dialog resets the count.
- Only while enabled, the dialog shows `番号表示中` and `番号表示を終了`. Exiting hides those controls and returns focus to the heading when needed. The mode exists only in memory and starts disabled on a new page load; do not persist it or change the URL.
- Display the normalized `_number` from each JSON row beside its card metadata, with a copy icon and an accessible name. Keep leading zeroes; never substitute a list index, video ID, or spreadsheet row position. Omit the control when no number is present.
- `script.js` owns `NumberInspection` and the shared metadata-control helper. Card creation and mode changes call that helper. Switching modes adds/removes only these controls in existing cards, preserving search, sort, filters, current playback, random queue, focus, and Collab disclosure state. Preserve the visible card's position when the metadata height changes.
- New cards created by filtering, sorting, or data reloads use the current mode. Reusing unchanged cards must neither remove nor duplicate their number controls. Do not wrap `renderVideoList()` or route inspection through `applyFilters()`.
- Copy only the number on an explicit button activation. Show success only after the Clipboard API resolves. If it is unavailable or denied, report failure and select the number for manual copying. Ignore stale completion feedback after mode exit, card removal, or a newer copy request.
- `scripts/number-inspection.test.mjs` covers activation, data identity, state preservation, clipboard outcomes, and exit/reset behavior. Clipboard permission and actual touch/keyboard layout require browser/Preview verification.

## 9. Random And Continuous Playback

The visible list should reflect the result after both `include` and `exclude` filtering.

- Random playback uses the currently visible list.
- Repeat-all plus random continuous playback uses videos that are visible and auto-playable.
- TikTok is not included in automatic continuous playback.

When changing tag behavior, check consistency between:

- `currentFilteredVideos`
- `randomPlayQueue`

## 10. Reset Rules

Reset should clear both `include` and `exclude` conditions.

Search text, sort order, and modal field values may also need to be reset depending on the reset button.

When adding another reset button, make sure it calls `FilterState.resetState()` or otherwise clears both `include` and `exclude` conditions.

## 11. Filter Close Scroll Rules

Desktop filter panel and mobile filter modal tag changes are immediate-apply.

While the user is still choosing tags inside the desktop panel or mobile modal, the page should not scroll just because the list rerendered.

For ordinary filter updates outside the open desktop panel / mobile modal, `applyFilters()` owns the post-filter scroll decision after `renderVideoList()`, `renderActiveTagChips()`, and active-chip positioning have settled. `renderVideoList()` should render list DOM only and should not directly scroll.

When the user explicitly closes the filter UI:

- If the now playing card is still in the visible list, jump to that card.
- If there is no now playing card, or it is no longer in the visible list, jump near the visible result count or the top of the video list.
- This close action should use an immediate jump, not smooth scrolling, because it happens after layout changes and scroll locking/unlocking.

Related code:

- `desktop-filter-panel.js`
- `mobile-filter-modal.js`
- `script.js` (`applyFilters()` / `requestSettledFilterScroll()`)
- `scroll-utils.js` (`scrollPlayingCardIntoComfortView()` / `requestFilterCloseTargetJump()`)
- `filter-scroll-position.js` (compatibility wrapper; no list `MutationObserver`)

### Keyboard Focus And Accessible State

- Preserve focus on the same tag or sort button after replacing its DOM, so keyboard users can repeat the three-state cycle without finding the tag again.
- Each renderer explicitly captures/restores focus through `FocusUtils`; do not wrap render functions or add a second rendering path. `data-focus-key` identifies a control, and card `data-focus-scope` uses the playback key to prevent moving focus to a different video.
- List actions keep focus in the same card when it survives filtering. If the card disappears, focus the video-list region. When a chip is removed, focus a remaining chip or, if none remain, the video list.
- Restoring focus uses `preventScroll`; existing filter-scroll logic still owns page scrolling.
- Included tags expose `選択中` and excluded tags expose `除外中` in their accessible names. These are three-state commands, not a binary `aria-pressed` toggle. Sort buttons have stable names and expose the single active option with `aria-pressed`.
- Chip accessible names describe removing their include or exclude condition.
- The mobile filter is a native modal `dialog` opened with `showModal()`. Focus starts on its panel, Tab/Shift+Tab cycle inside it, and the browser makes background content inert. Supply a dialog name and keep an explicit close button.
- Escape and the close button share the same close path: keep applied conditions, apply any pending sort/reset once, release the scroll lock, restore focus to the opener, and request the existing close-scroll jump. If the viewport changed to desktop, use its filter toggle as the focus fallback.
- Do not request a delayed close-scroll jump while another dialog is open or the filter has reopened.
- Desktop filters remain non-modal. Escape inside the panel closes it and focuses the toggle.
- `scripts/accessibility.test.mjs` covers focus restoration, tag/sort semantics, modal lifecycle, pending changes, and background playback-shortcut suppression. Native browser modality and actual Tab traversal require browser/Preview verification.

## 12. Checklist For Adding Tags

Before merging a new or changed tag behavior, check:

- `data-filter-group` and `data-filter-value` are set.
- The tag can enter `include`.
- The tag can enter `exclude`.
- The tag can return to `none`.
- `include` and `exclude` cannot be active at the same time.
- The tag appears in active chips when included.
- The tag appears in exclusion chips when excluded.
- The tag clears on reset.
- It works in the desktop filter panel.
- It works in the mobile filter modal.
- It works as a tag inside the video list.
- It works when combined with search text.
- Random playback still targets the correct visible list.

## 13. Out Of Scope For This Document Branch

This documentation branch should not change:

- Implementation behavior
- UI behavior
- User-facing help pages
- Filter behavior
- Player behavior

Related document: [Player Behavior Rules](player-behavior-rules.md)
