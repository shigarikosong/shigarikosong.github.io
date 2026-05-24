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
- `applyFilters()`
- `renderVideoList()`
- `renderActiveTagChips()`
- Player, random playback, repeat mode, and related playback behavior

### `desktop-filter-panel.js`

- Desktop filter panel UI generation
- Tag button rendering
- Sort button rendering

### `mobile-filter-modal.js`

- Mobile filter modal UI generation
- Tag button rendering
- Result count display inside the modal
- Reset/apply behavior inside the modal

### `tag-exclusion.js`

- `exclude` state management
- `none` / `include` / `exclude` state detection
- Tag click state transition control
- Filtering the rendered list by exclusion conditions
- Exclusion chip rendering
- Wrapping `renderVideoList()` and `renderActiveTagChips()`

### `time-tag-active.js`

- Time tag support behavior
- Time active display and sync support

### `loading-status.js`

- Loading status display
- Fetch guards
- Lazy loading `tag-exclusion.js` and `time-tag-active.js`
- Back-to-top button

## 6. Data Attribute Rules

Tag definitions, display order, platform values, and date labels are centralized in `tag-config.js` as `window.TAG_CONFIG`.

When adding or changing tags, check `tag-config.js` first. Do not duplicate the same order arrays or label maps in individual UI scripts.

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
- Only infer from `knownTags` or container IDs when data attributes are unavailable.

## 7. Labels And Internal Values

Platform values are normalized to lowercase internally:

- `youtube`
- `tiktok`

Time labels and internal values differ:

- `最近` -> `recent`
- `1年以内` -> `year`
- `1年以上前` -> `old`

`3D` and `Shorts` are flags, but they can also appear through the Format UI. Handle them carefully when changing Format or flag behavior.

Collab values combine both columns into the `collab` group:

- `コラボライバー`
- `コラボユニット`

## 8. Random And Continuous Playback

The visible list should reflect the result after both `include` and `exclude` filtering.

- Random playback uses the currently visible list.
- Repeat-all plus random continuous playback uses videos that are visible and auto-playable.
- TikTok is not included in automatic continuous playback.

When changing tag behavior, check consistency between:

- `currentFilteredVideos`
- `lastRenderedVideos`
- `randomPlayQueue`

## 9. Reset Rules

Reset should clear both `include` and `exclude` conditions.

Search text, sort order, and modal field values may also need to be reset depending on the reset button.

When adding another reset button, make sure `tag-exclusion.js` also treats it as an exclusion reset trigger.

## 10. Checklist For Adding Tags

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

## 11. Out Of Scope For This Document Branch

This documentation branch should not change:

- Implementation behavior
- UI behavior
- User-facing help pages
- Filter behavior
- Player behavior

Related document: [Player Behavior Rules](player-behavior-rules.md)
