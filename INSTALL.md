# Open in Nuvio — 1.7.2

## Update

If you loaded the `open-in-nuvio` folder beside this file, it has been updated in place. In `chrome://extensions`, reload the extension and check version **1.7.2**. Refresh your Google, IMDb, and Trakt tabs. If your installed copy is elsewhere, replace its contents with the new `open-in-nuvio` folder contents first. Keep the installed folder at the same path so its extension ID and OAuth redirect URL remain stable.

For a first installation, enable Developer mode in `chrome://extensions`, choose **Load unpacked**, and select the folder containing `manifest.json`. Chrome 116 or later is required. Chrome cannot install this ZIP directly.

## Connect Trakt for Google watched/watchlist controls

This feature is optional and off by default. Existing Nuvio/IMDb/Trakt navigation buttons continue to work without an API account setup.

1. Open the extension's toolbar popup → **Connect or manage Trakt**.
2. Expand **First-time setup**. Copy the exact redirect URL shown there.
3. Follow the link to [Trakt’s API applications](https://app.trakt.tv/oauth/applications). Register a personal API application with that redirect URL. Trakt currently requires a verified GitHub account for app registration. Complete Trakt's registration and terms yourself. A normal Trakt login alone does not supply an API Client ID.
4. Paste the new **Client ID** into the extension's connection page. Do not paste a Client Secret or access token. Click **Connect Trakt**, allow access to the two Trakt API/auth hosts when Chrome asks, and authorize the app on Trakt.
5. In the extension popup, turn on **Use Trakt controls on Google**. Return to a supported movie/TV Google knowledge panel.

The extension uses OAuth with PKCE; no Client Secret or backend server is needed. The displayed redirect depends on the installed extension ID; do not register the placeholder shown in the preview screenshots. If the folder/extension ID changes, update the registered redirect and reconnect.

If Trakt does not let your account create an API app, this integration cannot connect until that requirement is resolved. The extension does not reuse another app's credentials or the Trakt website's session tokens.

## What the Google controls do

When enabled, the extension replaces the recognized **Žiūrėta / Watched** and **Noriu žiūrėti / Want to watch** actions within the identified movie/TV watch panel. Each replacement has a **Trakt** label. Google’s original controls are hidden, and their actions are not invoked by the replacements. Disabling the feature, pausing the extension, or disabling Google buttons restores the originals.

- **Movie watched:** adds one viewing with the current timestamp. A fresh history check avoids adding another viewing when the movie is already watched.
- **Movie unwatched:** toggles directly on Google, without opening another page. It removes **all recorded viewings of that movie**. The tooltip states this behavior.
- **TV watched:** shows an in-page confirmation with the number of unwatched aired episodes across all regular seasons. Confirming marks those episodes watched now, without duplicating existing viewings. Specials and unaired episodes stay unchanged. **TV unwatched** requires a separate confirmation and removes all viewings of aired regular-season episodes. The old single-episode chooser is removed.
- **Watchlist:** adds/removes the exact movie or show from your Trakt watchlist. Trakt can automatically remove watched items from its watchlist; both states are reread after an update.

Movie watched and watchlist reads run in parallel after exact title resolution. Recently read status is cached in service-worker memory for up to 10 seconds; verified title IDs are cached for up to 30 minutes. Concurrent status requests share one operation. These caches disappear when the worker stops, and account changes invalidate private status caches.

Watchlist toggles and marking a movie watched update the controls immediately, keep their normal Trakt label and pointer cursor, and remain clickable while earlier saves are pending. Each click immediately updates its toggle; operations save in click order. Replies are reconciled with any later pending clicks, and a failure rolls back only that operation. Successful API writes retain the selected state even if an immediate follow-up read is stale or fails. Confirmed changes are protected against stale reads for 60 seconds in worker memory. Actual write failures restore the previous state and show a retry indication. The worker still checks actual membership/history before a write to avoid duplicates. It does not automatically retry writes. Movie unwatch is direct; TV watched/unwatched actions use the in-page series confirmation.

Switching Chrome windows or changing tab visibility does not make a status request or rebuild these controls. Confirmed extension updates are sent to open Google tabs without remounting buttons. Changes made through other Trakt apps are not polled continuously; refresh the search page to reread them (a recent 60-second cached status can still be reused).

Identification uses the knowledge panel's exact IMDb rating link and then an exact-ID Trakt lookup. No title-search guesses are used. Both native Google controls must be recognized unambiguously; otherwise they remain untouched. This replacement currently recognizes Lithuanian and English labels. Google markup changes, account/region differences, and missing title IDs can make it unavailable.

## Settings

Click the extension toolbar icon or open **Details → Extension options** in `chrome://extensions`. Preferences save automatically on this Mac and apply to open pages. Controls include site/destination visibility, compact icons, website link tab choice, right-click shortcuts, automatic Nuvio handoff, master pause, and the new Trakt control switch.

**Reset defaults** resets preferences only; it does not disconnect Trakt or modify your account. **Disconnect locally** on the connection page removes saved tokens on this Mac. Revoke the app in Trakt's connected-app settings to invalidate access everywhere. Site switches control UI; Chrome manages actual host permissions.

## Existing navigation shortcuts

- **Trakt:** Nuvio and exact IMDb actions in the title action bar, hidden until the native bar and title metadata are ready. TMDB IDs come from the exact summary response, existing read-only title cache, or external link; IMDb fallback is supported.
- **IMDb:** Nuvio and Trakt actions above the native Add to Watchlist control on supported movie/series title pages. Episodes, games, and title subpages are excluded.
- **Google:** Nuvio, Trakt, and IMDb actions under a recognized movie/series watch panel, or the IMDb ratings card. Supported hosts are google.com, google.lt, and google.co.uk, with/without www. The exact IMDb rating link supplies identity; opaque Google redirects are resolved by the service worker without cookies or referrer.
- **Right-click supported links:** choose Open in Nuvio. IMDb links require an explicit movie/series choice. Trakt links resolve in an inactive temporary title tab that is closed afterward unless you activate or navigate it. The local launcher leaves an explicit link if the automatic Nuvio handoff is blocked.

Launch Nuvio once from Applications if macOS does not recognize `nuvio:` links. Chrome may ask you to confirm opening Nuvio. The extension opens title details, not playback. Trakt may lack a title or require sign-in; a previously tested signed-out Breaking Bad IMDb-keyed Trakt route displayed a 404.

## Privacy and permissions

Code and icons are bundled locally. No analytics, backend, remote code, cookie API, or browser-history API access. Required API permissions: `contextMenus`, `storage`, and `identity` (for the OAuth browser flow). Existing Google/IMDb/Trakt host grants support page integration and title resolution. The new API and authentication host grants are optional and requested when you click Connect Trakt.

Preferences, the public Client ID, and OAuth tokens are saved in Chrome's local extension storage, not synced. Tokens are used by the background worker for Trakt requests and are never sent in messages to Google pages or inserted in their DOM. Trakt receives exact title IDs and account actions through its API. Google does not receive Trakt API tokens. The extension reads watched/watchlist state needed for these controls; it does not export a history archive. Runtime state and title lookups are held in memory. Disconnect removes the saved connection, while preferences remain.

The Trakt bridge reads only exact title summaries from existing responses and read-only cache transactions. It does not create or mutate Trakt's IndexedDB or forward website cookies/tokens. Normal Trakt lookup tab loads still use Chrome's existing website session. The Nuvio icon is based on the user-supplied installed app icon; the Trakt icon is bundled from the requested Homarr source. Independent project, unaffiliated with Trakt, Google, IMDb, or Nuvio.

## Backups and verification

Your original 1.2.0 ZIP and verified extracted backup remain in `backups/open-in-nuvio-1.2.0/`. Previous release ZIPs are retained. See `SHA256.txt` and `TEST-REPORT.md`.

Logic and browser fixtures simulate Trakt accounts and never change your real watch history/watchlist. Actual Trakt registration, OAuth authorization, signed-in API reads/writes, native Chrome popup/permission behavior, and Nuvio handoff require verification with your installed extension after account setup.

## Reference

- [Trakt authentication](https://developer.trakt.tv/docs/authentication-oauth)
- [Trakt PKCE](https://developer.trakt.tv/docs/pkce)
- [Trakt app registration requirements](https://developer.trakt.tv/docs/create-an-app)
- [Trakt API reference](https://trakt.docs.apiary.io/)

## Community release configuration

A separate public-app configuration is prepared in `open-in-nuvio/trakt-config.js`. It is intentionally blank in this personal build, so your saved connection is unchanged. See `COMMUNITY-RELEASE.md`. Once a release app Client ID is configured, the connection page hides developer setup and users only click Connect Trakt and approve access. Activation-code login also requires an app Client ID; PKCE remains the recommended browser flow.

## Alternate Google movie panels (1.5.6)

Panels opened through a film carousel can omit the IMDb ratings card. The extension now also accepts a unique IMDb search-result heading whose title/original-title alias and release year match the selected panel. If no such link exists, connected Trakt controls can use an authenticated Trakt search with the panel's title aliases, year, and movie/show type, requiring one exact title match with a verified year. Original-title aliases are read only from paired title text within Google’s knowledge-panel material, not arbitrary organic result snippets. Ambiguous or incomplete matches are rejected. A year discrepancy is rejected unless the separate one-year/director rule below applies.

This fallback sends the selected panel’s title aliases and release year to Trakt. It requires your existing Trakt connection and enabled Trakt controls when Google provides no usable exact IMDb link. No extra developer credentials or permissions are required. Old panel metadata is blocked during query transitions.

The carousel fallback also reads an original-title sentence from Google’s retained original-language About text when its year matches the selected panel, and explicit localized/original-title pairings in a Wikipedia result whose heading is the selected localized title. Trakt searches now include translated titles/aliases, and a localized-only match must be confirmed against Trakt’s returned translations with the same media type and year. Merely being the first search result is insufficient.

## Couture and Shark Tale catalog corrections (1.5.6)

Numeric parenthetical years are no longer treated as alternate movie names. The actual primary title can still be numeric (for example, 1917). Canonical exact-name candidates take priority over unrelated fuzzy search results.

Google lists Couture as 2025 while Trakt lists it as 2026. A one-year discrepancy can now be accepted only when the title matches exactly and the selected panel’s director matches an actual Director credit returned by Trakt. A two-year discrepancy, missing director, or different director is rejected. This rule uses catalog metadata, not a hardcoded mapping for Couture.

When a connected Trakt fallback fails, an inline error with Retry appears in the watch section rather than failing silently. No window-focus retries were added.

## Gia and title-search diagnostics (1.5.7)

IMDb result headings such as “Gia (TV Movie 1998)” now work with the original title retained in Google’s About description. Movie/series labels and release years are checked before accepting an organic IMDb result.

Fallback Trakt searches read up to five pages per alias. An excessively broad localized alias no longer blocks a complete original-title search with a matching canonical title. Multiple exact IDs remain rejected. Retry clears only the current failed lookup and tries again; it does not change watched history or watchlist membership.

## Idle processing improvement (1.5.8)

Google searches no longer rescan the document on every idle timer tick when no movie panel exists. The DOM observer still mounts late/replaced panels; a lightweight URL check retains dynamic navigation support.

## Keyboard shortcut and tooltips (1.6.0)

The suggested shortcut is **Command+Shift+Y** on macOS (**Ctrl+Shift+Y** elsewhere). It opens the current resolved movie or series from Trakt, IMDb or a supported Google movie/series panel in Nuvio. Site switches and master pause apply. The shortcut does not depend on right-click shortcuts or a visible Nuvio destination button. If a title has not finished resolving, wait for its buttons to appear and try again.

Open extension settings → **Keyboard shortcut → Change shortcut…** to assign any Chrome-supported combination in Chrome’s shortcut editor. The settings card displays the actual registered shortcut or “Not assigned” if Chrome could not bind it or you removed it. Chrome/OS shortcuts and other extensions may take priority. No additional permission is requested.

IMDb tooltips now read just “Open tt… in Nuvio Desktop” or “Open tt… in Trakt”. Compact mode no longer prepends duplicate text. Trakt’s Nuvio hover uses a compact dark bubble without technical IDs or a second browser tooltip. Google navigation tooltips describe the title and destination.

## Trakt tooltip styling (1.6.1)

Resolved-title hover text now uses Trakt’s compact tooltip variables for font size, weight, padding, radius, colours, shadow and layer. The status paragraph inherits that typography instead of overriding it. Pending lookup help remains wrapped using the regular tooltip sizing.

## Trakt button sizing (1.6.2)

Trakt compact buttons use the site’s `--ni-40` size (40px fallback), `--ni-6` padding, medium corner radius and transparent flat style with a 30% inset accent ring. Hover uses an accent tint. IMDb and Google retain their 44px compact buttons.

## Loading stability and tooltips (1.6.3)

IMDb retains the verified media type for the current route through temporary metadata/watchlist loading gaps. A changed title clears it; explicit unsupported types remain excluded. Removed controls are repaired immediately when their replacement is available. IMDb tooltips are simply “Open in Nuvio Desktop” and “Open in Trakt”. Trakt’s IMDb action has a matching compact “Open in IMDb” tooltip on hover and keyboard focus.

## Adaptive button appearance (1.7.0)

Open extension settings → **Look & navigation → Button appearance**:

- **Automatic:** labels when the container has room; compact icons when space is limited. Resizing the container updates the buttons without a page reload. On Trakt, available space accounts for the existing action buttons.
- **Labels:** always retain button text.
- **Compact:** always use icons, with tooltips and accessible labels retained.

Existing saved Compact preferences migrate to Compact; saved non-compact preferences migrate to Labels. Choose Automatic to opt in after upgrading. New installations and Reset defaults use Automatic. A 16px return buffer prevents repeated toggling close to the fit threshold. Adaptive layout uses ResizeObserver and does not make API requests or add layout polling.

## Storage hardening and release candidate (1.7.1)

Reload the extension **and refresh all supported tabs** after updating: content scripts now load display preferences through the worker instead of accessing local extension storage. OAuth tokens remain in trusted extension storage; existing saved settings and personal connection are not migrated or removed. Live settings still apply to open pages. If the preference bridge is unavailable, controls stay paused until the extension/page is reloaded.

Known Trakt titles now reuse the memory result without another IndexedDB scan. Privacy policy and support links are available in the popup. Original code is licensed MIT; third-party artwork/trademarks have separate notices. Community release still requires the dedicated release app and final redirect/extension ID configuration, plus the installed-build smoke test in release/SMOKE-TEST.md.

## Google language and native layout update (1.7.2)

Google watched/watchlist actions are recognized by structural action markers or known SVG shapes, not a list of translated words. Labels for both selected and unselected states come directly from the page. The replacement retains Google’s layout classes, with a purple Trakt subtitle styled like the provider’s subtitle. Ambiguous or unrecognized controls are left untouched. This covers languages on recognized layouts, not every possible future Google redesign. The navigation-button styling is unchanged.
