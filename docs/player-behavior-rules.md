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
- Play / pause control
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

## 5.1 Play / Pause Control Rules

The fixed player play / pause button controls YouTube through the YouTube IFrame Player API and TikTok through the official Embed Player messaging API.

- Keep a separate playback-intent flag for whether YouTube playback has been requested.
- `PLAYING` sets the playback intent and shows the pause icon and label.
- `PAUSED`, `ENDED`, and `CUED` clear the playback intent and show the play icon and label.
- `BUFFERING` and `UNSTARTED` preserve the current playback intent and do not change the icon by themselves.
- YouTube `onStateChange` is the source of truth, including changes made inside the embedded YouTube player.
- The control remains available while the player window is collapsed.
- Closing the player resets the control to its unavailable play state.
- TikTok keeps its own playback-intent flag. `onPlayerReady` confirms full readiness, while `onStateChange` keeps the icon synchronized with operations performed inside the embedded player.
- TikTok does not auto-play. The first playback must be started inside the embedded TikTok player because some browsers reject a host-page play command before that interaction.
- Before the first real TikTok playback state is observed, keep the fixed-player play button disabled and translucent without showing an additional notice.
- After TikTok reports `BUFFERING` or `PLAYING`, enable normal play / pause control from the fixed player. Keep it available for subsequent pauses, resumes, and playback completion.
- Recognize TikTok player events by the official `x-tiktok-player` message marker. Internal player frames may relay events without using the outer iframe window as `event.source`.
- TikTok `PLAYING` shows pause, `PAUSED` / `ENDED` show play, and `BUFFERING` / `INIT` preserve the current playback intent.
- Do not optimistically change the TikTok icon after posting a command. Only a real `onStateChange` updates the control.
- TikTok remains excluded from automatic continuous playback; fixed-player play / pause support does not change that rule.
- Manual play test mode still cues the selected YouTube video. The fixed player control may start it, while the native YouTube play button remains available for the intended manual-play check.

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

YouTube should autoplay for normal list title selection, previous / next, and manual random playback regardless of repeat mode.

For embed behavior testing, `manualPlayTestMode` can be enabled through `?manualPlay=1`, the info modal toggle, or the hidden `Ctrl + Alt/Option + Shift + M` shortcut. In that mode, manual YouTube selection should cue the selected video without starting playback automatically. The user should start playback with the native YouTube player button. Automatic continuous playback should keep autoplay behavior.

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

If the first time sample for a newly loaded row is already past `end`, also use the grace countdown. The YouTube API can briefly expose the previous video's time during a load transition, so an unconfirmed first sample must never skip the new row immediately.

If playback moves back before `end` during the grace countdown, the grace state should reset and return to the normal pre-end countdown rules:

- More than 10 seconds before `end`: hide the countdown.
- Within 10 seconds before `end`: show the normal pre-end countdown.

Changing repeat mode away from `all`, closing the player, or switching videos should reset the grace countdown state.

TikTok is not controlled by `end` and should not show the countdown UI.

## 10. Full-Version Prompt

Any row can link to an existing full-version row through `full_number`.

Treat `full_number` as the explicit flag for showing the prompt. Only put `full_number` on rows where the full-version prompt should be available.

Normalize spreadsheet / JSON `number` and `full_number` as trimmed strings, exposed internally as `_number` and `_fullNumber`.

`full_button_text` can override the prompt button label on the source row. Normalize it as trimmed text and expose it internally as `_fullButtonText`. If it is empty, use `Full ver. を再生`.

A video is eligible only when:

- `_fullNumber` is not empty.
- `allVideos` contains a row whose `_number` matches `_fullNumber`.

When the prompt is clicked, play the matched existing row with `loadVideo(targetVideo, null)`. Use that row's own `videoId`, `start`, `end`, title, artist, and platform data. Do not add the full-version row to the visible list or clear filters automatically.

For YouTube, show the prompt when 10 seconds remain. Prefer the current video's `_endSeconds` when it exists; otherwise use the YouTube duration when available. If duration cannot be read, do not show the prompt.

For TikTok, show the prompt immediately for eligible videos because reliable current-time / duration monitoring is not available.

The full-version prompt is separate from the end-countdown auto-advance UI. If the end-countdown UI is visible, hide the full-version prompt.

After playing the full version, reuse the existing now-playing scroll behavior: scroll to the playing card when it is visible in the filtered list, otherwise scroll to the filtered-out notice / result area.

## 11. YouTube / TikTok Rules

YouTube uses the YouTube iframe API or YouTube embed.

Treat the YouTube player's `onReady` event, not merely creation of the `YT.Player` object, as the point when playback commands are safe. If a user selects a YouTube video before `onReady`, keep only the latest request and execute it once after readiness. Cancel that pending request when another platform is selected or the fixed player is closed.

YouTube can be used for automatic continuous playback.

TikTok uses the official Embed Player iframe at `https://www.tiktok.com/player/v1/{POST_ID}`.

TikTok is not eligible for automatic continuous playback.

TikTok can still be selected and played manually.

When adding another platform, explicitly decide whether it can be used for automatic continuous playback.

## 12. Player Stage And Size Rules

`playerStageDock` owns the current horizontal placement. `playerStage` owns the actual player width, while `playerFrameWrapper` owns the matching video height. Keep sizing separate from placement so position changes do not need to rewrite aspect-ratio logic.

When no horizontal position has been saved, place the player at the rightmost allowed position. Continue to prefer the normalized position stored in `playerHorizontalPosition` for returning users, and do not overwrite it merely because the default changes.

