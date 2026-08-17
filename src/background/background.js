import { appendDebugLog, applyEvent, createInitialState, getTodayStats, makeDateKey, resetDay, sanitizeState } from "../shared/stats.js";
import { getNextLocalDayStart } from "../shared/day-rollover.js";
import {
  actionSetBadgeBackgroundColor,
  actionSetBadgeText,
  actionSetBadgeTextColor,
  actionSetTitle,
  alarmsCreate,
  extensionApi,
  storageLocalGet,
  storageLocalSet
} from "../shared/extension-api.js";

const STORAGE_KEY = "intercomCounterState";
const DAILY_ROLLOVER_ALARM = "daily-rollover";

extensionApi.runtime.onInstalled.addListener(async () => {
  const state = await loadState();
  await saveState(state);
  await refreshBadge(state);
  await scheduleDailyRollover();
});

extensionApi.runtime.onStartup.addListener(async () => {
  const state = await loadState();
  await refreshBadge(state);
  await scheduleDailyRollover();
});

extensionApi.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== DAILY_ROLLOVER_ALARM) {
    return;
  }

  return handleDailyRollover();
});

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  let responsePromise;
  if (message.type === "intercom:event") {
    responsePromise = handleIntercomEvent(message.payload);
  }

  if (message.type === "intercom:debug") {
    responsePromise = handleDebugEvent(message.payload);
  }

  if (message.type === "stats:getToday") {
    responsePromise = handleGetToday();
  }

  if (message.type === "stats:getDebug") {
    responsePromise = handleGetDebug();
  }

  if (message.type === "stats:resetToday") {
    responsePromise = handleResetToday();
  }

  if (!responsePromise) {
    return undefined;
  }

  responsePromise
    .then((response) => sendResponse(response))
    .catch((error) => {
      console.error("[intercom-counter] message handler failed", error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
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
  const stored = await storageLocalGet(STORAGE_KEY);
  return sanitizeState(stored[STORAGE_KEY] || createInitialState());
}

async function saveState(state) {
  await storageLocalSet({ [STORAGE_KEY]: state });
}

async function refreshBadge(state) {
  const today = getTodayStats(state);
  const badgeText = today.dialogs > 0 ? String(today.dialogs) : "";
  await actionSetBadgeBackgroundColor({ color: "#22C55E" });
  await actionSetBadgeTextColor({ color: "#052E16" });
  await actionSetBadgeText({ text: badgeText });
  await actionSetTitle({
    title: `Intercom Counter\nDialogs: ${today.dialogs}\nReplies: ${today.replies}\nClosed: ${today.closed}`
  });
}

async function scheduleDailyRollover() {
  await alarmsCreate(DAILY_ROLLOVER_ALARM, {
    when: getNextLocalDayStart(Date.now()) + 1000
  });
}
