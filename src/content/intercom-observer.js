(function main() {
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
        await browser.runtime.sendMessage({
          type: "intercom:event",
          payload: payload.payload
        });
      }

      if (payload.type === "intercom:debug") {
        await browser.runtime.sendMessage({
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
    script.src = browser.runtime.getURL("src/content/page-hook.js");
    script.async = false;
    script.dataset.intercomCounter = "true";
    (document.documentElement || document.head || document.body).appendChild(script);
    script.remove();
  }
})();
