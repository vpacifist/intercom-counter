# Architecture

## Event flow

1. The content script records recent UI intents for `reply` and `close`.
2. It inspects successful Intercom `fetch` and `XMLHttpRequest` traffic.
3. When a reply or close is recognized, it emits a normalized event to the background script.
4. The background script applies the event to persistent daily stats in extension local storage.
5. The popup asks the background script for today's counters and recent events.

## Browser targets

- `manifest.json` is the source manifest and version source of truth.
- Firefox can still load the root manifest directly for quick local testing.
- `npm run prepare:firefox` creates `dist/firefox` with the source manifest unchanged.
- `npm run prepare:chrome` creates `dist/chrome` from the same source manifest, removes Firefox-only Gecko metadata, and converts `background.scripts` to Chrome MV3 `background.service_worker`.
- Runtime code uses `src/shared/extension-api.js` and small content-script helpers so Firefox `browser.*` and Chrome `chrome.*` APIs share the same application logic.

## Counting rules

- `reply_sent`: increments `replies` every time.
- First `reply_sent` for a conversation on a local calendar day increments `dialogs`.
- Extra replies in the same conversation on the same day do not increment `dialogs`.
- `conversation_closed`: increments `closed`.

## Known limitations

- This MVP only tracks activity coming from your own browser session.
- Intercom DOM labels and request shapes may vary by workspace.
- `Snooze` is not counted directly; its effect is handled indirectly because dialogs are counted only on the first reply of the day.
