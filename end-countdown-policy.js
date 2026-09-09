(() => {
  const COUNTDOWN_SECONDS = 10;
  const SEEK_JUMP_THRESHOLD_SECONDS = 2.5;

  function createState(graceStartedAt = null) {
    return { previousTime: null, graceStartedAt };
  }

  function evaluate(state, { currentTime, endSeconds, now }) {
    if (![currentTime, endSeconds, now].every(Number.isFinite)) return null;

    const remainingSeconds = endSeconds - currentTime;
    if (remainingSeconds > 0) {
      return {
        state: { previousTime: currentTime, graceStartedAt: null },
        remainingSeconds: remainingSeconds <= COUNTDOWN_SECONDS ? remainingSeconds : null,
        advance: false
      };
    }

    const hasPreviousSample = state.previousTime !== null;
    const cameFromSeek = hasPreviousSample && currentTime - state.previousTime > SEEK_JUMP_THRESHOLD_SECONDS;
    if (state.graceStartedAt === null && hasPreviousSample && !cameFromSeek) {
      return { state, remainingSeconds: 0, advance: true };
    }

    // An unconfirmed first sample may still belong to the previously loaded video.
    const graceStartedAt = state.graceStartedAt ?? now;
    const graceRemaining = Math.max(0, COUNTDOWN_SECONDS - ((now - graceStartedAt) / 1000));
    return {
      state: { ...state, graceStartedAt },
      remainingSeconds: graceRemaining,
      advance: graceRemaining <= 0
    };
  }

  window.EndCountdownPolicy = Object.freeze({ createState, evaluate });
})();
