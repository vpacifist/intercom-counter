(function main() {
  if (window.__intercomCounterInjected) {
    return;
  }

  window.__intercomCounterInjected = true;

  const recentIntents = [];
  const observedRequests = new Map();
  const MAX_INTENTS = 20;
  const INTENT_TTL_MS = 15000;

  instrumentClicks();
  instrumentFetch();
  instrumentXHR();
  cleanupLoop();

  function instrumentClicks() {
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target instanceof Element ? event.target.closest("button, [role='button']") : null;
        if (!target) {
          return;
        }

        const label = normalizeText(
          target.getAttribute("aria-label") ||
            target.getAttribute("title") ||
            target.textContent ||
            ""
        );

        const type = classifyIntent(label);
        if (!type) {
          return;
        }

        recentIntents.unshift({
          type,
          conversationId: getCurrentConversationId(),
          recordedAt: Date.now(),
          label
        });
        recentIntents.splice(MAX_INTENTS);
      },
      true
    );
  }

  function instrumentFetch() {
    const originalFetch = window.fetch;
    if (typeof originalFetch !== "function") {
      return;
    }

    window.fetch = async function patchedFetch(input, init) {
      const requestMeta = buildRequestMeta(input, init);
      const response = await originalFetch.apply(this, arguments);

      try {
        const clone = response.clone();
        const responseText = await clone.text();
        analyzeTraffic({
          ...requestMeta,
          status: response.status,
          responseText
        });
      } catch (error) {
        console.debug("[intercom-counter] fetch analyze failed", error);
      }

      return response;
    };
  }

  function instrumentXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
      this.__intercomCounter = {
        method: method || "GET",
        url: String(url || ""),
        requestText: ""
      };
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function patchedSend(body) {
      if (this.__intercomCounter) {
        this.__intercomCounter.requestText = stringifyBody(body);
      }

      this.addEventListener("loadend", () => {
        if (!this.__intercomCounter) {
          return;
        }

        analyzeTraffic({
          ...this.__intercomCounter,
          status: this.status,
          responseText: typeof this.responseText === "string" ? this.responseText : ""
        });
      });

      return originalSend.apply(this, arguments);
    };
  }

  function analyzeTraffic({ method, url, requestText, responseText, status }) {
    if (!url || !shouldInspect(url, requestText, responseText)) {
      return;
    }

    if (typeof status === "number" && status >= 400) {
      return;
    }

    const conversationId =
      extractConversationId(url) ||
      extractConversationId(requestText) ||
      extractConversationId(responseText) ||
      getCurrentConversationId();

    if (!conversationId) {
      return;
    }

    const combined = `${method || ""}\n${url}\n${requestText || ""}\n${responseText || ""}`.toLowerCase();
    const intent = matchRecentIntent(conversationId);
    const eventType = classifyEventType(combined, intent);

    if (!eventType) {
      return;
    }

    const eventId = buildEventId(eventType, conversationId, combined, intent);
    if (observedRequests.has(eventId)) {
      return;
    }

    observedRequests.set(eventId, Date.now());

    browser.runtime.sendMessage({
      type: "intercom:event",
      payload: {
        type: eventType,
        conversationId,
        occurredAt: Date.now(),
        eventId,
        source: "network"
      }
    });
  }

  function shouldInspect(url, requestText, responseText) {
    const combined = `${url}\n${requestText || ""}\n${responseText || ""}`.toLowerCase();
    if (!combined.includes("intercom")) {
      return false;
    }

    return /(conversation|reply|message|close|closed|snooze|assignment|part)/.test(combined);
  }

  function classifyEventType(combined, intent) {
    if (intent && intent.type === "conversation_closed") {
      return "conversation_closed";
    }

    if (intent && intent.type === "reply_sent") {
      return "reply_sent";
    }

    if (/(close_conversation|conversation_closed|"state":"closed"|"status":"closed"|mark_closed|admin_close)/.test(combined)) {
      return "conversation_closed";
    }

    if (/(reply_to_conversation|admin_reply|send_reply|conversation_parts|part_type|message_parts|reply)/.test(combined)) {
      return "reply_sent";
    }

    return null;
  }

  function matchRecentIntent(conversationId) {
    const now = Date.now();
    for (const intent of recentIntents) {
      if (now - intent.recordedAt > INTENT_TTL_MS) {
        continue;
      }

      if (!intent.conversationId || intent.conversationId === conversationId) {
        return intent;
      }
    }

    return null;
  }

  function cleanupLoop() {
    window.setInterval(() => {
      const now = Date.now();
      while (recentIntents.length && now - recentIntents[recentIntents.length - 1].recordedAt > INTENT_TTL_MS) {
        recentIntents.pop();
      }

      for (const [eventId, timestamp] of observedRequests.entries()) {
        if (now - timestamp > INTENT_TTL_MS) {
          observedRequests.delete(eventId);
        }
      }
    }, 5000);
  }

  function buildRequestMeta(input, init) {
    if (input instanceof Request) {
      return {
        method: input.method || "GET",
        url: input.url,
        requestText: init && init.body ? stringifyBody(init.body) : ""
      };
    }

    return {
      method: init && init.method ? init.method : "GET",
      url: String(input || ""),
      requestText: init && init.body ? stringifyBody(init.body) : ""
    };
  }

  function buildEventId(type, conversationId, combined, intent) {
    const bucket = Math.floor(Date.now() / 5000);
    const suffix = intent ? normalizeText(intent.label).slice(0, 40) : combined.slice(0, 80);
    return `${type}:${conversationId}:${bucket}:${suffix}`;
  }

  function stringifyBody(body) {
    if (!body) {
      return "";
    }

    if (typeof body === "string") {
      return body;
    }

    if (body instanceof URLSearchParams) {
      return body.toString();
    }

    if (body instanceof FormData) {
      const entries = [];
      for (const [key, value] of body.entries()) {
        entries.push(`${key}=${String(value)}`);
      }
      return entries.join("&");
    }

    try {
      return JSON.stringify(body);
    } catch (error) {
      return "";
    }
  }

  function extractConversationId(value) {
    if (!value) {
      return null;
    }

    const text = String(value);
    const patterns = [
      /conversation(?:s)?\/(\d{3,})/i,
      /conversation_id["=: ]+["']?(\d{3,})/i,
      /conversationId["=: ]+["']?(\d{3,})/i,
      /"id":["']?(\d{3,})["']?,["']?(?:type|object)["']?:["']conversation/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  function getCurrentConversationId() {
    const pathMatch = window.location.pathname.match(/(?:conversation|inbox)\/(\d{3,})/i);
    if (pathMatch) {
      return pathMatch[1];
    }

    const selected = document.querySelector("[data-conversation-id]");
    if (selected instanceof HTMLElement) {
      return selected.dataset.conversationId || null;
    }

    return null;
  }

  function classifyIntent(label) {
    if (!label) {
      return null;
    }

    if (/\bclose\b/.test(label)) {
      return "conversation_closed";
    }

    if (/\bsend\b|\breply\b/.test(label) && !/\bclose\b/.test(label)) {
      return "reply_sent";
    }

    return null;
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
})();
