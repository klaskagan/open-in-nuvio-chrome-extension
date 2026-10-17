# Contributing

The `open-in-nuvio/` directory is the editable source and can be loaded directly in Chrome. There is no transpilation, bundling, or minification step. Store packaging copies these files and injects only the public release Trakt Client ID. Keep source readable; do not commit minified copies.

## Set up

Use Node.js 20 or newer. From the repository root:

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix validation
npm run format:check
npm test
```

The root package pins Prettier for development; the validation package pins the test dependencies. Neither package is shipped in the extension. Python 3 is needed only for the optional release ZIP builder.

## Find the code

| Files                                                             | Responsibility                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `open-in-nuvio/manifest.json`                                     | Permissions, script order, worker, popup and keyboard command            |
| `content.js`, `core.js`, `bridge.js`                              | Trakt page controls, identity parsing and matching cached title metadata |
| `imdb.js`                                                         | IMDb controls and resilience during page hydration                       |
| `google.js`, `google-core.js`                                     | Google panel detection and title identity                                |
| `google-trakt.js`, `series-confirm.js`                            | Optimistic watched/watchlist controls and series confirmation            |
| `trakt-api.js`, `trakt-account.js`, `trakt-config.js`             | Trakt API, OAuth, account UI and public app configuration                |
| `settings.js`, `content-settings.js`, `storage-bridge.js`         | Preferences and trusted-context storage boundary                         |
| `background.js`, `context-menu.js`, `link-core.js`, `shortcut.js` | Worker routing, right-click resolution and keyboard shortcut             |
| `popup.*`, `trakt.*`, `launch.*`, `privacy.html`                  | Extension pages and their styles                                         |
| `button-icon.js`, `icons/`                                        | Embedded image data and original image assets                            |
| `validation/`                                                     | Regression tests, local browser harnesses and public catalog fixtures    |
| `release/build-release.py`                                        | Root-manifest Store ZIP creation                                         |

Embedded base64 image strings in `button-icon.js` are asset data, not minified application logic. They remain long because inserting line breaks would change the string. Use the corresponding PNG assets for visual inspection. Runtime style/template strings are also preserved to avoid changing the UI during this formatting pass.

## Edit and check

1. Edit the source files directly. Use two spaces and the committed formatter configuration. An editor with Prettier support can use the local pinned version on save; format-on-save is optional.
2. Run `npm run format`, then `npm run format:check` and `npm test`. For performance-related changes, run `npm run benchmark` too.
3. Reload the extension at `chrome://extensions`, then refresh supported pages. Existing tabs otherwise keep the old content scripts. Test actual Nuvio handoff and signed-in OAuth separately from the simulated tests.
4. Review the diff and commit the source, tests and relevant documentation. Never commit passwords, access/refresh tokens, Client Secrets, private keys or personal connection storage.

Recorded fixtures under `validation/fixtures/` and upstream license texts are excluded from formatting. Prettier uses strict HTML whitespace handling and does not reformat embedded template languages, keeping this pass focused on source layout.

## Release boundaries

The submitted Store version is 1.7.1. Formatting this repository does not replace the already-submitted ZIP and does not require a new Store upload. Preserve that exact archive for review traceability. Bump the manifest version for the next Store update, and test its packaged build before submission.

The ordinary development configuration has a blank public app ID. Use the account setup UI for your development app or the release builder for a publisher-configured build. A different unpacked folder normally produces a different extension ID; OAuth redirect registration must match that ID. A Store public key can preserve the release ID for local testing, but do not replace your personal development installation accidentally.
