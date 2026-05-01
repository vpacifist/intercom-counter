import { appendDebugLog, applyEvent, createInitialState, getTodayStats, makeDateKey, resetDay, sanitizeState } from "../shared/stats.js";
import { getNextLocalDayStart } from "../shared/day-rollover.js";

const STORAGE_KEY = "intercomCounterState";
const DAILY_ROLLOVER_ALARM = "daily-rollover";

browser.runtime.onInstalled.addListener(async () => {
  const state = await loadState();
  await saveState(state);
  await refreshBadge(state);
  await scheduleDailyRollover();
});

browser.runtime.onStartup.addListener(async () => {
  const state = await loadState();
  await refreshBadge(state);
  await scheduleDailyRollover();
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== DAILY_ROLLOVER_ALARM) {
    return;
  }

  return handleDailyRollover();
});

browser.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  if (message.type === "intercom:event") {
    return handleIntercomEvent(message.payload);
  }

  if (message.type === "intercom:debug") {
    return handleDebugEvent(message.payload);
  }

  if (message.type === "stats:getToday") {
    return handleGetToday();
  }

  if (message.type === "stats:getDebug") {
    return handleGetDebug();
  }

  if (message.type === "stats:resetToday") {
    return handleResetToday();
  }

  return undefined;
});

async function handleIntercomEvent(payload) {
  const state = await loadState();
  const nextState = applyEvent(state, payload);
  await saveState(nextState);
  await refreshBadge(nextState);
  return { ok: true, today: getTodayStats(nextState) };
}

async function handleDebugEvent(payload) {
  const state = await loadState();
  const nextState = appendDebugLog(state, payload);
  await saveState(nextState);
  return { ok: true };
}

async function handleGetToday() {
  const state = await loadState();
  await refreshBadge(state);
  await scheduleDailyRollover();
  return {
    ok: true,
    today: getTodayStats(state),
    currentDateKey: makeDateKey(),
    recentEvents: state.eventLog.slice(0, 8),
    recentDebug: state.debugLog.slice(0, 12)
  };
}

async function handleGetDebug() {
  const state = await loadState();
  return { ok: true, state };
}

async function handleResetToday() {
  const state = await loadState();
  const dateKey = makeDateKey();
  const nextState = resetDay(state, dateKey);
  await saveState(nextState);
  await refreshBadge(nextState);
  return { ok: true, today: getTodayStats(nextState) };
}

async function handleDailyRollover() {
  const state = await loadState();
  await refreshBadge(state);
  await scheduleDailyRollover();
}

async function loadState() {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return sanitizeState(stored[STORAGE_KEY] || createInitialState());
}

async function saveState(state) {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

async function refreshBadge(state) {
  const today = getTodayStats(state);
  const badgeText = today.dialogs > 0 ? String(today.dialogs) : "";
  await browser.action.setBadgeBackgroundColor({ color: "#22C55E" });
  if (browser.action.setBadgeTextColor) {
    await browser.action.setBadgeTextColor({ color: "#052E16" });
  }
  await browser.action.setBadgeText({ text: badgeText });
  await browser.action.setTitle({
    title: `Intercom Counter\nDialogs: ${today.dialogs}\nReplies: ${today.replies}\nClosed: ${today.closed}`
  });
}

async function scheduleDailyRollover() {
  await browser.alarms.create(DAILY_ROLLOVER_ALARM, {
    when: getNextLocalDayStart(Date.now()) + 1000
  });
}
