# Final installed-build smoke test

Use the final Chrome extension ID and public-release Trakt app, after automated tests pass.

- Fresh Chrome profile: Load/install the candidate, confirm version, and test supported Trakt movie and series pages. Buttons stay in the action bar while loading and on navigation.
- IMDb: test movie, series, page reload and same-tab navigation; verify no loading flicker and no actions on episodes/games. Resize the layout and test all appearance modes.
- Google: test movie/series panels, Lithuanian carousel navigation, ambiguous title Retry, and unsupported results. Check that old-title buttons cannot act on a newly selected title.
- Nuvio: test button, keyboard shortcut and right-click launcher. Chrome may ask to open the external application. Test actual Nuvio title identity, not just URL construction.
- Trakt OAuth: cancel once, authorize, reconnect, deny optional permission, then grant it. Verify the signed-in account belongs to the tester. Never paste account tokens into a bug report.
- Use a disposable/test title: watchlist on/off, movie watched/unwatched, series Cancel and Confirm. Series unwatch removes viewing history; do not test destructive actions on history you want to keep. Verify the intended result in Trakt.
- Return from another window, suspend/wake the extension worker, restart Chrome, and open the same title in two tabs. Settings and connection persist; focus alone does not reload controls. Confirm live preference broadcasts after worker restart.
- Simulate offline/429/API failure with test tooling or mocks: errors remain local, failed operations roll back and writes do not automatically repeat. Confirm no credentials are accessible through content-script local storage.

No box is pre-marked complete: automated fixtures do not prove the final signed-in store build has passed these steps.
