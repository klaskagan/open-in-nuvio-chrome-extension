# Production readiness — 1.7.1 release candidate — 17 October 2026

The local code, performance/regression review and release-preparation files are ready for publisher review. This is not a claim that a public store build has passed its final authorization/lifecycle smoke test. Nothing has been published.

## Completed

- Full regression suite: 537 passing assertions with clean stderr using a fresh lockfile dependency installation on Node 24.19.0. Coverage includes exact title identity, dynamic navigation, loading stability, OAuth mock flows, optimistic status, rollback, series confirmation, shortcuts, preferences, adaptive sizing, trust boundaries and release preflight.
- Seven in-app-browser fixture suites passed, including the new content-settings integration. Fixtures use simulated account/Chrome APIs; no private history/watchlist changes occurred.
- All stable idle benchmark cases make zero document queries over 100 timer ticks. Adaptive unchanged-width callbacks make zero computed-style reads across 1,000 notifications. Timings and limits are in TEST-REPORT.md.
- Restricted Chrome local extension storage to TRUSTED_CONTEXTS, with origin/frame-validated read-only content preferences and sanitized live broadcasts. Existing saved connection/configuration is preserved. Content preference failures pause controls.
- Known Trakt titles reuse memory instead of rescanning IndexedDB; title alias memory remains bounded.
- MIT license and support contact added. Privacy policy/page, third-party notices (including upstream Homarr Apache-2.0 license), listing draft, release guide and final smoke-test plan prepared.
- Store ZIP builder produces a root manifest, preserves personal configuration, requires a public Client ID for the final build and refuses to overwrite prior artifacts. A separate --draft mode is explicitly limited to creating a draft listing.
- GitHub-ready source snapshot includes code, tests/lockfile, license, privacy and release documentation. No personal Client ID or account tokens are bundled. Earlier packages and the original 1.2.0 backup are retained.

## Publisher steps still required

1. Keep a dedicated release Trakt API app, as recommended for ongoing development. Obtain the final store extension ID from a draft listing, register its exact chromiumapp.org/trakt redirect, and build with the release app's public Client ID. Each user connects their own account; the app ID is not the developer's account token.
2. Run release/SMOKE-TEST.md on the actual installed final-ID build: full OAuth authorization/cancellation/refresh, Chrome restart/worker suspension, optional permission denial, actual macOS Nuvio handoff and a disposable-title mutation. Installed Chrome is not connected to this agent; only the in-app browser is available.
3. Publish the privacy policy at a public URL (for example in the future public GitHub project), complete matching store disclosures, and add representative live-site screenshots. Source and a draft listing archive are prepared, not uploaded or submitted.
4. Confirm Nuvio icon redistribution/branding terms. Its upstream desktop repository declares GPL-3.0; the extension's original code is MIT, which does not relicense third-party artwork. Homarr license/attribution is bundled for the sourced Trakt icon; third-party trademark restrictions remain separate.

## Scope and behavior

macOS Nuvio Desktop; desktop Chrome 116+. Google .com/.lt/.co.uk; Trakt control replacement recognizes English/Lithuanian labels. External Trakt changes may need a page refresh; focus alone deliberately does not refetch status. Movie unwatch removes all recorded viewings; series changes confirm aired regular-season episodes and exclude specials. Site changes, ambiguous metadata and remote API latency can affect operation.

Official references: [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [Chrome Web Store user data](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), [Trakt OAuth](https://developer.trakt.tv/docs/authentication-oauth), [MIT](https://opensource.org/license/mit), [Homarr license](https://github.com/homarr-labs/dashboard-icons/blob/main/LICENSE), [NuvioDesktop](https://github.com/NuvioMedia/NuvioDesktop).
