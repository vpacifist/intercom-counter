import { sendRuntimeMessage } from "../shared/extension-api.js";

const dialogsValue = document.getElementById("dialogs-value");
const repliesValue = document.getElementById("replies-value");
const closedValue = document.getElementById("closed-value");
const currentDate = document.getElementById("current-date");
const recentEvents = document.getElementById("recent-events");
const debugEvents = document.getElementById("debug-events");
const statusLine = document.getElementById("status-line");
const resetButton = document.getElementById("reset-button");
const copyDebugButton = document.getElementById("copy-debug-button");
let latestDebugEntries = [];

init().catch((error) => {
  console.error("[intercom-counter] popup init failed", error);
  statusLine.textContent = "Failed to load stats.";
});

resetButton.addEventListener("click", async () => {
  resetButton.disabled = true;
  try {
    await sendRuntimeMessage({ type: "stats:resetToday" });
    await render();
  } finally {
    resetButton.disabled = false;
  }
});

copyDebugButton.addEventListener("click", async () => {
  copyDebugButton.disabled = true;
  try {
    const text = latestDebugEntries.length > 0 ? latestDebugEntries.map(formatDebugLine).join("\n") : "No debug events yet.";
    await navigator.clipboard.writeText(text);
    statusLine.textContent = "Debug copied.";
  } catch (error) {
    console.error("[intercom-counter] failed to copy debug", error);
    statusLine.textContent = "Failed to copy debug.";
  } finally {
    window.setTimeout(() => {
      copyDebugButton.disabled = false;
    }, 400);
  }
});

async function init() {
  currentDate.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date());

  await render();
}

async function render() {
  const response = await sendRuntimeMessage({ type: "stats:getToday" });
  if (!response || !response.ok) {
    statusLine.textContent = "Background page is unavailable.";
    return;
  }

  const { today, recentEvents: events, recentDebug } = response;
  latestDebugEntries = recentDebug || [];
  dialogsValue.textContent = String(today.dialogs);
  repliesValue.textContent = String(today.replies);
  closedValue.textContent = String(today.closed);
  statusLine.textContent = `Updated ${formatTime(today.updatedAt)}.`;
  renderEvents(events || []);
  renderDebug(recentDebug || []);
}

function renderEvents(events) {
  recentEvents.innerHTML = "";

  if (events.length === 0) {
    const item = document.createElement("li");
    item.className = "event-item";
    item.textContent = "No tracked events yet.";
    recentEvents.appendChild(item);
    return;
  }

  for (const event of events) {
    const item = document.createElement("li");
    item.className = "event-item";

    const left = document.createElement("span");
    left.className = "event-type";
    left.textContent = event.type.replaceAll("_", " ");

    const right = document.createElement("span");
    right.textContent = `#${event.conversationId} • ${formatTime(event.occurredAt)}`;

    item.append(left, right);
    recentEvents.appendChild(item);
  }
}

function renderDebug(entries) {
  debugEvents.innerHTML = "";

  if (entries.length === 0) {
    const item = document.createElement("li");
    item.className = "event-item";
    item.textContent = "No debug events yet.";
    debugEvents.appendChild(item);
    return;
  }

  for (const entry of entries) {
    const item = document.createElement("li");
    item.className = "event-item";

    const title = document.createElement("span");
    title.className = "event-type";
    title.textContent = `${entry.stage} • ${formatTime(entry.occurredAt)}`;

    const meta = document.createElement("div");
    meta.className = "debug-meta";
    meta.textContent = formatDetails(entry.details);

    item.append(title, meta);
    debugEvents.appendChild(item);
  }
}

function formatTime(timestamp) {
  if (!timestamp) {
    return "never";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function formatDetails(details) {
  if (!details || typeof details !== "object") {
    return "";
  }

  return Object.entries(details)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
}

function formatDebugLine(entry) {
  return `[${formatTime(entry.occurredAt)}] ${entry.stage} | ${formatDetails(entry.details)}`;
}
