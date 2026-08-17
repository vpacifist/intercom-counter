export const extensionApi = globalThis.browser || globalThis.chrome;

if (!extensionApi) {
  throw new Error("WebExtension API is unavailable.");
}

export function sendRuntimeMessage(message) {
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

export function getRuntimeUrl(path) {
  return extensionApi.runtime.getURL(path);
}

export function storageLocalGet(key) {
  if (globalThis.browser?.storage?.local?.get) {
    return globalThis.browser.storage.local.get(key);
  }

  return new Promise((resolve, reject) => {
    globalThis.chrome.storage.local.get(key, (result) => {
      const error = globalThis.chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(result);
    });
  });
}

export function storageLocalSet(value) {
  if (globalThis.browser?.storage?.local?.set) {
    return globalThis.browser.storage.local.set(value);
  }

  return new Promise((resolve, reject) => {
    globalThis.chrome.storage.local.set(value, () => {
      const error = globalThis.chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

export function actionSetBadgeBackgroundColor(details) {
  return callAction("setBadgeBackgroundColor", details);
}

export function actionSetBadgeTextColor(details) {
  if (!extensionApi.action.setBadgeTextColor) {
    return Promise.resolve();
  }

  return callAction("setBadgeTextColor", details);
}

export function actionSetBadgeText(details) {
  return callAction("setBadgeText", details);
}

export function actionSetTitle(details) {
  return callAction("setTitle", details);
}

export function alarmsCreate(name, details) {
  if (globalThis.browser?.alarms?.create) {
    return globalThis.browser.alarms.create(name, details);
  }

  globalThis.chrome.alarms.create(name, details);
  return Promise.resolve();
}

function callAction(methodName, details) {
  if (globalThis.browser?.action?.[methodName]) {
    return globalThis.browser.action[methodName](details);
  }

  return new Promise((resolve, reject) => {
    globalThis.chrome.action[methodName](details, () => {
      const error = globalThis.chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}
