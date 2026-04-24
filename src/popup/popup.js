const dialogsValue = document.getElementById("dialogs-value");
const repliesValue = document.getElementById("replies-value");
const closedValue = document.getElementById("closed-value");
const currentDate = document.getElementById("current-date");
const recentEvents = document.getElementById("recent-events");
const statusLine = document.getElementById("status-line");
const resetButton = document.getElementById("reset-button");

init().catch((error) => {
  console.error("[intercom-counter] popup init failed", error);
  statusLine.textContent = "Failed to load stats.";
});

resetButton.addEventListener("click", async () => {
  resetButton.disabled = true;
  try {
    await browser.runtime.sendMessage({ type: "stats:resetToday" });
    await render();
  } finally {
    resetButton.disabled = false;
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
  const response = await browser.runtime.sendMessage({ type: "stats:getToday" });
  if (!response || !response.ok) {
    statusLine.textContent = "Background page is unavailable.";
    return;
  }

  const { today, recentEvents: events } = response;
  dialogsValue.textContent = String(today.dialogs);
  repliesValue.textContent = String(today.replies);
  closedValue.textContent = String(today.closed);
  statusLine.textContent = `Updated ${formatTime(today.updatedAt)}.`;
  renderEvents(events || []);
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

function formatTime(timestamp) {
  if (!timestamp) {
    return "never";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}
