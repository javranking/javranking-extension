# JavRanking browser extension

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md)

The JavRanking browser extension identifies video codes on the active page after you click its browser toolbar icon, then shows matching JavRanking ranking information.

![screenshot](https://pub-46be2c0b616d4f749dab2ccd9deb9827.r2.dev/social-preview.png)

## Install in Chrome or Edge

1. Download the Chromium ZIP from [GitHub Releases](https://github.com/aizhimou/javranking-extension/releases).
2. Extract it to a permanent local folder.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable **Developer mode**, choose **Load unpacked**, then select the extracted folder containing `manifest.json`.

Unpacked extensions update manually: download and extract the new release, then choose **Reload** on the extension card or load the new folder. The extension displays an update notice at the top when GitHub has a newer version.

Firefox supports temporary development loading. Persistent installation requires a Mozilla-signed XPI, which is not currently published.

## Verify and build from source

Node.js 20.19 or later is required.

```sh
npm ci
npm run compile
npm test
npm run build
npm run zip
```

The production ZIP is written to `.output/`. Build artifacts are not committed. You can inspect a tagged source release, build it locally, and compare the resulting checksum against `SHA256SUMS.txt` in the GitHub Release.

## Privacy

The extension reads the active top-level page only after the user triggers it. It does not send or persist page URLs, page text, DOM content, video-code candidates, or browsing activity.

It fetches JavRanking's published static search index to find matches. Each time the extension UI opens, it also reads the latest release version from GitHub's public API. Neither request includes page or user data.

See the [extension design document](docs/browser-extension.md) for the complete product, static data contract, privacy, compatibility, and release specification.

## License

[MIT](LICENSE)
