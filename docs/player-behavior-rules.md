# Player Behavior Rules

## 1. Purpose

This document summarizes the state management rules for player behavior.

When changing player, random playback, repeat, previous/next, keyboard shortcut, or automatic continuous playback behavior, follow the direction in this document first. This is a developer note for maintainers and Codex, not a user-facing help page.

## 2. Main Target Features

This document covers:

- Fixed player
- YouTube player
- TikTok embed
- Now playing display
- Previous / next
- `Shift + A` / `Shift + D` keyboard shortcuts
- Random playback
- Random queue
- Repeat
- Automatic continuous playback
- Player height adjustment
- Closing and restoring the player

## 3. Main State

### `allVideos`

All loaded video data.

### `currentFilteredVideos`

The current video list after search, tag filtering, and exclusion filtering.

### `nowPlayingKey`

The key identifying the currently playing video entry.

### `randomPlayQueue`

The shuffled queue used for random playback.

### `randomPlayQueueSignature`

The signature used to confirm whether the queue still matches the current target list and random playback options.

### `REPEAT_MODE_KEY`

The localStorage key for the repeat mode.

### `RANDOM_MODE_KEY`

The localStorage key for random mode.

### `LEGACY_RANDOM_AUTO_PLAY_KEY`

Compatibility key for the old random auto-play setting.

## 4. Playback Target List Rules

Normal playback should use `currentFilteredVideos` when available, and fall back to `allVideos` when needed.

The visible list after search, tag filtering, and exclusion filtering is the basis for previous/next and random playback.

Automatic continuous playback must exclude TikTok.

Manual random playback should follow the current behavior and target the currently visible list.

When the random playback target list is empty, random playback should not start and should not call playback with an undefined video.

Even when TikTok is included in the visible list, automatic continuous playback should treat it as skipped / not auto-playable.

## 5. `getVideoKey()` / `nowPlayingKey` Rules

Video entries are identified by combining `videoId` and the start seconds.

Entries with the same `videoId` but different `start` values are treated as separate entries.

The currently playing state is determined by comparing:

```js
nowPlayingKey === getVideoKey(video)
```

If this key format changes, check the impact on:

- Now playing display
- Previous/next movement
- Random queue
- Scroll and highlight behavior

## 6. Previous / Next Rules

Previous / next should move through the current visible list.

- Random OFF next: move to the next video in the visible list.
- Random ON next: use the random queue.
- Random OFF previous: move to the previous video in the visible list.
- Random ON previous: return to the previously played video from playback history when available.
- If random history returns to a video outside the current visible list, keep playback and scroll to the filtered-out notice.
- At the list edge, keep the current looping behavior.

Button handling and keyboard shortcut handling should not diverge. Keyboard shortcuts should call the same button behavior or shared functions.

## 7. Keyboard Shortcut Rules

Current shortcuts:

- `Shift + A`: previous song
- `Shift + D`: next song

Shortcut handling should use the existing previous/next button behavior or the same shared functions.

Do not create separate shortcut-only playback logic.

Shortcuts are disabled when focus is inside:

- `input`
- `textarea`
- `select`
- `contenteditable`

Shortcuts are also disabled when other modifier keys are pressed:

- Ctrl
- Alt
- Meta

Do not try to force support for cases the browser cannot reliably expose, such as focus inside the YouTube iframe.

## 8. Random Playback Rules

Random playback chooses from the current target list.

The random queue is created by shuffling the target list.

When possible, the currently playing video should be excluded from the next queue so the same song is less likely to appear immediately.

When the target list changes, reset `randomPlayQueue`.

Use `randomPlayQueueSignature` to detect target list changes.

When random mode is ON, next playback should take the next video by:

```js
randomPlayQueue.shift()
```

Keep the queue-based behavior so repeats are unlikely until the queue has cycled.

## 9. Repeat Rules

Repeat has three modes:

- `all`: all repeat
- `one`: one repeat
- `off`: repeat off

Display labels:

- `all`: `全曲リピート`
- `one`: `1曲リピート`
- `off`: `リピートOFF`

On video end:

- `off`: do nothing
- `one`: play the same video again
- `all` + random OFF: move to the next video
- `all` + random ON: move to the next video from the auto-playable random queue

TikTok must remain excluded from automatic continuous playback.

## 9.1 `start` / `end` Time Rules

`start` and `end` values in the JSON can use either plain seconds or timestamp text:

- `2894`
- `"2894"`
- `"48:14"`
- `"0:48:14"`
- `"00:48:14"`

These should all be treated as seconds when playback starts or when end-based continuous playback is checked.

`start` defaults to `0` when it is empty or invalid.

