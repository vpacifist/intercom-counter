(function main() {
  if (window.__intercomCounterPageHookInjected) {
    return;
  }

  window.__intercomCounterPageHookInjected = true;

  const recentIntents = [];
  const observedRequests = new Map();
  const consumedIntentIds = new Map();
  const MAX_INTENTS = 20;
  const INTENT_TTL_MS = 15000;

  instrumentClicks();
  instrumentKeyboard();
  instrumentFetch();
  instrumentXHR();
  cleanupLoop();
  emitDebug("hook_loaded", {
    url: window.location.href
  });

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
          intentId: buildIntentId(type),
          type,
          conversationId: getCurrentConversationId(),
          recordedAt: Date.now(),
          label
        });
        recentIntents.splice(MAX_INTENTS);
        emitDebug("intent", {
          type,
          label,
          conversationId: getCurrentConversationId(),
          intentId: recentIntents[0].intentId
        });
      },
      true
    );
  }

  function instrumentKeyboard() {
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.defaultPrevented) {
          return;
        }

        if (event.key !== "Enter") {
          return;
        }

        if (!event.ctrlKey && !event.metaKey) {
          return;
        }

        const conversationId = getCurrentConversationId();
        const intent = {
          intentId: buildIntentId("reply_sent"),
          type: "reply_sent",
          conversationId,
          recordedAt: Date.now(),
          label: event.ctrlKey ? "ctrl+enter" : "cmd+enter"
        };

        recentIntents.unshift(intent);
        recentIntents.splice(MAX_INTENTS);
        emitDebug("intent", {
          type: intent.type,
          label: intent.label,
          conversationId,
          intentId: intent.intentId
        });
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

    emitDebug("traffic_seen", {
      method: method || "GET",
      url: truncate(url, 160),
      status: typeof status === "number" ? status : null
    });

    if (typeof status === "number" && status >= 400) {
      emitDebug("traffic_rejected", {
        reason: "http_error",
        status,
        url: truncate(url, 160)
      });
      return;
    }

    const conversationId =
      extractConversationId(url) ||
      extractConversationId(requestText) ||
      extractConversationId(responseText) ||
      getCurrentConversationId();

    if (!conversationId) {
      emitDebug("traffic_rejected", {
        reason: "conversation_missing",
        url: truncate(url, 160)
      });
      return;
    }

    const combined = `${method || ""}\n${url}\n${requestText || ""}\n${responseText || ""}`.toLowerCase();
    const intent = matchRecentIntent(conversationId);
    const eventType = classifyEventType({
      method,
      url,
      requestText,
      responseText,
      combined,
      intent
    });

    if (!eventType) {
      emitDebug("traffic_rejected", {
        reason: intent ? "event_type_unknown" : "no_recent_intent",
        conversationId,
        url: truncate(url, 160)
      });
      return;
    }

    if (intent && intent.type === eventType && consumedIntentIds.has(intent.intentId)) {
      emitDebug("traffic_duplicate", {
        reason: "intent_already_consumed",
        eventType,
        conversationId,
        intentId: intent.intentId
      });
      return;
    }

    const eventId = buildEventId(eventType, conversationId, combined, intent);
    if (observedRequests.has(eventId)) {
      emitDebug("traffic_duplicate", {
        eventType,
        conversationId,
        eventId
      });
      return;
    }

    observedRequests.set(eventId, Date.now());
    if (intent && intent.type === eventType) {
      consumedIntentIds.set(intent.intentId, Date.now());
    }
    emitDebug("event_detected", {
      eventType,
      conversationId,
      eventId,
      intentId: intent ? intent.intentId : null
    });

    emitEvent({
      type: eventType,
      conversationId,
      occurredAt: Date.now(),
      eventId,
      source: "network"
    });
  }

  function emitEvent(payload) {
    window.postMessage(
      {
        source: "intercom-counter-page",
        type: "intercom:event",
        payload
      },
      window.location.origin
    );
  }

  function emitDebug(stage, details) {
    window.postMessage(
      {
        source: "intercom-counter-page",
        type: "intercom:debug",
        payload: {
          occurredAt: Date.now(),
          stage,
          details
        }
      },
      window.location.origin
    );
  }

  function shouldInspect(url, requestText, responseText) {
    const combined = `${url}\n${requestText || ""}\n${responseText || ""}`.toLowerCase();
    if (!combined.includes("intercom")) {
      return false;
    }

    return /(conversation|reply|message|close|closed|snooze|assignment|part)/.test(combined);
  }

  function classifyEventType({ method, url, requestText, combined, intent }) {
    const normalizedMethod = String(method || "GET").toUpperCase();
    if (normalizedMethod === "GET") {
      return null;
    }

    const urlText = String(url || "").toLowerCase();
    const requestPayload = String(requestText || "").toLowerCase();
    const requestCombined = `${urlText}\n${requestPayload}\n${combined}`;

    if (
      /(\/close(?:[/?]|$)|close_conversation|conversation_closed|"state":"closed"|"status":"closed"|mark_closed|admin_close|status=closed|state=closed)/.test(requestCombined)
    ) {
      return "conversation_closed";
    }

    if (!intent) {
      return null;
    }

    if (
      intent.type === "conversation_closed" &&
      /(\/close(?:[/?]|$)|close_conversation|conversation_closed|"state":"closed"|"status":"closed"|mark_closed|admin_close|status=closed|state=closed)/.test(requestCombined)
    ) {
      return "conversation_closed";
    }

    if (
      intent.type === "reply_sent" &&
      /(reply_to_conversation|admin_reply|send_reply|conversation_parts|message_parts|parts|reply)/.test(requestCombined)
    ) {
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

      for (const [intentId, timestamp] of consumedIntentIds.entries()) {
        if (now - timestamp > INTENT_TTL_MS) {
          consumedIntentIds.delete(intentId);
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
    if (intent && intent.type === type) {
      return `${type}:${conversationId}:${intent.intentId}`;
    }

    const bucket = Math.floor(Date.now() / 5000);
    const suffix = combined.slice(0, 80);
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

  function buildIntentId(type) {
    return `${type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  }

  function truncate(value, maxLength) {
    const text = String(value || "");
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength - 1)}…`;
  }
})();
