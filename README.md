# Intercom Counter

Personal Firefox extension for tracking daily Intercom activity:

- `Dialogs`: first reply you send in a conversation on a given day
- `Replies`: every reply you send
- `Closed`: every conversation you close

## Status

This is an MVP aimed at temporary loading in Firefox during local testing.

## Project layout

- `manifest.json`: Firefox extension manifest
- `src/content/intercom-observer.js`: watches Intercom UI clicks and network requests
- `src/background/background.js`: stores counters and exposes popup data
- `src/popup/`: toolbar popup UI
- `src/shared/stats.js`: storage and counting rules
- `test/`: unit tests for counter logic

## Local development

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click `Load Temporary Add-on...`.
3. Select [manifest.json](C:/projects/intercom-counter/manifest.json).
4. Open `https://app.intercom.com/`.
5. Pin the extension and open the popup to see counters.

## Smoke test

1. Send a reply in any Intercom conversation.
2. Confirm `Replies` increments by 1.
3. Confirm `Dialogs` increments only once per conversation per day.
4. Close a conversation and confirm `Closed` increments.

## Commands

```bash
npm test
npm run check
```

## Notes

- The detector is intentionally conservative and relies on your local Intercom tab activity.
- Network shapes in Intercom can change; if they do, adjust the heuristics in `src/content/intercom-observer.js`.
