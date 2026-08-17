import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { getNextLocalDayStart } from "../src/shared/day-rollover.js";
import { applyEvent, createInitialState, getTodayStats, makeDateKey, resetDay } from "../src/shared/stats.js";

async function loadTrafficClassifier() {
  const source = await readFile(new URL("../src/content/page-hook.js", import.meta.url), "utf8");
  const testHooks = {};
  vm.runInNewContext(source, {
    globalThis: { __intercomCounterTestHooks: testHooks }
  });
  return testHooks.classifyEventType;
}

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

test("duplicate close within dedupe window is ignored", () => {
  const now = Date.UTC(2026, 3, 24, 8, 0, 0);
  const first = applyEvent(createInitialState(), {
    type: "conversation_closed",
    conversationId: "123",
    occurredAt: now,
    eventId: "close-1"
  });
  const second = applyEvent(first, {
    type: "conversation_closed",
    conversationId: "123",
    occurredAt: now + 2000,
    eventId: "close-2"
  });

  const today = getTodayStats(second, now);
  assert.equal(today.closed, 1);
});

test("closed status in a background response is not classified as a close", async () => {
  const classifyEventType = await loadTrafficClassifier();
  const result = classifyEventType({
    method: "POST",
    url: "https://app.intercom.com/ember/inbox/conversations/list",
    requestText: "",
    responseText: '{"conversations":[{"id":"456","status":"closed"}]}',
    intent: null
  });

  assert.equal(result, null);
});

test("explicit close request with matching intent is classified as a close", async () => {
  const classifyEventType = await loadTrafficClassifier();
  const result = classifyEventType({
    method: "POST",
    url: "https://app.intercom.com/ember/inbox/conversations/123/close",
    requestText: "",
    intent: { type: "conversation_closed" }
  });

  assert.equal(result, "conversation_closed");
});

test("reply response with matching intent is classified as a reply", async () => {
  const classifyEventType = await loadTrafficClassifier();
  const result = classifyEventType({
    method: "POST",
    url: "https://app.intercom.com/ember/inbox/conversations/123",
    requestText: "",
    combined: '{"type":"admin_reply"}',
    intent: { type: "reply_sent" }
  });

  assert.equal(result, "reply_sent");
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

test("first reply after reset counts the conversation again", () => {
  const now = Date.UTC(2026, 3, 24, 8, 0, 0);
  const state = applyEvent(createInitialState(), {
    type: "reply_sent",
    conversationId: "123",
    occurredAt: now,
    eventId: "reply-before-reset"
  });
  const reset = resetDay(state, makeDateKey(now));
  const afterReset = applyEvent(reset, {
    type: "reply_sent",
    conversationId: "123",
    occurredAt: now + 1000,
    eventId: "reply-after-reset"
  });

  const today = getTodayStats(afterReset, now);
  assert.equal(today.dialogs, 1);
  assert.equal(today.replies, 1);
});

test("resetDay removes only current day events", () => {
  const yesterday = Date.UTC(2026, 3, 23, 8, 0, 0);
  const today = Date.UTC(2026, 3, 24, 8, 0, 0);
  const previousState = applyEvent(createInitialState(), {
    type: "reply_sent",
    conversationId: "previous",
    occurredAt: yesterday,
    eventId: "reply-yesterday"
  });
  const state = applyEvent(previousState, {
    type: "reply_sent",
    conversationId: "current",
    occurredAt: today,
    eventId: "reply-today"
  });

  const reset = resetDay(state, makeDateKey(today));
  assert.deepEqual(reset.eventLog.map((event) => event.eventId), ["reply-yesterday"]);
});

test("empty next day returns fresh zero counters", () => {
  const firstDay = Date.UTC(2026, 3, 24, 8, 0, 0);
  const secondDay = Date.UTC(2026, 3, 25, 8, 0, 0);
  const state = applyEvent(createInitialState(), {
    type: "reply_sent",
    conversationId: "123",
    occurredAt: firstDay,
    eventId: "reply-1"
  });

  const today = getTodayStats(state, secondDay);
  assert.equal(today.dateKey, makeDateKey(secondDay));
  assert.equal(today.dialogs, 0);
  assert.equal(today.replies, 0);
  assert.equal(today.closed, 0);
});

test("daily rollover is scheduled for the next local day start", () => {
  const evening = new Date(2026, 3, 24, 23, 59, 30).getTime();
  const nextDayStart = new Date(2026, 3, 25, 0, 0, 0).getTime();

  assert.equal(getNextLocalDayStart(evening), nextDayStart);
});