`end` is ignored when it is empty, invalid, or less than or equal to `start`.

`end` is used only when repeat mode is `all` and the current video is YouTube. During normal playback, reaching `end` should advance immediately using the same continuous playback direction as video end handling.

When a YouTube video has a valid `end`, repeat mode is `all`, and less than 10 seconds remain, the fixed player can show a countdown near the player window controls. Clicking the countdown advances immediately. Clicking `このまま再生` disables only that video's end-based auto-advance; repeat mode itself remains unchanged, and normal video-end handling still applies.

If playback jumps past `end`, such as by a manual seek, do not advance immediately. Show a 10-second grace countdown, then advance when that countdown reaches `0秒`.

If playback moves back before `end` during the grace countdown, the grace state should reset and return to the normal pre-end countdown rules:

- More than 10 seconds before `end`: hide the countdown.
- Within 10 seconds before `end`: show the normal pre-end countdown.

Changing repeat mode away from `all`, closing the player, or switching videos should reset the grace countdown state.

TikTok is not controlled by `end` and should not show the countdown UI.

## 10. YouTube / TikTok Rules

YouTube uses the YouTube iframe API or YouTube embed.

YouTube can be used for automatic continuous playback.

TikTok embeds are regenerated and `embed.js` is reloaded.

TikTok is not eligible for automatic continuous playback.

TikTok can still be selected and played manually.

When adding another platform, explicitly decide whether it can be used for automatic continuous playback.

## 11. Player Display And Height Rules

The fixed player height is stored in localStorage.

Player height should be clamped between the minimum and maximum allowed values.

Keep the heights of YouTube, TikTok, iframe, and wrapper elements aligned.

While resizing, temporarily disable iframe `pointer-events`.

During touch interaction, prevent accidental page scrolling where needed.

When changing player height behavior, also check fixed-player bottom offsets and scroll-position adjustments.

## 12. Now Playing Display Rules

`nowPlayingWrapper` / `nowPlayingTitle` display the current song label.

The same label should also be set on the `title` attribute.

The Now Playing row should stay one line and keep the fixed player height stable. If the label overflows, it may scroll horizontally after an idle delay; labels that fit should remain static with the usual ellipsis behavior.

If there is a notice for the case where the currently playing video is no longer in the visible list, do not break that behavior.

The currently playing card should receive the `playing` class.

Closing the player should clear the current playing state and remove list highlights.

After clicking a tag inside a video-list card, scrolling should prefer the tapped source card after the list rerenders. If that card is no longer visible, scroll back near the result count or list top instead of jumping to the now playing card.

When there is a now playing state, a `♪` floating button can appear only while the now playing card is outside the viewport or filtered out. It should scroll back to the now playing card, or to the filtered-out notice/result count when the card is not in the visible list.

Now playing behavior can interact with scroll-position adjustment logic, so check those scripts when changing it.

## 13. Relationship With `exclusion-style-sync.js`

`script.js` applies exclusion conditions before rendering the list and updating `currentFilteredVideos`.

`exclusion-style-sync.js` only syncs exclusion styles after tag owners update `FilterState`. It should not handle tag clicks, reset clicks, or wrap `renderVideoList()`.

When changing player behavior, keep `currentFilteredVideos` aligned with the actual visible list.

Random playback, previous/next, and automatic continuous playback should not drift away from the exclusion-filtered visible list.

Also see [Filter Tag Rules](filter-tag-rules.md).

## 14. Checklist For Player Changes

Before merging player-related behavior changes, check:

- Normal click playback works.
- YouTube can play.
- TikTok can render.
- Previous / next move through the visible list.
- `Shift + A` / `Shift + D` behave the same as previous/next.
- Shortcuts do not fire while typing in `input`, `textarea`, `select`, or `contenteditable`.
- Random OFF next is sequential.
- Random ON next follows the random queue.
- The random queue makes immediate repeats unlikely.
- `randomPlayQueue` resets after filter changes.
- Repeat OFF stops after video end.
- One repeat plays the same video again.
- All repeat moves to the next video.
- All repeat + random ON uses random automatic playback.
- TikTok remains excluded from automatic continuous playback.
- Closing/restoring the player still works.
- Player height adjustment still works on desktop and mobile.
- Now playing display and the `playing` class stay in sync.
- Behavior does not contradict [Filter Tag Rules](filter-tag-rules.md).

## 15. Out Of Scope For This Document Branch

This documentation branch should not change:

- Implementation behavior
- UI behavior
- Player behavior
- Keyboard shortcuts
- Random playback behavior
- Repeat behavior
- Tag behavior
- User-facing help pages
