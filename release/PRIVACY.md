# Open in Nuvio privacy policy

Updated: 17 October 2026

Developer and support: klaskagan — klaskagan@gmail.com

Open in Nuvio adds title-navigation buttons to supported Trakt, IMDb and Google Search pages and optionally lets you update your Trakt watched history and watchlist.

## Information used

The extension reads the current supported page's movie or series identifiers, title, year, media type and, when needed to disambiguate a title, director names. On Trakt it can read matching title-summary entries from Trakt's existing local browser cache. It does not forward unrelated cache entries or Trakt website authentication credentials.

If you enable Trakt integration and connect your account, it stores the OAuth access and refresh tokens issued for your account, together with the application's public Client ID, in Chrome's local extension storage. It reads your watched progress and watchlist as needed to display and update the selected title's state. These credentials are restricted to trusted extension contexts; content scripts receive display preferences through a read-only message.

Settings are stored locally on this Chrome profile, not in Chrome Sync. Small title/status caches are used to avoid duplicate requests. The extension does not run analytics, advertising, tracking pixels or a developer-operated data collection server. It does not intentionally collect unrelated browsing history.

## External requests and actions

Title resolution may request a Google redirect to identify its destination, or send title identifiers/title metadata to Trakt's API. Google redirect resolution omits browser cookies and referrer information. OAuth/API requests go to Trakt's authentication/API services over HTTPS. Trakt receives your access token for authenticated operations.

When you click a destination link or use the Nuvio shortcut, the selected identifier is sent to that destination or handed to the installed Nuvio application. Right-click resolution may open a temporary Trakt tab. Normal navigation to third-party websites follows their cookie and privacy settings.

Trakt watched/watchlist changes occur when you request them. Marking a movie unwatched removes all its recorded viewings. Series actions require confirmation and apply to the confirmed aired episodes in regular seasons, excluding specials. Trakt and other destinations handle received data under their own policies. Their servers may receive routine connection information such as IP address.

The developer does not sell user data, use it for advertising, or share it with third parties for unrelated purposes. The extension's use of information is limited to the user-facing functions described here, consistent with the Chrome Web Store User Data Policy, including its Limited Use requirements.

## Control and retention

You can pause the extension, hide buttons by site/destination, disable Trakt controls or change appearance in settings. Chrome manages site permissions and keyboard shortcuts. Disconnect locally removes this extension's stored Trakt credentials; revoke the app in your Trakt account to revoke authorization at Trakt. Uninstalling removes Chrome local extension storage. Short-lived in-memory caches expire or clear when the worker/page closes. Trakt may retain history/watchlist changes until you remove them in Trakt or request another change.

If you email support, the developer receives whatever you choose to include. Do not send access tokens, refresh tokens, client secrets or account passwords. Questions or deletion requests about support correspondence can be sent to klaskagan@gmail.com.

## Changes

This policy will be updated when the extension's data handling changes. The latest published policy should match the version distributed through the Chrome Web Store.
