# Community release setup

The extension now separates the developer's one-time app setup from an installer's account connection.

1. Create a dedicated Trakt API app for the community release. Keep the current personal app unchanged.
2. Establish the release extension ID (normally through its Chrome Web Store listing). Register the exact `https://RELEASE_EXTENSION_ID.chromiumapp.org/trakt` redirect in the release Trakt app. The actual extension connection page displays its redirect. Unpacked copies installed at different paths can have different IDs.
3. Put the release app's **public Client ID** in `open-in-nuvio/trakt-config.js`. This is a developer build setting, not an end-user step. Never put a Client Secret, account access token, or refresh token in that file.
4. Build/package the extension and test the final release ID's complete authorization flow. With a configured release ID, the connection page hides developer fields; users press **Connect Trakt**, allow the API permission, and approve the app on Trakt. Each user gets separate tokens stored locally.

The current personal build leaves the release Client ID blank and preserves your saved personal connection. Configuration support has been tested with a synthetic public app ID, not a live release app. No listing was created or published.

## Why keep PKCE instead of activation codes?

[Trakt's authentication documentation](https://developer.trakt.tv/docs/authentication-oauth) describes both authorization-code and device-code flows. Both belong to a registered API application. Visiting the activation page is not a credential-free substitute for app registration. An activation-code user typically still needs to copy/enter a code and approve access.

[Trakt recommends PKCE](https://developer.trakt.tv/docs/pkce) for browser-capable apps. A public Client ID can be bundled safely; PKCE avoids shipping a Client Secret. For this Chrome extension, the existing Connect → approve flow can therefore provide simple authorization without making each user become a developer. Device-code login is not implemented in this release.

## Release preparation status (1.7.1)

Use a dedicated release app; keep the personal app for development. The Client ID identifies the app, while each user's OAuth tokens identify their own Trakt account. Community users will not need API-app registration once the publisher configures the release build.

MIT licensing, support contact (klaskagan@gmail.com), privacy text/page, store listing draft, third-party notices and a root-manifest store packaging tool are prepared. See release/README.md. The actual dedicated release app ID and final store extension ID are still unset; no public package is claimed to have passed final OAuth testing.
