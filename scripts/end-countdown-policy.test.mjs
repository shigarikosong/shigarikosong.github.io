import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBrowserScript, toPlain } from './browser-script-test-utils.mjs';

function createPolicy() {
  return loadBrowserScript('end-countdown-policy.js').EndCountdownPolicy;
}

test('countdown is hidden before the final ten seconds and normal playback advances at end', () => {
  const policy = createPolicy();
  let update = policy.evaluate(policy.createState(), { currentTime: 0, endSeconds: 20, now: 0 });
  assert.equal(update.remainingSeconds, null);
  update = policy.evaluate(update.state, { currentTime: 10, endSeconds: 20, now: 10000 });
  assert.equal(update.remainingSeconds, 10);
  update = policy.evaluate(update.state, { currentTime: 19.5, endSeconds: 20, now: 19500 });
  assert.equal(update.advance, false);
  assert.equal(update.remainingSeconds, 0.5);
  update = policy.evaluate(update.state, { currentTime: 20, endSeconds: 20, now: 20000 });
  assert.equal(update.advance, true);
});

test('a first sample beyond end receives a full grace period, even when the clock starts at zero', () => {
  const policy = createPolicy();
  let update = policy.evaluate(policy.createState(), { currentTime: 30, endSeconds: 20, now: 0 });
  assert.equal(update.advance, false);
  assert.equal(update.remainingSeconds, 10);
  update = policy.evaluate(update.state, { currentTime: 30, endSeconds: 20, now: 9000 });
  assert.equal(update.remainingSeconds, 1);
  assert.equal(update.advance, false);
  update = policy.evaluate(update.state, { currentTime: 30, endSeconds: 20, now: 10000 });
  assert.equal(update.advance, true);
  assert.equal(update.remainingSeconds, 0);
});

test('a jump greater than 2.5 seconds starts grace instead of advancing immediately', () => {
  const policy = createPolicy();
  for (const [previousTime, advance] of [[17.5, true], [17, false]]) {
    const state = Object.freeze({ previousTime, graceStartedAt: null });
    const update = policy.evaluate(state, { currentTime: 20, endSeconds: 20, now: 1000 });
    assert.equal(update.advance, advance);
    assert.deepEqual(state, { previousTime, graceStartedAt: null });
  }
});

test('seeking back before end clears grace and restores the normal countdown', () => {
  const policy = createPolicy();
  let update = policy.evaluate(policy.createState(), { currentTime: 30, endSeconds: 20, now: 0 });
  update = policy.evaluate(update.state, { currentTime: 5, endSeconds: 20, now: 9000 });
  assert.equal(update.remainingSeconds, null);
  assert.equal(update.state.graceStartedAt, null);
  update = policy.evaluate(update.state, { currentTime: 19, endSeconds: 20, now: 10000 });
  assert.equal(update.remainingSeconds, 1);
  update = policy.evaluate(update.state, { currentTime: 20, endSeconds: 20, now: 11000 });
  assert.equal(update.advance, true);
});

test('resetting state forgets the previous video while same-video monitoring may preserve grace', () => {
  const policy = createPolicy();
  assert.deepEqual(toPlain(policy.createState()), { previousTime: null, graceStartedAt: null });
  const state = policy.createState(1000);
  const update = policy.evaluate(state, { currentTime: 30, endSeconds: 20, now: 10000 });
  assert.equal(update.remainingSeconds, 1);
  const nextVideo = policy.evaluate(policy.createState(), { currentTime: 30, endSeconds: 20, now: 10000 });
  assert.equal(nextVideo.remainingSeconds, 10);
});

test('invalid time samples produce no update and do not mutate the last valid state', () => {
  const policy = createPolicy();
  const state = Object.freeze({ previousTime: 19, graceStartedAt: null });
  for (const invalid of [NaN, Infinity, undefined, null]) {
    assert.equal(policy.evaluate(state, { currentTime: invalid, endSeconds: 20, now: 1000 }), null);
  }
  assert.deepEqual(state, { previousTime: 19, graceStartedAt: null });
});
