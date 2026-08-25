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
- Video card metadata rendering, including `waku_name`
- Collab member compact rows and their `+N` / `-` disclosure controls
- `renderActiveTagChips()`
- Three-state click handling for tags inside the video list
- Player, random playback, repeat mode, and related playback behavior
- Calls `SearchUtils.parseSearchQuery()` once per `applyFilters()` call, then reuses the parsed expression for every video match.
- Build replacement video cards in a `DocumentFragment`, append them together, then run overflow measurement and dispatch `videoListRendered`.
- For title/artist overflow updates, batch DOM resets, layout reads, and style writes instead of alternating them for each card.

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
- Supplies the include class, display label, `- ` prefix, exclusion class, and exclusion `aria-label` through `FilterTagView`.
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

Prefer these APIs over reading or updating legacy globals directly, unless the surrounding code has not migrated yet.

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

Platform UI labels are centralized in `tag-config.js`; UI should display `YouTube` / `TikTok` while keeping filter values, `data-filter-value`, and `selectedPlatformTag` lowercase.

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
