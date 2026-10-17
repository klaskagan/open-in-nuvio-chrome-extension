# Chrome Web Store listing draft — Open in Nuvio

Name: Open in Nuvio — Trakt, IMDb & Google

Summary: Open exact titles in Nuvio, jump between Trakt and IMDb, and optionally manage Trakt from Google.

Support email: klaskagan@gmail.com

## Description

Open the movie or series you are viewing in Nuvio Desktop on macOS, directly from Trakt, IMDb and supported Google Search pages.

- Inline buttons on Trakt's title action bar and above IMDb's watchlist controls.
- Open in Nuvio, Trakt or IMDb from supported Google movie/series panels.
- Configurable keyboard shortcut: suggested Command+Shift+Y on macOS.
- Automatic, Labels and Compact appearance modes.
- Right-click shortcuts on supported title links.
- Optional Trakt account connection for watched and watchlist controls on Google.

Trakt connection uses OAuth with PKCE. Each user authorizes their own Trakt account. Movie unwatch removes all recorded viewings; series watched/unwatched actions show an episode-count confirmation, applying to aired regular-season episodes. Specials are excluded.

Supported Google hosts: google.com, google.lt and google.co.uk, including www variants. Google watched/watchlist replacement recognizes English and Lithuanian labels. Layout changes or ambiguous title data can prevent a match; the extension avoids guessing.

Requires Nuvio Desktop and its registered deep-link handler on macOS. Chrome on mobile devices is not the supported target. The extension is independent and not endorsed by Nuvio, Trakt, IMDb or Google.

## Privacy dashboard preparation

Single purpose: navigate between title pages and Nuvio, with optional Trakt title-status controls in the same workflow.

Explain permissions:

- storage: local preferences and optional OAuth credentials; content scripts receive only preferences.
- identity: Trakt OAuth redirect/authorization flow.
- contextMenus: optional Open in Nuvio link actions.
- supported-site host access: title identification, inline controls and link resolution.
- optional api.trakt.tv/auth.trakt.tv access: requested when connecting Trakt.
- commands: keyboard action declared in the manifest; no extra permission.

No remotely hosted executable code. Scripts, CSS, icons and fonts used by the extension are bundled; no analytics SDK.

Disclose accurately rather than checking “no user data” categorically: the extension handles OAuth authentication information, selected-title/page metadata, watchlist and viewing-history data. Selected title information may be sent to Trakt/Google for resolution. Review the dashboard's current categories and make them match PRIVACY.md. Do not include tokens in screenshots or reviewer notes.

Before submission, publish PRIVACY.md at a public URL (a public GitHub page can be used once the repository exists), enter that URL in the dashboard, upload representative live-site screenshots, and test the final release-app OAuth configuration. Current local test screenshots are verification artifacts, not store screenshots of a signed-in real account.
