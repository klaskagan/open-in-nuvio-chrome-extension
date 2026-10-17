# 1.7.1 — release candidate preparation

- Restricted Chrome local extension storage to trusted contexts; added a read-only, origin/frame-validated content preference bridge and sanitized live settings broadcasts.
- Failed content preference reads keep controls paused rather than silently enabling default settings.
- Known Trakt title IDs reuse the in-memory result instead of rescanning IndexedDB. Bounded the title alias cache.
- Added MIT license, support contact, privacy page/policy, third-party notices and store/source packaging instructions.
- Added trusted-storage regression tests and release preflight checks. Benchmarked adaptive layout and idle processing.

Dedicated release Trakt app and final store extension ID remain publisher configuration steps. Existing personal development configuration is retained locally.