When switching between landscape and vertical videos, apply the new stage dimensions before loading the next embed, then reapply them after layout settles. This prevents the previous video's aspect ratio from remaining visible during the transition.

The preferred player height is stored in localStorage. Switching between landscape and vertical media must not overwrite that preference merely because the current viewport clamps the rendered size.

Regular YouTube videos use 16:9. YouTube Shorts and TikTok use 9:16 when the viewport can accommodate it. A YouTube row may explicitly override the automatic Shorts-based choice with `player_aspect` set to `9:16` or `16:9`; blank and unsupported values fall back to the automatic rule. TikTok remains vertical.

Regular 16:9 YouTube players may be reduced to about 356 x 200 pixels. Keep the 16:9 ratio and the 200px minimum viewport dimension rather than forcing a smaller square frame.

On both desktop and mobile, a vertical player may be reduced below the 200px-wide 9:16 minimum down to a 200 x 200 compact fallback. Keep the width at 200px while the height moves between 356px and 200px, accepting internal player whitespace at this deliberately compact size. Preserve that compact size when the viewport changes between narrow and wide layouts.

YouTube viewports should remain at least 200 x 200 pixels when space permits. For 9:16 media this normally means a minimum rendered height of about 356 pixels. When the available viewport cannot satisfy both the ratio and minimum size, keep the player on screen and allow only the necessary ratio fallback.

Calculate the final width and height from both the available viewport height and the fixed-player content width. Recalculate on window resize, `orientationchange`, and `visualViewport` resize without changing playback state.

Keep YouTube, TikTok, iframe, frame wrapper, and stage dimensions aligned. When the YouTube IFrame API is ready, keep `ytPlayer.setSize(width, height)` synchronized with the wrapper.

The shared player handle activates horizontal and vertical movement independently after a small per-axis threshold. Vertical dragging resizes the aspect-ratio-preserving player; horizontal dragging changes its horizontal position. When both axes exceed their thresholds during the same gesture, resize and horizontal movement together without requiring the user to release the handle. Show the horizontal arrows only while the handle is active. Save horizontal placement as a normalized left-to-right value and clamp it after media-size, viewport, or orientation changes.

On touch devices, keep the interactive handle area close to the visible grip and use a larger movement threshold than mouse input. A brief accidental touch must preserve the currently rendered height; viewport recalculation triggered during an active handle interaction must not reapply a different stored size.

The handle and expanded `.player-window-actions` follow the rendered player width and horizontal offset. Actions occupy a separate row above the frame and must not cover the embedded player. Long countdown and Full ver. controls remain usable within the moved player width and must not leave the viewport.

When the rendered player width is 300px or less, place the countdown or Full ver. controls on their own first row and keep collapse / close controls on the second row. Measure the resulting action height and reserve matching space above the frame so wrapped controls never overlap the embed.

Transparent space around a narrow player must not intercept list interactions. Only the rendered stage and visible window-action controls should receive pointer input.

Collapsed mode hides the frame and resize handle while keeping collapse/restore and close actions available.

While resizing, temporarily disable iframe `pointer-events`.

During touch interaction, prevent accidental page scrolling where needed.

When changing player height behavior, also check fixed-player bottom offsets and scroll-position adjustments.

## 13. Now Playing Display Rules

`nowPlayingWrapper` / `nowPlayingTitle` display the current song label.

The same label should also be set on the `title` attribute.

The Now Playing row should stay one line and keep the fixed player height stable. If the label overflows, it may scroll horizontally after an idle delay; labels that fit should remain static with the usual ellipsis behavior.

The Now Playing text area may have its own dark-blue rounded background, but the fixed player background and control layout should remain unchanged. Keep the background on the outer text area so only the text moves during marquee scrolling.

The Now Playing text area should keep a stable outer width so previous/next/repeat/random controls do not shift when the label changes. Short labels should be centered inside that stable area; long labels should use ellipsis or marquee for overflow.

On desktop, browser resizing should not re-check the Now Playing overflow state every frame. Wait until resizing settles, then re-check after about 1000ms and restart the scroll from the beginning only if the label still overflows.

If there is a notice for the case where the currently playing video is no longer in the visible list, do not break that behavior.

The currently playing card should receive the `playing` class.

Closing the player should clear the current playing state and remove list highlights.

After clicking a tag inside a video-list card, scrolling should prefer the tapped source card after the list rerenders. If that card is no longer visible, scroll back near the result count or list top instead of jumping to the now playing card.

When there is a now playing state, a `♪` floating button can appear only while the now playing card is outside the viewport or filtered out. It should scroll back to the now playing card, or to the filtered-out notice/result count when the card is not in the visible list.

Now playing behavior can interact with scroll-position adjustment logic, so check those scripts when changing it.

## 14. Relationship With `exclusion-style-sync.js`

`script.js` applies exclusion conditions before rendering the list and updating `currentFilteredVideos`.

`exclusion-style-sync.js` only syncs exclusion styles after tag owners update `FilterState`. It should not handle tag clicks, reset clicks, or wrap `renderVideoList()`.

When changing player behavior, keep `currentFilteredVideos` aligned with the actual visible list.

Random playback, previous/next, and automatic continuous playback should not drift away from the exclusion-filtered visible list.

Also see [Filter Tag Rules](filter-tag-rules.md).

## 15. Checklist For Player Changes

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

## 16. Out Of Scope For This Document Branch

This documentation branch should not change:

- Implementation behavior
- UI behavior
- Player behavior
- Keyboard shortcuts
- Random playback behavior
- Repeat behavior
- Tag behavior
- User-facing help pages
