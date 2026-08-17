# Changelog

This project uses lightweight release notes for AMO releases. Keep the top section as the next version being developed, then move it to a dated release section after AMO accepts the upload.

## 0.1.2 - Unreleased

- Add Chrome packaging support from the shared extension source.
- Add a cross-browser WebExtension API compatibility layer for Firefox and Chrome.
- Remove the unused tabs permission before Chrome Web Store submission.
- Add a Chrome Web Store-compatible 1280x800 screenshot.
- Add a public privacy policy for Chrome Web Store publication.
- Prevent background Intercom responses from overcounting closed conversations.
- Make Reset today clear current-day conversation tracking and recent events.
- Reset the toolbar badge on local day rollover.
- Schedule daily rollover refreshes with the Firefox alarms API.
- Add the AMO listing popup screenshot.
- Exclude store assets and output folders from extension validation/build output.

## 0.1.0 - Published on AMO

- Initial Firefox MVP for local Intercom activity counters.
- Count daily dialogs, replies, and closed conversations.
- Add popup stats, reset action, debug log, icons, and AMO packaging metadata.

Release source: git tag `amo-v0.1.0`.
