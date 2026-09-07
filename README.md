# JavRanking browser extension

An open-source browser extension that identifies video codes on the active page and shows matching JavRanking catalogue information. It runs only when the user clicks the browser action.

## Install a release in Chrome or Edge

1. Download the Chromium ZIP from [GitHub Releases](https://github.com/aizhimou/javranking-extension/releases).
2. Extract the archive to a permanent local folder.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable **Developer mode**, select **Load unpacked**, and choose the extracted folder that contains `manifest.json`.

Updates are manual: download and extract the new release, then use **Reload** on the extension's card or load the new folder.

Firefox is supported for development through a temporary load. Persistent Firefox distribution requires a Mozilla-signed XPI and is not currently published.

## Verify and build from source

Requires Node.js 20.19 or later.

```sh
npm ci
npm run compile
npm test
npm run build
npm run zip
```

The production ZIP is written below `.output/`. Build artifacts are intentionally not committed. You can inspect the tagged source, build it locally, and compare its SHA-256 checksum with the release asset.

## Privacy

The extension reads the active top-level page only after a user click. It does not transmit or persist page URLs, page text, DOM content, video-code candidates, or browsing activity. It fetches JavRanking's published static search index to find matches.

See [the extension design document](docs/browser-extension.md) for the complete product, data-contract, privacy, compatibility, and release specification.

## License

[MIT](LICENSE)
