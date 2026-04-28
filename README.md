# Intercom Counter

Firefox extension for personal Intercom throughput tracking.

It shows three daily counters in the toolbar popup:

- `Dialogs`: first reply you send in a conversation on the current local day
- `Replies`: every reply you send
- `Closed`: every conversation you close

The goal is simple: keep a lightweight daily pulse on support activity now, then build historical charts on top of the same stored data later.

## Current status

This repository contains a working MVP that has been smoke-tested manually in a real Intercom workflow.

Confirmed working scenarios:

- opening a conversation does not increment counters
- first reply in a conversation increments `Dialogs` and `Replies`
- second reply in the same conversation on the same day increments only `Replies`
- `Ctrl+Enter` reply is tracked
- closing a conversation increments `Closed`
- duplicate close events are deduplicated

## How counting works

- `Dialogs +1`
  when you send the first reply in a given conversation on the current local day
- `Replies +1`
  on every reply you send
- `Closed +1`
  when Intercom sends a close action for the conversation
- `Snooze`
  is not counted directly; if the same conversation comes back later on the same day, it should continue the existing daily dialog instead of starting a new one

All counters are stored locally in `browser.storage.local`.

## Installation in Firefox

For development and testing:

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on...`
3. Select [manifest.json](C:/projects/intercom-counter/manifest.json)
4. Open `https://app.intercom.com/`
5. Pin the extension and open the popup

Notes:

- this is a temporary install flow for local development
- for long-term use in stable Firefox, the extension will need to be packaged and signed appropriately

## Using the popup

The popup shows:

- today's `Dialogs`, `Replies`, and `Closed`
- recent normalized events
- a debug panel with the latest detection steps

Buttons:

- `Reset today`: clears only today's counters in local storage
- `Copy debug`: copies recent detection logs for troubleshooting

The debug panel exists because Intercom's internal requests are noisy and can change over time. It makes live validation much easier when a workflow stops being counted correctly.

## Local development

### Commands

```bash
npm test
npm run check
npm run validate
npm run build
```

`npm run build` creates the uploadable Firefox package in `web-ext-artifacts/`.

### Project structure

- `manifest.json`: Firefox extension manifest
- `src/content/intercom-observer.js`: bridge between page context and extension context
- `src/content/page-hook.js`: Intercom page instrumentation for UI intents and network traffic
- `src/background/background.js`: storage, badge updates, popup API
- `src/popup/`: toolbar popup UI
- `src/shared/stats.js`: counter rules, persistence helpers, deduplication
- `test/`: unit tests for counting logic
- `docs/architecture.md`: short architecture note

## Manual smoke test

Recommended pre-release check:

1. Reload the extension in `about:debugging`
2. Refresh the Intercom tab
3. Click `Reset today`
4. Open an unassigned conversation and do nothing
   expected: all counters stay at `0`
5. Send one reply with a mouse click
   expected: `Dialogs 1`, `Replies 1`, `Closed 0`
6. Send one more reply in the same conversation with `Ctrl+Enter`
   expected: `Dialogs 1`, `Replies 2`, `Closed 0`
7. Close the conversation
   expected: `Dialogs 1`, `Replies 2`, `Closed 1`

## Limitations

- this tracks only activity performed from the local Firefox session where the extension is installed
- no sync between browsers or machines yet
- Intercom request names and payloads may change over time
- the historical chart UI is not built yet, though the project already stores day-based data locally

## Next step

The next planned iteration is historical reporting: daily aggregation, trend visualization, and a quick way to spot strong and weak days without changing the counting core.
