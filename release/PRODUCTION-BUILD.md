# Readable source and production builds

## Current decision

Keep editable source readable in GitHub. Minification is optional for a production extension, not a prerequisite for publishing or evidence of better runtime performance.

The current `build-release.py` copies source files into a compressed ZIP and injects the public release Trakt Client ID. It does **not** minify JavaScript, CSS or HTML. There is no `--minify` flag or minified build command today. The already-submitted 1.7.1 package must remain unchanged for review traceability.

Chrome permits minification but prohibits obfuscation or concealing functionality: https://developer.chrome.com/docs/webstore/program-policies/code-readability

## Performance expectations

Minification reduces script text size and can reduce parsing work. It does not by itself reduce DOM scans, API latency, timers or event-handler work. Extension scripts are installed locally, and the existing ZIP already compresses repeated whitespace well. Do not assume minification will noticeably improve this extension's responsiveness; compare actual generated packages and installed-browser measurements first.

For this extension, efficient page observation, title resolution, cache behavior and optimistic UI updates remain the more directly relevant performance work. Keep readable releases as the default until a measured benefit justifies a build transformation.

## Current release workflow (implemented)

From the repository root:

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix validation
npm run format:check
npm test
npm run benchmark
python3 release/build-release.py --client-id PUBLIC_RELEASE_CLIENT_ID --output dist/open-in-nuvio-store.zip
```

Replace the placeholder with the release application's public Client ID. Never supply a Client Secret or account token. Choose a fresh output filename for each candidate: the builder refuses to overwrite existing artifacts.

Extract the exact candidate into an isolated test directory and run the regression tests against that extracted runtime, not only against the editable source. The existing validation scripts resolve `../open-in-nuvio`; arrange a separate workspace with the extracted package at `open-in-nuvio/` and a copy of `validation/` alongside it. The source-only blank-Client-ID preflight assertion must be distinguished from the packaged-build check, which should instead verify the intended public release ID. Do not modify the candidate's account configuration merely to make a source-only assertion pass.

Perform the installed Chrome OAuth, worker lifecycle, page navigation and actual Nuvio smoke checks in `SMOKE-TEST.md`. For release-ID OAuth testing, add the Store public key only to a separate local test copy and verify its derived ID matches the Store entry. Document any manifest-only test metadata difference.

Record the source commit, manifest version, public build configuration and ZIP SHA-256. Review the resulting package, then upload that exact tested ZIP. Bump the manifest version for the next Store update. Formatting source on GitHub alone does not require replacing an in-review Store package.

## Optional future minified pipeline (not implemented)

If measurements justify minification, implement and review these steps before making it a release option:

1. Pin a minifier and its dependencies in the development lockfile. Keep it out of the shipped extension. Use a supported Node version and a reproducible configuration.
2. Copy `open-in-nuvio/` to a fresh, ignored staging directory under `dist/`. Inject only public release configuration there. Never rewrite editable source.
3. Minify each runtime JavaScript file independently, preserving filenames, script order, execution worlds and the service worker structure. Start conservatively with name mangling and optimization/compression transformations disabled; preserve globals, public property names and required license notices. No obfuscation, runtime unpackers or remote code.
4. Keep CSS and HTML unchanged initially. Removing whitespace in HTML or embedded templates can change visible text, layout or DOM structure. Add those transformations only with separate validation and a measured reason.
5. Generate local source maps for debugging, retain them with the corresponding commit/build evidence, and decide explicitly whether maps belong in the uploaded package. Source maps help debugging but do not replace readable GitHub source or tests.
6. Add a documented build option and package verification that checks file references, permissions, public configuration, license notices and absence of secrets. Keep draft-listing builds clearly separate from submit-ready builds.
7. Run regression tests against both source and extracted generated output. Adapt source-text assertions to check behavior or parsed structure, rather than compact spelling. Do not disable meaningful checks to accommodate a minifier.
8. Compare compressed ZIP size, unpacked script size, installed Chrome parse/evaluation time and interaction behavior against a readable build from the same commit. Use repeated runs under comparable conditions and report differences without equating smaller bytes with faster UI.
9. Complete the installed release-ID OAuth/Nuvio smoke test on the generated candidate, record tool versions/configuration and artifact hashes, and upload only that candidate.

Generated bundles and staging directories stay out of Git. Keep the readable source and lockfiles in Git; distribute versioned release ZIPs as release artifacts. Document the exact build command once the option exists. Until then, use the implemented readable build above.
