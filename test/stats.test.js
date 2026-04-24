import test from "node:test";
import assert from "node:assert/strict";
import { applyEvent, createInitialState, getTodayStats, makeDateKey, resetDay } from "../src/shared/stats.js";

test("first daily reply increments dialogs and replies", () => {
  const now = Date.UTC(2026, 3, 24, 8, 0, 0);
  const state = applyEvent(createInitialState(), {
    type: "reply_sent",
    conversationId: "123",
    occurredAt: now,
    eventId: "reply-1"
  });

  const today = getTodayStats(state, now);
  assert.equal(today.dialogs, 1);
  assert.equal(today.replies, 1);
  assert.equal(today.closed, 0);
});

test("second reply in same conversation same day increments only replies", () => {
  const now = Date.UTC(2026, 3, 24, 8, 0, 0);
  const first = applyEvent(createInitialState(), {
    type: "reply_sent",
    conversationId: "123",
    occurredAt: now,
    eventId: "reply-1"
  });
  const second = applyEvent(first, {
    type: "reply_sent",
    conversationId: "123",
    occurredAt: now + 1000,
    eventId: "reply-2"
  });

  const today = getTodayStats(second, now);
  assert.equal(today.dialogs, 1);
  assert.equal(today.replies, 2);
});

test("reply on next day starts a new dialog count", () => {
  const firstDay = Date.UTC(2026, 3, 24, 8, 0, 0);
  const secondDay = Date.UTC(2026, 3, 25, 8, 0, 0);
  const first = applyEvent(createInitialState(), {
    type: "reply_sent",
    conversationId: "123",
    occurredAt: firstDay,
    eventId: "reply-1"
  });
  const second = applyEvent(first, {
    type: "reply_sent",
    conversationId: "123",
    occurredAt: secondDay,
    eventId: "reply-2"
  });

  const dayOne = getTodayStats(second, firstDay);
  const dayTwo = getTodayStats(second, secondDay);
  assert.equal(dayOne.dialogs, 1);
  assert.equal(dayTwo.dialogs, 1);
});

test("close increments closed counter", () => {
  const now = Date.UTC(2026, 3, 24, 8, 0, 0);
  const state = applyEvent(createInitialState(), {
    type: "conversation_closed",
    conversationId: "123",
    occurredAt: now,
    eventId: "close-1"
  });

  const today = getTodayStats(state, now);
  assert.equal(today.closed, 1);
});

test("duplicate event ids are ignored", () => {
  const now = Date.UTC(2026, 3, 24, 8, 0, 0);
  const first = applyEvent(createInitialState(), {
    type: "reply_sent",
    conversationId: "123",
    occurredAt: now,
    eventId: "same-event"
  });
  const second = applyEvent(first, {
    type: "reply_sent",
    conversationId: "123",
    occurredAt: now + 1000,
    eventId: "same-event"
  });

  const today = getTodayStats(second, now);
  assert.equal(today.dialogs, 1);
  assert.equal(today.replies, 1);
});

test("resetDay clears current day counters", () => {
  const now = Date.UTC(2026, 3, 24, 8, 0, 0);
  const state = applyEvent(createInitialState(), {
    type: "reply_sent",
    conversationId: "123",
    occurredAt: now,
    eventId: "reply-1"
  });
  const reset = resetDay(state, makeDateKey(now));
  const today = getTodayStats(reset, now);
  assert.equal(today.dialogs, 0);
  assert.equal(today.replies, 0);
  assert.equal(today.closed, 0);
});
