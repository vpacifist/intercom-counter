# Privacy Policy for Intercom Counter

Effective date: August 17, 2026

Intercom Counter is a browser extension that tracks a user's daily Intercom activity. This policy explains what data the extension handles and how that data is used.

## Data Handled by the Extension

To detect replies and closed conversations, Intercom Counter processes Intercom request and response data locally in the user's browser. This processing may include:

- reply and close actions;
- Intercom conversation identifiers;
- event timestamps;
- request URLs and response data needed to identify an action.

The extension does not intentionally store message bodies, contact names, email addresses, authentication credentials, or cookies.

## Locally Stored Data

Intercom Counter stores the following information in the browser's local extension storage:

- daily counts of replied-to conversations, replies, and closed conversations;
- conversation identifiers and dates used to prevent duplicate counting;
- a limited recent event log;
- a limited diagnostic log used to troubleshoot event detection.

This information remains on the user's device. The extension does not provide the developer with access to it. The **Reset today** action removes the current day's counters, current-day conversation tracking, and current-day recent events. Uninstalling the extension removes its local extension storage through the browser.

## How Data Is Used

Data is used only to provide the extension's single purpose: displaying personal daily Intercom activity counters and preventing duplicate counts.

Intercom Counter does not use data for advertising, profiling, analytics, credit decisions, or any purpose unrelated to its activity counters.

## Data Sharing and Transmission

Intercom Counter does not transmit stored data to the developer or to third parties. It does not sell or share user data. It does not include analytics, advertising, tracking services, or remotely hosted executable code.

The extension runs only on `https://app.intercom.com/*`. Intercom's own website and services remain subject to Intercom's privacy practices.

## Permissions

- **Storage:** saves counters, duplicate-prevention metadata, and limited event and diagnostic logs locally.
- **Alarms:** refreshes the toolbar badge and daily state when the local calendar day changes.
- **Host access to app.intercom.com:** detects reply and close actions needed to update the local counters.

## Chrome Web Store Limited Use Disclosure

Intercom Counter's use of information received from browser APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Data handling is limited to providing and maintaining the extension's disclosed single purpose.

## Changes to This Policy

If the extension's data handling changes, this policy and the Chrome Web Store disclosures will be updated before the changed behavior is released.

## Contact

Questions or privacy requests can be submitted through the project's issue tracker:

https://github.com/vpacifist/intercom-counter/issues
