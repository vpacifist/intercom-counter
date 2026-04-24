const MAX_EVENT_LOG = 250;
const MAX_DEBUG_LOG = 60;
const DEDUPE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const CLOSE_DEDUPE_WINDOW_MS = 15000;

export function makeDateKey(input = Date.now()) {
  const date = new Date(input);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createEmptyDay(dateKey) {
  return {
    dateKey,
    dialogs: 0,
    replies: 0,
    closed: 0,
    updatedAt: null
  };
}

export function createInitialState() {
  return {
    version: 1,
    dailyStats: {},
    conversations: {},
    eventLog: [],
    debugLog: [],
    recentEventIds: {}
  };
}

export function sanitizeState(candidate) {
  const base = createInitialState();
  if (!candidate || typeof candidate !== "object") {
    return base;
  }

  return {
    version: Number.isInteger(candidate.version) ? candidate.version : 1,
    dailyStats: isPlainObject(candidate.dailyStats) ? candidate.dailyStats : {},
    conversations: isPlainObject(candidate.conversations) ? candidate.conversations : {},
    eventLog: Array.isArray(candidate.eventLog) ? candidate.eventLog.slice(0, MAX_EVENT_LOG) : [],
    debugLog: Array.isArray(candidate.debugLog) ? candidate.debugLog.slice(0, MAX_DEBUG_LOG) : [],
    recentEventIds: isPlainObject(candidate.recentEventIds) ? candidate.recentEventIds : {}
  };
}

export function applyEvent(stateInput, eventInput) {
  const state = sanitizeState(stateInput);
  const event = normalizeEvent(eventInput);

  if (!event) {
    return state;
  }

  const nextState = {
    ...state,
    dailyStats: { ...state.dailyStats },
    conversations: { ...state.conversations },
    eventLog: state.eventLog.slice(),
    recentEventIds: { ...state.recentEventIds }
  };

  pruneRecentEventIds(nextState.recentEventIds, event.occurredAt);

  if (nextState.recentEventIds[event.eventId]) {
    return nextState;
  }

  nextState.recentEventIds[event.eventId] = event.occurredAt;

  const day = nextState.dailyStats[event.dateKey] || createEmptyDay(event.dateKey);
  const conversation = nextState.conversations[event.conversationId] || {
    lastReplyDate: null,
    lastCloseDate: null,
    lastCloseAt: null,
    lastSeenAt: null
  };

  if (event.type === "reply_sent") {
    day.replies += 1;
    if (conversation.lastReplyDate !== event.dateKey) {
      day.dialogs += 1;
      conversation.lastReplyDate = event.dateKey;
    }
  }

  if (event.type === "conversation_closed") {
    if (conversation.lastCloseAt && event.occurredAt - conversation.lastCloseAt < CLOSE_DEDUPE_WINDOW_MS) {
      return nextState;
    }

    day.closed += 1;
    conversation.lastCloseDate = event.dateKey;
    conversation.lastCloseAt = event.occurredAt;
  }

  conversation.lastSeenAt = event.occurredAt;
  day.updatedAt = event.occurredAt;

  nextState.dailyStats[event.dateKey] = day;
  nextState.conversations[event.conversationId] = conversation;
  nextState.eventLog.unshift({
    eventId: event.eventId,
    type: event.type,
    conversationId: event.conversationId,
    dateKey: event.dateKey,
    occurredAt: event.occurredAt,
    source: event.source || "unknown"
  });
  nextState.eventLog = nextState.eventLog.slice(0, MAX_EVENT_LOG);

  return nextState;
}

export function getTodayStats(stateInput, now = Date.now()) {
  const state = sanitizeState(stateInput);
  const dateKey = makeDateKey(now);
  return state.dailyStats[dateKey] || createEmptyDay(dateKey);
}

export function appendDebugLog(stateInput, entryInput) {
  const state = sanitizeState(stateInput);
  const entry = normalizeDebugEntry(entryInput);
  if (!entry) {
    return state;
  }

  return {
    ...state,
    debugLog: [entry, ...state.debugLog].slice(0, MAX_DEBUG_LOG)
  };
}

export function resetDay(stateInput, dateKey) {
  const state = sanitizeState(stateInput);
  const nextState = {
    ...state,
    dailyStats: { ...state.dailyStats }
  };
  nextState.dailyStats[dateKey] = createEmptyDay(dateKey);
  return nextState;
}

function normalizeEvent(eventInput) {
  if (!eventInput || typeof eventInput !== "object") {
    return null;
  }

  if (!eventInput.type || !eventInput.conversationId) {
    return null;
  }

  const occurredAt = typeof eventInput.occurredAt === "number" ? eventInput.occurredAt : Date.now();
  const dateKey = eventInput.dateKey || makeDateKey(occurredAt);
  const conversationId = String(eventInput.conversationId);
  const eventId = eventInput.eventId || `${eventInput.type}:${conversationId}:${occurredAt}`;

  return {
    type: eventInput.type,
    conversationId,
    occurredAt,
    dateKey,
    eventId,
    source: eventInput.source || "unknown"
  };
}

function normalizeDebugEntry(entryInput) {
  if (!entryInput || typeof entryInput !== "object") {
    return null;
  }

  return {
    occurredAt: typeof entryInput.occurredAt === "number" ? entryInput.occurredAt : Date.now(),
    stage: typeof entryInput.stage === "string" ? entryInput.stage : "unknown",
    details: isPlainObject(entryInput.details) ? entryInput.details : {}
  };
}

function pruneRecentEventIds(recentEventIds, now) {
  for (const [eventId, timestamp] of Object.entries(recentEventIds)) {
    if (now - timestamp > DEDUPE_TTL_MS) {
      delete recentEventIds[eventId];
    }
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
