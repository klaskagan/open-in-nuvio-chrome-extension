# Release preparation

This is a local release-candidate preparation, not a published Chrome Web Store release.

## Files

- `PRIVACY.md`: policy text with support contact; publish at a public URL before store submission.
- `STORE-LISTING.md`: listing text, scope/limitations and permission explanations.
- `build-release.py`: creates a store ZIP with manifest.json at its root, injecting only the dedicated release app's public Client ID into that archive. It does not change the personal development build.

## App identity versus account identity

The Client ID identifies the application. The OAuth tokens identify the user account that authorized it. A developer's own Trakt account is not automatically shared with extension users. Each community user gets separate tokens on their own Chrome profile.

Use a dedicated community-release Trakt app so development can continue without changing public redirect/auth configuration. The development build retains its saved personal app configuration. No Client Secret or account token belongs in the source, store ZIP, screenshots or support reports.

## Remaining external steps

1. Create the separate release Trakt app. Suggested name: `Open in Nuvio — Trakt, IMDb & Google`. Description: `Open exact titles in Nuvio and manage Trakt watched/watchlist status from supported title pages.`
2. Obtain the final Chrome Web Store extension ID from a draft listing. Use the supplied `open-in-nuvio-1.7.1-draft-listing.zip`, or build it with `python3 release/build-release.py --draft --output dist/draft-listing.zip`. This archive has no release Client ID and is only for draft creation; do not submit it for publication. Register its exact `https://EXTENSION_ID.chromiumapp.org/trakt` redirect in the release Trakt app. Terms/registration steps must be completed by the publisher.
3. Build the final store ZIP: `python3 release/build-release.py --client-id PUBLIC_RELEASE_CLIENT_ID --output dist/open-in-nuvio-store.zip`. Run from the source repository root. Never pass account tokens or a Client Secret.
4. Test the resulting build under the final extension ID: connect/cancel, reconnect, permission denial, token refresh, browser restart/worker suspension, multiple tabs and Nuvio launch. Use a disposable/test title for any history changes.
5. Confirm Nuvio artwork redistribution/branding permission. Homarr's repository Apache-2.0 license is included for the sourced Trakt icon; third-party trademarks are not relicensed by this project's MIT license.
6. Publish the GitHub repository/privacy policy, finish store disclosures and add real screenshots. Upload/submit only after checking the final package.

The build tool rejects invalid-shaped IDs and existing output paths, but cannot determine whether a string is actually the intended public Client ID. Verify it in Trakt's application settings.
