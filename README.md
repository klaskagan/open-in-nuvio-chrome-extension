# Open in Nuvio — Trakt, IMDb & Google

A Chrome Manifest V3 extension for Nuvio Desktop on macOS. Open the current movie or series in Nuvio, jump between Trakt and IMDb, and optionally manage Trakt watched/watchlist status from Google movie/series panels.

## Install the GitHub release

Download `open-in-nuvio-1.7.1-unpacked.zip` from [Releases](https://github.com/klaskagan/open-in-nuvio-chrome-extension/releases), extract it into a permanent folder, and follow [GitHub installation instructions](release/GITHUB-INSTALL.md). This configured download preserves the release extension ID for optional Trakt authorization. The automatically generated Source code ZIP is for development.

## Install locally

1. Open `chrome://extensions` in desktop Chrome 116 or newer.
2. Enable Developer mode, choose Load unpacked and select `open-in-nuvio/`.
3. Refresh any already-open supported title tabs.

Keep the installed folder at the same path when updating, so Chrome retains the extension ID. Nuvio Desktop and its macOS deep-link handler must be installed. Default shortcut: Command+Shift+Y; change it in Chrome's shortcut editor via the settings popup.

## Features

- Inline buttons in Trakt's title action bar and above IMDb's watchlist control.
- Buttons on Google movie/series panels; exact identity checks instead of fuzzy guessing.
- Automatic / Labels / Compact appearance; per-site and per-destination visibility.
- Optional right-click link shortcuts and a current-title keyboard command.
- Optional Trakt OAuth with PKCE, optimistic watched/watchlist controls and series confirmation.
- Local preferences, trusted-context credential storage, no analytics/backend service.

Google support covers .com, .lt and .co.uk (including www). Trakt watched/watchlist replacement recognizes English and Lithuanian controls. Only aired regular-season episodes are included in series actions; specials remain unchanged. Removing watched status removes the corresponding recorded viewings. See INSTALL.md for details and limitations.

## Trakt application setup

The app Client ID identifies the application; each user authorizes their own account and receives separate OAuth tokens. No account tokens or Client Secret belong in this repository.

The source/development configuration deliberately leaves the release Client ID blank. Personal development uses the saved configuration in extension settings. A dedicated public-release app should be configured once by the publisher; community users then just connect their Trakt account. See COMMUNITY-RELEASE.md and release/README.md for stable extension ID, redirect and store packaging steps.

## Development and tests

Requires Node.js 20 or newer and Python 3 for the optional store-packaging tool.

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix validation
npm run format:check
npm test --prefix validation
npm run benchmark --prefix validation
```

Tests use jsdom/fake IndexedDB and simulated account/network responses. No real user history/watchlist writes occur. Recorded public catalog responses are included as fixtures. Browser fixture pages can be served locally with `python3 -m http.server 8767`; inspect `validation/release-browser-tests.html`. These fixtures do not replace the final installed-Chrome OAuth/worker/Nuvio smoke test.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the source file map, editing workflow, and release boundaries. Run `npm run format` after editing, or configure your editor to use this repository’s pinned Prettier version on save.

## Privacy and support

Read PRIVACY.md. Support: klaskagan@gmail.com. Bug reports should include the extension version, supported-page URL, reproduction steps and a redacted screenshot. Never include passwords, Client Secrets, access tokens or refresh tokens.

## License and artwork

Original extension code and documentation: MIT, copyright 2026 klaskagan. MIT permits reuse and modification, including commercial redistribution, with the copyright/license notice retained and no warranty. Third-party artwork and trademarks are separate; see THIRD-PARTY-NOTICES.md and the bundled Apache-2.0 notice for the sourced Trakt icon.

Independent project; not endorsed by Nuvio, Trakt, IMDb or Google. A public store release is not published by this source snapshot. Release gates are listed in PRODUCTION-READINESS.md.
