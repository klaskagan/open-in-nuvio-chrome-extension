# 1.7.2 — Google language and native layout validation

Date: 18 October 2026.

- Full Node regression suite: 664 checks passed, empty stderr. Includes 127 new checks for native control detection, 11 label sets (Latvian, Russian, English, Lithuanian, German, French, Spanish, Arabic, Japanese, Chinese and an unknown/mixed-script set), selected/unselected label reuse, SVG fallback, ambiguous controls, Google event isolation, exact-once keyboard activation, optimistic state, rollback and restoration.
- Browser layout checks: 13 comparisons passed at the normal viewport, 13 in a 400px viewport, and 13 in a 400px RTL viewport. A sanitized Google Latvian panel and its matching CSS/custom properties were recorded from the public live page. Geometry compares original versus replacement column widths, circle sizes/positions and label typography/margins; subtitle metrics match the native provider subtitle with the Trakt purple retained. A real browser click also verified selected native label reuse.
- Open-in-Nuvio/Trakt navigation-button code and styling were not changed. Only google-trakt.js and the manifest version changed in runtime source.
- Candidate Store and unpacked ZIPs verified for archive integrity, version 1.7.2, bundled public app configuration, runtime byte equality and expected public-key-derived extension ID. The submitted 1.7.1 Store ZIP remains byte-for-byte unchanged.

Tests use simulated Trakt responses and do not write real account history/watchlists. Browser geometry checks use a captured native-layout fixture, not an installed extension running in the user's Chrome session. Final installed-Chrome testing of the 1.7.2 candidate remains appropriate before a Store submission. The existing 1.7.1 GitHub release assets were not replaced.

No production translation table was added. Support is language-independent on recognized Google control layouts; ambiguous or redesigned controls are left untouched. Tooltips, error messages and series confirmations retain their existing language behavior.

## Italian live-page follow-up

The user's Chrome page used IMDb links at `/it/title/tt0816692/`, which the canonical-path-only parser rejected. The parser now accepts optional locale prefixes while retaining HTTPS, host and exact-title-path validation. Added 11 parser checks and 7 end-to-end assertions using a sanitized fixture captured from that actual page. The full suite now passes 682 checks.

The development installation was updated in place. After the user reloaded the extension, the actual Italian Chrome page displayed both navigation buttons and localized Trakt controls, and the authenticated status settled to watched=true/watchlist=false. No history/watchlist writes were performed in the user's account. This follow-up has not been packaged or published as a new release.
