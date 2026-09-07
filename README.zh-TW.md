# JavRanking 瀏覽器擴充功能

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md)

JavRanking 瀏覽器擴充功能會在你主動點擊瀏覽器工具列圖示後，識別目前頁面中的影片番號，並顯示可對應的 JavRanking 榜單資料。

## 安裝 Chrome 或 Edge 版本

1. 從 [GitHub Releases](https://github.com/aizhimou/javranking-extension/releases) 下載 Chromium ZIP。
2. 將 ZIP 解壓縮到會保留的本機資料夾。
3. 開啟 `chrome://extensions` 或 `edge://extensions`。
4. 開啟 **Developer mode**，選擇 **Load unpacked**，再選取包含 `manifest.json` 的解壓縮資料夾。

Unpacked extension 的更新需要手動完成：下載並解壓縮新版後，在擴充功能卡片選擇 **Reload**，或載入新的資料夾。當 GitHub 有較高版本時，擴充功能頂端會顯示更新提醒。

Firefox 可用於 temporary development load；持久安裝仍需要 Mozilla 簽署的 XPI，目前尚未提供。

## 從原始碼驗證與建置

需要 Node.js 20.19 或更新版本。

```sh
npm ci
npm run compile
npm test
npm run build
npm run zip
```

production ZIP 會輸出至 `.output/`。建置產物不會提交到 Git；你可以檢查 tag 的原始碼並自行建置，再以 Release 中的 `SHA256SUMS.txt` 比對檔案校驗和。

## 隱私

擴充功能只會在使用者主動觸發後讀取目前頂層頁面。它不會傳送或保存頁面 URL、頁面文字、DOM 內容、番號候選或瀏覽活動。

它會取得 JavRanking 已發布的靜態搜尋索引以查找符合項目；每次開啟擴充功能 UI 時，還會向 GitHub 公開 API 讀取最新 Release 的版本號。兩者都不包含任何頁面或使用者資料。

完整的產品、static data contract、隱私、相容性與發布規格見 [extension design document](docs/browser-extension.md)。

## 授權條款

[MIT](LICENSE)
