# Install the GitHub download in Chrome

1. Download `open-in-nuvio-1.7.1-unpacked.zip` from the v1.7.1 GitHub release. Do not use GitHub's automatically generated Source code ZIP; it is a development snapshot with a different configuration.
2. Extract the download into a permanent folder. Keep the folder after installation; Chrome loads the extension from it. The folder you select must contain `manifest.json` directly.
3. Open `chrome://extensions`, enable Developer mode, click Load unpacked, and select the extracted folder.
4. Confirm the extension ID is `aeggebbbaihhinlioenldnclkkibcmkn`. The public key in its manifest preserves the release identity; it contains no private signing key.
5. Refresh any existing Google, IMDb and Trakt pages. Install Nuvio Desktop on macOS and allow Chrome to open Nuvio links when prompted.
6. Optionally open extension settings, click Connect Trakt, and authorize your own Trakt account. No API app registration or Client ID entry is needed. Enable Use Trakt controls on Google to use watched/watchlist actions.

The publisher's Trakt app must register `https://aeggebbbaihhinlioenldnclkkibcmkn.chromiumapp.org/trakt`. Correct build configuration alone does not prove the installed authorization flow has been tested. Report authorization failures without including tokens or passwords.

Use only one installation with this release ID in a Chrome profile. If a Store version or another release-ID test copy is already installed, use a separate Chrome profile for testing. Unpacked installations do not receive automatic Store updates. For a manual update, replace the contents in the same permanent folder with the next downloaded build, click Reload at chrome://extensions, then refresh supported tabs.

Chrome policy on managed/work computers can prevent unpacked extensions. The official Store install will be the recommended option once approved. Version 1.7.1 is currently awaiting Store review.

## Artifact identity

The GitHub unpacked ZIP is derived from the exact submitted Store ZIP. Its only changed file is `manifest.json`, which adds the Store public key. Runtime scripts, permissions, version, icons and bundled public Trakt app ID match the submitted build byte-for-byte. No account tokens, Client Secret or private key are included.

Submitted runtime source commit: `a06eefc891c5aeb7a49e66948b1a4c42ef7d7a6d`. Later source-formatting and documentation commits are available on main. This variant is packaged without changing the already-submitted Store archive.
