(function main() {
  const extensionApi = globalThis.browser || globalThis.chrome;

  if (window.__intercomCounterBridgeInjected) {
    return;
  }

  window.__intercomCounterBridgeInjected = true;

  window.addEventListener("message", async (event) => {
    if (event.source !== window) {
      return;
    }

    const payload = event.data;
    if (!payload || payload.source !== "intercom-counter-page") {
      return;
    }

    try {
      if (payload.type === "intercom:event") {
        await sendRuntimeMessage({
          type: "intercom:event",
          payload: payload.payload
        });
      }

      if (payload.type === "intercom:debug") {
        await sendRuntimeMessage({
          type: "intercom:debug",
          payload: payload.payload
        });
      }
    } catch (error) {
      console.debug("[intercom-counter] failed to forward event", error);
    }
  });

  injectPageHook();

  function injectPageHook() {
    const script = document.createElement("script");
    script.src = extensionApi.runtime.getURL("src/content/page-hook.js");
    script.async = false;
    script.dataset.intercomCounter = "true";
    (document.documentElement || document.head || document.body).appendChild(script);
    script.remove();
  }

  function sendRuntimeMessage(message) {
    if (globalThis.browser?.runtime?.sendMessage) {
      return globalThis.browser.runtime.sendMessage(message);
    }

    return new Promise((resolve, reject) => {
      globalThis.chrome.runtime.sendMessage(message, (response) => {
        const error = globalThis.chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(response);
      });
    });
  }
})();
