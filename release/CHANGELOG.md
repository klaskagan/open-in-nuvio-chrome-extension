# 1.7.2 — Google localized controls

- Detect watched/watchlist controls through Google action markers, with SVG-shape fallback, rather than translated label matching. Reuse native unselected and selected labels in any language supported by the recognized Google panel layout.
- Preserve native layout classes and column positions. Match Trakt subtitle typography/spacing to the provider subtitle while retaining purple text.
- Replace font-dependent bookmark glyphs with outline/filled SVG icons.
- Strip Google handlers and duplicate IDs from the replacement; mouse and keyboard actions go only to Trakt. Preserve optimistic updates, rollback, series confirmation and restoration on disable/navigation.
- Added a sanitized native Latvian panel fixture, multilingual regression checks and browser geometry comparisons. Open-in-Nuvio/Trakt navigation buttons are unchanged.

The submitted 1.7.1 Store ZIP and published 1.7.1 assets are unchanged. This is a new candidate; reload/refresh pages after installing it.

# 1.7.1 — release candidate preparation

- Restricted Chrome local extension storage to trusted contexts; added a read-only, origin/frame-validated content preference bridge and sanitized live settings broadcasts.
- Failed content preference reads keep controls paused rather than silently enabling default settings.
- Known Trakt title IDs reuse the in-memory result instead of rescanning IndexedDB. Bounded the title alias cache.
- Added MIT license, support contact, privacy page/policy, third-party notices and store/source packaging instructions.
- Added trusted-storage regression tests and release preflight checks. Benchmarked adaptive layout and idle processing.

Dedicated release Trakt app and final store extension ID remain publisher configuration steps. Existing personal development configuration is retained locally.
