# Validation — 1.7.1 — 17 October 2026

537 passing assertions, clean stderr. Fresh `npm ci --ignore-scripts` lockfile installation in scratch storage, Node 24.19.0. npm audit reported zero vulnerabilities among the 60 audited development packages at test time; these libraries are not bundled in the extension. Full output: `validation/results-1.7.1.txt`.

## Performance

| Synthetic benchmark                                 | Result                              |
| --------------------------------------------------- | ----------------------------------- |
| Google/IMDb/Trakt stable idle, 100 timer ticks each | 0 document queries each             |
| Google idle callback time                           | 15.74 ms / 100 ticks                |
| IMDb idle callback time                             | 0.38 ms / 100 ticks                 |
| Trakt idle callback time                            | 19.17 ms / 100 ticks                |
| Adaptive unchanged width, 1,000 notifications       | 0 computed-style reads; 0.86 ms     |
| Adaptive alternating widths, 100 notifications      | 100 computed-style reads; 125.19 ms |
| Adaptive network requests                           | 0                                   |

Measurements are single-run Node/jsdom callback benchmarks, not Chrome page-load timings, user-visible latencies or battery estimates. Each idle benchmark uses 4,504 elements and synchronously invokes the timer count equivalent to 20 seconds. Stable processing retained zero document scans after the adaptive feature. Width callbacks with unchanged dimensions bail out; actual resize events perform bounded local style work.

Raw evidence: `validation/performance-1.7.0.jsonl`, `validation/performance-idle-1.7.1.jsonl`, `validation/performance-adaptive-1.7.1.json`. Reproduce with `npm run benchmark --prefix validation` from the source snapshot.

Known Trakt metadata now short-circuits subsequent IndexedDB scans. A regression test confirms the repeated request makes no new database enumeration. Alias records are capped after insertion.

## Storage hardening

Tests verify TRUSTED_CONTEXTS setup, approved top-frame origins, rejected foreign/HTTP/subframe/unsupported senders, one initial content preference message, zero direct content storage reads, no credential forwarding, no content writes, live pause/resume, deduplicated broadcasts, no broadcasts on credential changes, preserved saved credentials and fail-closed unreadable preferences. Existing source tests exercise OAuth, refresh, direct/queued writes and status caching with synthetic account data.

## Browser suites

Seven local suites passed in the in-app browser: adaptive layout, actual content-settings adapter integration, IMDb hydration frame sampling, idle/recovery, settings persistence, Couture identity and Shark Tale identity. Browser suite: `validation/release-browser-tests.html`. APIs/accounts are simulated or recorded public responses. Preview: `release-regression-preview-1.7.1.png`.

## Packaging

JavaScript syntax, manifest references, PNG dimensions, local HTML resource references, absence of remote script tags, license/privacy/support files, root-manifest store package and non-overwriting builder behavior verified. Store builder tested with a clearly synthetic public-ID fixture; personal configuration unchanged. Original 1.2.0 backup hash remains verified.

## Limits

The actual installed Chrome browser is not connected to this agent. These results do not prove final-store-ID OAuth, actual worker suspension/browser restart or real Nuvio handoff. No private Trakt tokens were read for these tests and no real account mutations were made. See `PRODUCTION-READINESS.md` and `release/SMOKE-TEST.md` for final publisher checks and app/branding configuration.
