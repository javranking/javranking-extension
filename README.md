# JavRanking 浏览器扩展

[简体中文](README.md) · [繁體中文](README.zh-TW.md)

JavRanking 浏览器扩展会在你主动点击浏览器工具栏图标后，识别当前页面中的影片番号，并展示可对应的 JavRanking 榜单资料。

## 安装 Chrome 或 Edge 版本

1. 从 [GitHub Releases](https://github.com/aizhimou/javranking-extension/releases) 下载 Chromium ZIP。
2. 将 ZIP 解压到会保留的本地文件夹。
3. 打开 `chrome://extensions` 或 `edge://extensions`。
4. 开启 **Developer mode**，选择 **Load unpacked**，再选择包含 `manifest.json` 的解压文件夹。

Unpacked extension 的更新需要手动完成：下载并解压新版后，在扩展卡片选择 **Reload**，或加载新的文件夹。当 GitHub 有更高版本时，扩展顶部会显示更新提醒。

Firefox 可用于 temporary development load；持久安装仍需要 Mozilla 签名的 XPI，目前尚未提供。

## 从源代码验证与构建

需要 Node.js 20.19 或更高版本。

```sh
npm ci
npm run compile
npm test
npm run build
npm run zip
```

production ZIP 会输出到 `.output/`。构建产物不会提交到 Git；你可以检查 tag 的源代码并自行构建，再用 Release 中的 `SHA256SUMS.txt` 比对文件校验和。

## 隐私

扩展只会在用户主动触发后读取当前顶层页面。它不会传送或保存页面 URL、页面文字、DOM 内容、番号候选或浏览活动。

它会读取 JavRanking 已发布的静态搜索索引来查找匹配项；每次打开扩展 UI 时，还会向 GitHub 公开 API 读取最新 Release 的版本号。两者都不包含任何页面或用户数据。

完整的产品、static data contract、隐私、兼容性与发布规范见 [extension design document](docs/browser-extension.md)。

## 许可证

[MIT](LICENSE)
