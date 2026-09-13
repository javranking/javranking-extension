# JavRanking browser extension development design

> Status: proposed · Scope: JavRanking browser extension product behavior, architecture, static data contract, privacy, compatibility, testing, and delivery

本文档是 JavRanking browser extension 的 canonical design document。主站的 SSG architecture、routes 与 search 行为，以及主站 design tokens，仍由主站 repository 管理；本文档只定义 extension 的产品和工程边界。

## 1. Product objective

Extension 把 JavRanking 的榜单数据带到用户正在浏览的页面中。用户主动点击 browser toolbar 中的 JavRanking icon 后，extension 识别当前激活页面可见内容里的影片番号，并展示 JavRanking 已发布数据中的：

- cover image；
- 影片番号与 title；
- 荣誉列表，即影片出现过的榜单及对应 position；
- JavRanking 影片详情链接；
- 光标悬停在影片卡片上时展现动态播放器引导图标，点击直达 JavRanking 影片详情与预览。

Extension 是主站的 browsing companion，不是独立影片站、通用 metadata database 或 video player。它的核心价值是让用户在当前页面内快速判断影片是否拥有榜单荣誉，并把进一步浏览和 preview playback 引导到 JavRanking 主站。

## 2. MVP decisions

### Included

- 用户每次点击 extension icon 时执行一次识别。
- 只读取触发时的 current active tab 和 top-level document。
- 识别 standard、FC2 及 JavRanking 当前收录格式的番号候选。
- 使用主站 build 时生成的 static search index 与 lightweight revision manifest 完成 lookup，并通过 localStorage 客户端缓存加速常规打开，不新增 dynamic API。
- 在 Side Panel（侧边栏，Firefox 映射为 Sidebar Action）中显示 loading、results、empty 和 error states。
- Cover 直接显示，不 blur。
- 展示每部已匹配影片的全部已发布 ranking appearances。
- Preview CTA 只在主站存在 preview video 时显示，并在新 tab 打开 JavRanking 详情页。
- Chrome 和 Edge 是 primary targets；Firefox 保持 feature-compatible。
- 通过 GitHub source repository 和 release artifacts 分发。

### Explicitly excluded

- 全局持久 content script、scheduled scan、按键或敏感输入监听。
- 自动扫描未激活的 background tabs，或在非激活页面 DOM 变化时无节制重新扫描。
- 读取 browser history、其他 tabs、cookies、form values、password fields 或 clipboard。
- 扫描 cross-origin iframe、browser internal pages、PDF viewer、extension pages 或 closed shadow roots。
- 向 JavRanking 上传 page URL、page title、完整 DOM、完整 page text 或 browsing history。
- 在 extension 内嵌、下载、proxy 或播放 preview video。
- Preview autoplay，包括打开 JavRanking 详情页后的 autoplay。
- Runtime database、Cloudflare Worker query、Pages Function、online write、login 或 personalization。

“识别当前页面所有番号”的工程定义是：识别 top-level document 当前 rendered visible text 中、符合受支持格式且位于安全扫描上限内的全部唯一候选。Iframe、canvas 内文字、图片 OCR、未渲染 virtualized content 和 closed shadow DOM 不属于 MVP coverage。

## 3. Existing search implementation

主站 search 已经提供 extension 所需的 static delivery path：

1. `frontend/src/pages/[locale]/search-index.json.ts` 在 Astro build 时为三个 locale 生成 `/{locale}/search-index.json`。
2. 同步在 `frontend/src/pages/[locale]/search-index-manifest.json.ts` 为各 locale 生成极轻量的 revision manifest（`< 200 B`），供 extension 在常规点击时以极低网络开销核对版本。
3. Route 调用 `frontend/src/lib/catalog.ts` 的 `getPublishedSearchIndex()`，从 `data/javranking.sqlite` 读取至少出现在一个 published ranking 中的影片。
4. `frontend/src/pages/[locale]/search.astro` 在 browser 中 fetch static JSON，normalize query 后匹配 `video.code`。
5. 当前 `SearchVideo` 已包含 `videoId`、`code`、`title`、`score`、`coverUrl`、`releaseDate` 和 `actorLinks`；当前 index 还包含 actor、director 与 maker entities。

Extension 直接消费相同的 `/{locale}/search-index.json` 与 companion `/{locale}/search-index-manifest.json`，不创建 `/api/*` endpoint，也不逐部 fetch video detail HTML。现有 index 的 extension 必需字段不足，因此需要对同一 static contract 做 additive extension。

## 4. Static data contract

### Manifest contract

为了避免用户每次点击插件都重复下载 ~1.2 MiB 的全量静态 index，主站为每个 locale 输出一个配套的轻量 revision manifest：

```ts
interface SearchIndexManifest {
	schemaVersion: 2;
	locale: string;
	revision: string;
	generatedAt: string;
	videoCount: number;
	byteLength: number;
}
```

Manifest rules：

- `revision`：对该 locale 最终生成的 `search-index.json` 字符串计算 SHA-256 摘要并截取前 16 位十六进制字符。相同 SQLite 数据库输入必须保证生成完全相同的 `revision`。
- `generatedAt`：UTC ISO 8601 时间戳，仅用于诊断或缓存调试，不作为客户端版本一致性的判定依据。
- `byteLength` 与 `videoCount`：记录未压缩的 JSON 字节数与视频数量，便于客户端做完整性自检与监控。
- 整个 manifest 文件体积严格控制在 200 字节以内，支持毫秒级响应。

### Required additive fields

`SearchIndex` 增加 top-level `schemaVersion`。`SearchVideo` 增加：

```ts
interface SearchIndex {
	schemaVersion: 2;
	videos: SearchVideo[];
	entities: SearchEntity[];
}

interface SearchVideo {
	videoId: number;
	code: string | null;
	title: string;
	score: number;
	rank?: number;
	coverUrl: string | null;
	releaseDate: string | null;
	actorLinks: EntityLink[];
	rankingAppearances: RankingAppearance[];
	hasPreviewVideo: boolean;
}
```

`RankingAppearance` 继续复用 `frontend/src/lib/catalog.ts` 的现有 contract：

```ts
interface RankingAppearance {
	slug: string;
	name: string;
	source?: string;
	scope?: string | null;
	year?: number | null;
	position: number;
}
```

Rules：

- 只包含 `is_published = 1` 的 rankings 和对应 appearances。
- `rankingAppearances` 使用 catalog 现有确定性顺序；extension 不重新推断榜单优先级。
- `hasPreviewVideo` 只表示 `video.preview_video_url` 存在有效非空值。
- Static index 不包含 `previewVideoUrl`。Plugin 无法绕过主站直接播放或链接 media file。
- Detail URL 由 extension 根据 `videoId` 和 locale 构造，不在 JSON 中重复保存。
- 字段变更保持 additive，现有主站 search 可以忽略新增字段。
- 相同 SQLite input 必须生成相同 JSON；不要把 build timestamp 写入 index。

### URL contract

- Manifest：`https://javranking.cc/{locale}/search-index-manifest.json`
- Index：`https://javranking.cc/{locale}/search-index.json`
- Video detail：`https://javranking.cc/{locale}/videos/{videoId}/`
- Preview intent：`https://javranking.cc/{locale}/videos/{videoId}/#preview`

主站 preview control 需要提供稳定的 `#preview` anchor。打开该 anchor 可以 scroll 或 focus preview section，但不得自动打开 dialog 或开始 playback。用户仍需在主站完成明确的 play action。

### Compatibility and failure behavior

- Extension 只接受它明确支持的 `schemaVersion`。
- Version 缺失、过新、JSON malformed 或 required fields 不合法时，显示 data compatibility error 和更新 extension 的提示。
- Manifest 的 `schemaVersion` 与 extension 支持版本不匹配时，拒绝使用远端 index 并提示更新 extension。
- 客户端本地已缓存数据超过 30 天硬过期（30-day hard TTL）且无法联机校验时，不再渲染陈旧数据，强制报错重试。
- 单条 malformed video record 被跳过并计入 error summary，不阻断其他有效结果。
- Extension 不把“index 中没有匹配”解释为影片一定不存在，只显示“JavRanking 当前公开榜单中没有可确认的匹配”。

## 5. Extension architecture

### Runtime flow

```text
User clicks toolbar icon
        │
        ▼
Popup opens and checks localStorage
        │
   ┌────┴────────────────────────────────┐
   ▼                                     ▼
Valid local cache (< 30 days)      No cache or expired (> 30 days)
   │                                     │
   ├─► Start candidate matching          ├─► Show loading state
   │   immediately (< 20ms)              │   Fetch manifest + index
   │                                     │   Validate schema & write cache
   ▼                                     ▼
Scripting in active tab           Scripting in active tab
   │                                     │
   ▼                                     ▼
Render matched cards              Render matched cards
   │
   ▼ (Background / Post-render)
If lastCheckedAt >= 12 hours:
Fetch search-index-manifest.json (< 200 B)
   ├── Same revision: update lastCheckedAt
   └── Diff revision: fetch search-index.json, update localStorage
```

Index loading and page extraction start concurrently. On a cache hit (local index exists and is within the 30-day hard TTL), the popup parses the local ~1 MiB data and matches candidates immediately (< 20ms), with zero network blocking on the critical path. A lightweight revision check runs in the background when the 12-hour revalidate window elapses. The popup owns the whole operation and is disposed when the popup closes. MVP does not require a background service worker.

### Recommended repository layout

Extension 基于 [WXT](https://wxt.dev/) 框架与 React 19 + TypeScript 进行构建，产物统一输出为 Manifest V3：

```text
extension/
├── package.json
├── tsconfig.json
├── wxt.config.ts
├── public/
│   ├── brand-logo.png
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
├── entrypoints/
│   ├── background.ts
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── style.css
│   │   └── components/
│   │       ├── ResultCard.tsx
│   │       ├── SettingsView.tsx
│   │       └── UnmatchedList.tsx
│   └── options/
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx
├── src/
│   └── lib/
│       ├── types.ts
│       ├── normalize-code.ts
│       ├── extract-codes.ts
│       ├── locate-code.ts
│       ├── index-cache.ts
│       ├── locales.ts
│       ├── settings.ts
│       └── url.ts
└── test/
```

采用 WXT 的标准 entrypoints 结构与 React 声明式 UI 组织 Side Panel 与 Options 页面。通过 WXT 自动处理跨浏览器编译、Manifest 生成与 Vite 模块打包，严禁在运行时注入未经打包的远程脚本或调用 `eval`。

## 6. Permissions and manifest

Use Manifest V3 with the minimum permissions:

```json
{
	"manifest_version": 3,
	"permissions": ["activeTab", "scripting", "sidePanel", "tabs"],
	"host_permissions": ["https://javranking.cc/*", "*://*/*"],
	"background": {
		"service_worker": "background.js"
	},
	"side_panel": {
		"default_path": "sidepanel.html"
	},
	"icons": {
		"16": "icons/icon-16.png",
		"32": "icons/icon-32.png",
		"48": "icons/icon-48.png",
		"128": "icons/icon-128.png"
	},
	"action": {
		"default_title": "JavRanking",
		"default_icon": {
			"16": "icons/icon-16.png",
			"32": "icons/icon-32.png",
			"48": "icons/icon-48.png",
			"128": "icons/icon-128.png"
		}
	}
}
```

Rationale：

- `activeTab` and `tabs` allow querying the active tab and its URL across browser windows from the persistent side panel context.
- `scripting` and `*://*/*` allow `scripting.executeScript()` to inspect candidate video codes on user-visited web pages from the dockable side panel.
- `sidePanel` allows hosting the full-height companion interface (mapped to `sidebar_action` in Firefox builds).
- `https://javranking.cc/*` host permission allows fetching JavRanking's static index and revision manifest.
- Do not request `history`, `storage`, `cookies`, `webRequest`, `downloads` or `notifications` in the MVP.
- 客户端缓存采用 extension origin（`chrome-extension://<id>/`）的 Web Storage API（`window.localStorage`），在 side panel 生命周期内与跨次打开间安全持久化，无需声明 `"storage"` 权限，保持零敏感权限提示。
- Detail and preview links use ordinary `<a target="_blank" rel="noopener noreferrer">`; opening them does not justify special navigation permissions.

Clicking an action triggers `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` to toggle the side panel. The sidepanel queries the active tab in the focused browser window and listens to tab activations and updates, executing the extraction function with `allFrames` omitted or false. Browser-restricted URLs such as `chrome://`, `edge://`, `about:`, browser stores and built-in PDF viewers return a readable unsupported-page state with a manual rescan action.

Firefox uses the same Manifest V3 source. WXT maps `sidepanel` to `sidebar_action` for Firefox packaging and declares `data_collection_permissions.required: ["none"]` while the no-collection contract remains true. Chrome ignores `browser_specific_settings`.

Relevant platform references：

- [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [MDN scripting API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting)
- [MDN browser-specific settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)

## 7. Page extraction and code matching

### Extraction boundary

The injected function runs once and returns only candidate strings plus their first occurrence order. It must not return the full page text or any surrounding sentence.

Read from the top-level document's rendered text. Exclude `script`, `style`, `noscript`, form field values and non-rendered content. `document.body.innerText` is an acceptable MVP baseline because it follows rendered text semantics; extraction must handle a missing body.

Apply guardrails so an adversarial or extremely large page cannot freeze the popup：

- scan at most 2 MiB of rendered text；
- return at most 500 unique candidates；
- cap an individual candidate at 64 characters；
- report `truncated: true` whenever a limit is reached；
- never mutate the host page DOM。

### Candidate formats

Candidate extraction must cover：

### Candidate formats

Candidate extraction must cover：

- conventional alphabetic prefix plus numeric suffix：**左侧必须全部为英文字母（3 至 6 位），右侧必须全部为数字（3 至 6 位），中间必须由连字符 `-`（或 `—`、`–`）或空白符分隔**，默认核心正则为 `\b[A-Za-z]{3,6}[-—–\s]+\d{3,6}\b`（如 `ABP-123`、`SSIS 001`、`IPX-456`）；严格排除无分隔符连写字母数字串（如 `SSIS001`、`LIUJIAYI1111`、`KAKA233333`、`user1234` 等用户名或乱码）；同时该核心正则开放至设置页面允许用户自定义；
- FC2 格式，如 `FC2-1234567`、`FC2 PPV 1234567`、`FC2-PPV-1234567` 等连字符或空格分隔形式；
- 少数已在发布索引中存在的日期型、数字前缀及点号欧美厂牌发行码（如 `010115_001`、`blacked.20.01.10`）。

提取逻辑必须严格过滤域名与网页链接（如 `www.javbus.com`、`missav.ws`、`cdn.jsdelivr.net` 等）：任何以 `www.` 开头、包含 URL 特殊字符（如 `/`、`\`、`?`、`=`、`&`、`#`）或以常见 Web TLD（如 `.com`、`.net`、`.org`、`.cn`、`.ws`、`.html`）结尾的候选均会被判定为非法候选并过滤，避免误将网址识别为番号。

The static index is the authority for confirmed matches. A broad pattern only produces candidates; it never proves that a candidate is a valid or ranked video.

### Normalization

Use one shared `normalizeCode()` implementation for index codes, extracted candidates and tests：

1. Unicode `NFKC` normalization；
2. trim；
3. uppercase using locale-independent behavior；
4. normalize supported dash, underscore and whitespace runs；
5. create a comparison key that removes supported separators without changing letters or digits。

Examples：

| Page text | Comparison key | Canonical display |
| --- | --- | --- |
| `ABP-123` | `ABP123` | `ABP-123` |
| `abp 123` | `ABP123` | `ABP-123` |
| `ＦＣ２－３０６１６２５` | `FC23061625` | `FC2-3061625` |

Build a `Map<comparisonKey, SearchVideo>`. Build/test must fail if two published videos produce the same non-empty comparison key; runtime must fail closed on an ambiguous key instead of choosing one arbitrarily.

Results retain the first page occurrence order. Repeated appearances of the same confirmed video produce one card. Unmatched candidates may be summarized as unconfirmed, but must not receive a fake title, cover or “未上榜” claim.

## 8. Side Panel UX

Use a single scrollable side panel for all supported browsers. Target approximately 380–440 CSS pixels wide while remaining usable at narrower browser limits. Typography adheres to Web Interface Guidelines and UI/UX Pro Max baselines: base font is 14px (no text below 12px), numbers use `tabular-nums`, secondary/muted colors meet WCAG AA contrast (≥ 4.5:1), and interactive elements feature visible `:focus-visible` rings and responsive touch targets.

### Header & Navigation

- **左侧 Logo 链接**：左上角放置 JavRanking 品牌 Logo 图片，点击在新标签页打开 JavRanking 主站首页，携带 `utm_source=javranking-extension&utm_medium=extension&utm_campaign=header_logo` 统计参数。
- **右侧快捷操作**：保持极简干净，仅保留「重新扫描」（🔄）与「设置」（⚙️）两个图标按钮；不放置冗余文字链接或语言角标。

### States

1. **Loading**：同时显示“正在读取当前页面”和“正在加载 JavRanking 数据”。
2. **Results**：显示“识别到 N 个番号，M 部影片上榜”及引导文案“点击即可查看排名详情，预览视频，剧照截图，精选评论和磁力链接”，然后按首次出现顺序展示 cards。
3. **No candidates**：当前页面未识别到受支持的番号。在首屏展示突出醒目的「未发现番号」主状态卡片；下方内容区作为辅助探索展示「JavRanking 推荐神作」卡片列表，默认以“手气不错”随机模式呈现，亦可切换为“评分最高”。
4. **No confirmed matches**：发现候选，但 JavRanking 当前公开榜单没有可确认匹配。展示未上榜番号列表与外部跳转。
5. **Unsupported page**：browser 安全策略不允许读取当前 tab。
6. **Network/data error**：static index 无法加载或 schema 不兼容，并提供 retry action。
7. **Partial result**：达到扫描上限时明确说明结果可能不完整。

### Result card

每个 matched card 的结构与内容顺序：

1. **Top Hero 区（左右并排）**：
   - **左侧 3:2 横版海报**：保持原始 3:2 比例不裁切；左上角固定展示放大 1.5 倍的全站排名深金角标（白字 `总榜 #{rank}`），文字可读性强、对比醒目；光标悬停在 Top Hero 区域时海报轻度模糊并居中浮现金色播放器图标，吸引点击直达 JavRanking 详情页；加载失败或缺失时显示固定尺寸 fallback。
   - **右侧元数据区**：
     - 首行：番号与「定位」按钮（如 `IPTD-598  [定位]`）。布局简洁宽裕，点击定位按钮可在当前网页中高亮该番号并循环跳转，同时阻断卡片跳转；卡片其余部分依然保持点击直达 JavRanking 详情页。推荐神作卡片不显示定位按钮。
     - 次行：参演人员（带性别标识，如 `♀` / `♂`），字号与视觉权重高于影片标题，突出核心主演。
     - 标题：最多两行截断（Line clamp 2），次级文本样式。
2. **底部上榜信息区（Rankings list）**：
   - 细线分隔，直接列出该影片上榜的具体分类榜单及名次（如 `#124 JAVDB TOP250 2022`，智能去除冗余年份重复）。
   - 仅在影片拥有具体分类榜单时呈现该区域；全站总排名统一在左侧海报金色角标中高亮突出，避免在列表中冗余重复。
   - 光标移动至该区域时保持各个榜单 item 自身的选中效果，不触发上方海报模糊与播放图标。
   - 每一条上榜项目均为独立可点击链接，直达 JavRanking 对应榜单页面（带有右侧导航箭头，点击不触犯外层卡片跳转）。
   - 超过 3 项时默认收起其余项，并提供当前卡片内“展开全部 (N)”/“收起”控制按钮。
3. **交互与操作**：
   - 卡片整体支持点击打开 JavRanking 详情页（点击卡片上独立的“定位”或榜单链接不会触发主卡片跳转，保持卡片交互清晰）。
   - 所有直达 JavRanking 的外链均自动附加 `utm_source=javranking-extension&utm_medium=extension` 统计参数。

### 未发现番号时的推荐神作（Empty State Recommendations）

当当前页面未识别到任何番号时（`no_candidates` 状态）：

1. 页面上方占据主视觉展示居中突出的「未发现番号」信息卡片，明确作为页面主要信息反馈。
2. 下方作为辅助探索区呈现「JavRanking 推荐神作」视频卡片流，提供两种切换模式：
   - **手气不错**（默认）：在客户端随机打乱作品池，单页抽取 10 部作品呈现，底部支持「加载更多」追加更多随机作品。
   - **评分最高**：从 `search-index.json` 中按全站评分/排名升序排列（`#1` 最高分排在首位），单页展示 10 部作品，底部提供「加载更多」按钮。
3. 推荐卡片直接复用 `ResultCard` 组件，呈现完整的封面、总榜角标、主演与上榜信息；隐藏仅在当前网页才有效的「定位」按钮。

Cover 仅在 hover/focus 时展现轻微动态模糊与播放器引导图标。Cover、title 和 card body 点击均在新 tab 打开 JavRanking detail page。Extension 内不创建 `<video>`、不请求 preview media URL。

所有 remote values 用 DOM `textContent` 和 validated attributes 渲染，不使用 `innerHTML`。只接受：

- `https://javranking.cc/` 下的 navigation URLs；
- `https://static.javranking.cc/` 与当前明确批准的 cover host 上的 HTTPS images。

Current published data 中仍可能存在 third-party cover URLs。MVP 应使用 host allowlist、`referrerpolicy="no-referrer"` 和 fixed-size fallback；privacy 文档必须说明 remote image host 会收到普通 image request。未知 host 一律显示 fallback。

### 未上榜影片（Unmatched Candidates）

页面扫描出的番号若未在 JavRanking 静态索引中命中收录：

1. 在所有匹配卡片下方（或无匹配状态下）汇总展示未上榜影片列表。
2. 每个番号后提供快捷功能操作区：
   - **页面定位（Locate）**：点击「定位」按钮，extension 通过 `browser.scripting.executeScript` 在当前网页的 DOM 树中搜索该番号文本，自动将视口平滑滚动（`scrollIntoView`）至对应可见元素居中位置，并触发 2.5 秒的金黄色发光边框与半透明背景高亮动画，不篡改网页原有 DOM 结构；按钮同时给出即时反馈（如「已定位」或「未找到」）。
   - **MissAV**：默认 `https://missav.ws/cn/{番号}`（直达在线观看）
   - **JavDB/JavBus**：默认 `https://javdb.com/search?q={番号}`（查看详情）
3. 纯静态前端生成外部搜索链接，不伪造不存在的标题或封面，不向第三方发送后台网络请求。

### 扩展设置页面（Settings）

为了让用户按个人习惯配置语言、排除站点、番号正则及外部快捷搜索渠道：

1. **设置功能模块**：
   - 用户可点击 Side Panel 右上角齿轮图标进入设置页面，或通过浏览器扩展选项（Options UI）打开配置。
   - **界面语言选择**：提供「界面语言」下拉切换（跟随系统、简体中文、繁體中文、English），选择后即时持久化并无缝刷新当前 UI 与对应静态索引。
   - **排除站点黑名单（Excluded Sites）**：
     - 允许用户手动添加和保存排除站点（输入域名自动规范化，如 `example.com`）。
     - 默认自动包含 `javranking.cc`（同时自动保护所有子域名如 `static.javranking.cc`）。
     - 当用户在黑名单站点中浏览时，扩展自动停止扫描，并在侧边栏显示“站点已排除”状态与快捷管理按钮。
     - 支持在设置页面一键删除或新增排除站点。
   - **番号识别正则表达式（Custom Regex）**：
     - 开放页面番号匹配的核心正则表达式供用户自定义编辑。
     - 实时进行正则表达式语法校验，阻止非法语法保存；提供「恢复默认正则」按钮一键还原为官方默认规则 `\b[A-Za-z]{3,6}[-—–\s]+\d{3,6}\b`。
   - **外部跳转规则**：支持自定义 **MissAV** 与 **JavDB/JavBus** 的链接模板。
     - 默认链接模板：MissAV 为 `https://missav.ws/cn/{code}`；JavDB/JavBus 为 `https://javdb.com/search?q={code}`。
     - 模板支持 `{code}`、`{番号}`、`{ID}` 占位符；若未提供占位符，则自动将番号追加到 URL 末尾。
     - 提供即时动态 URL 预览（以 `ABP-123` 示例展示实际跳转结果）。
   - **保存与重置**：提供“保存设置”与“恢复默认”操作，保存时展示即时反馈；退出设置时自动使用最新配置重新扫描页面。
2. **存储契约**：
   - 配置值永久存储于客户端 `localStorage` 中（设置 key 为 `javranking_search_settings`，语言 key 为 `javranking_user_locale`），永不过期（无 TTL 限制）。
   - 读取失败或用户清空时自动降级为默认官方配置与浏览器首选语言。

### Accessibility

- Side Panel 支持 keyboard-only operation 和 visible focus。
- Loading/error status 使用适当的 live region，但不要重复 announce 每张 card。
- Cover `alt` 使用 `code + title`；decorative icon 使用空 `alt`。
- Controls 的 touch target、contrast 和 reduced-motion behavior 应符合主站 design system 的 accessibility baseline。
- 不依赖 hover 展示任何 core information。

### Locales

Extension UI 支持主站相同的 `en`、`zh-hans` 和 `zh-hant`。默认通过 browser UI language 映射：

- Simplified Chinese locales → `zh-hans`；
- Traditional Chinese locales → `zh-hant`；
- 其他 locales → `en`。

用户在设置中可手动切换界面语言，设置即刻生效并持久化到本地 `localStorage`。UI copy 打包在 extension 内。Video codes、original titles 和 ranking names 使用 index 中的 stored values。Index 和 detail URL 使用已选择 locale。

## 9. Privacy and security

### Data flow

Extension 的正常操作只产生：

- 对 JavRanking static search index 的 GET request；
- 对允许 cover host 的 image requests；
- 用户主动点击后，对 JavRanking detail page 的 normal navigation。
- 每次打开 extension UI 时，对 GitHub public `releases/latest` metadata 的 GET request，仅读取最新版本号。

Page extraction 和 matching 全部在本机完成。不要添加 analytics、telemetry、crash upload、remote logging 或 user identifier。即使未来添加任何数据收集，也必须先更新本 canonical document、privacy copy 和 manifest declarations。

### Security controls

- Packaged code only；禁止 remote scripts、dynamic import from remote origins 和 `eval`。
- Extension page CSP 限制 `script-src` 为 self、`connect-src` 为 JavRanking index origin 和 GitHub public release API、`img-src` 为 self 和 approved HTTPS cover hosts。
- Validate `schemaVersion`、field types、URL protocol、URL hostname 和 numeric positions before render。
- 所有 external navigation 添加 `noopener noreferrer`。
- 不持久化 page candidates、matched results 或 page-derived data。
- 不把 page-derived content拼入 network URL、query string、request body 或 logs。
- GitHub release 不包含 source maps、database、logs、cookies 或 environment files。

## 10. Performance and resilience

The current search index is under 1 MiB uncompressed at the time of this design. Adding ranking appearances must retain a practical static payload：

| Item | MVP budget |
| --- | --- |
| Search index | ≤ 1.5 MiB uncompressed；target ≤ 350 KiB compressed |
| Revision manifest | ≤ 200 B uncompressed |
| LocalStorage footprint | ≤ 1.5 MiB（单 active locale 严格隔离） |
| Popup packaged JS | ≤ 150 KiB minified, target ≤ 45 KiB compressed (React 19 runtime bundled) |
| Scan-to-first-result on ordinary catalog pages | ≤ 100ms on cache hit；≤ 1 second on initial cold fetch with broadband |
| Page text scan | ≤ 2 MiB and ≤ 500 unique candidates |
| Cover loading | lazy after first visible cards；fixed 3:2 space reserved |

### Client caching architecture

为了让用户在常规点击插件时获得毫秒级响应并消除跨国网络往返延时，extension 采用“`localStorage` 缓存 + 小型 revision manifest + 30-day hard TTL”的客户端存储与同步架构：

1. **Storage keys 与数据结构**：
   - `javranking_index_meta`：JSON 对象，记录 `{ schemaVersion: 2, locale: string, revision: string, cachedAt: number, lastCheckedAt: number }`。
   - `javranking_index_data`：直接存储未压缩的 `search-index.json` 原始字符串。避免在读写缓存时发生二次对象序列化性能损耗。

2. **单 Active Locale 配额管理与防御**：
   - 浏览器为 extension origin 提供的 `window.localStorage` 限制通常为 5 MiB。
   - 三种语言（`zh-hans`、`zh-hant`、`en`）的全量索引若同时存储将达 ~3.6 MiB，迫近 5 MiB 安全线。因此 extension 严格执行**仅缓存当前激活 locale** 策略：当检测到用户 locale 变化时，主动清理上一个 locale 的缓存 key，再写入新 locale 数据，确保常态存储占用稳定在 ~1.1–1.3 MiB（约 25% 配额）。
   - 所有写 `localStorage` 操作必须包裹在 `try...catch` 中；捕获到 `QuotaExceededError` 时先尝试清除旧 key 重试，若依然失败则降级为当前 session 纯内存运行，绝对不阻断 popup 渲染与用户交互。

3. **12 小时 Soft Revalidate Interval（静默校验窗口）**：
   - 当 `now - lastCheckedAt < 12 hours` 时，判定本地数据为热状态，完全不发出任何网络请求（0 network requests），直接由本地毫秒级解析出卡片。
   - 当 `now - lastCheckedAt >= 12 hours` 时，在 popup 渲染完成后（或并行不阻塞主渲染），后台向 `/{locale}/search-index-manifest.json` 发送微量 GET 请求（`< 200 B`）：
     - 若 remote manifest 的 `revision` 与本地一致，更新 `lastCheckedAt = now`；
     - 若 remote manifest 的 `revision` 发生变化，异步拉取新版 `search-index.json`，在校验 `schemaVersion` 与字段完整性后覆盖本地 `javranking_index_data` 与 meta，完成静默升级。

4. **30-Day Hard TTL（硬过期保护）**：
   - 当 `now - cachedAt > 30 days` 时（例如用户离线超过一个月，或长期未能成功完成联机校验），本地缓存被强制判定为**硬过期且不可信**。
   - Extension 拒绝继续展示超过 30 天未重新校验的陈旧榜单荣誉，强制切入 Loading 状态并重新联机同步；若联机失败，向用户明确展示带重试按钮的网络/数据过期错误，坚决不展示可能已失效的陈旧榜单荣誉。

## 11. Browser compatibility and distribution

### Support matrix

| Browser | Priority | MVP installation | Required validation |
| --- | --- | --- | --- |
| Google Chrome stable | Primary | Unzip GitHub release → Extensions → Developer mode → Load unpacked | Full automated and manual flow |
| Microsoft Edge stable | Primary | Unzip GitHub release → Extensions → Developer mode → Load unpacked | Full manual smoke test |
| Firefox stable | Compatible | Temporary load for development；persistent normal installation requires a Mozilla-signed XPI | Full manual smoke test |

Firefox Release blocks unsigned persistent extensions. GitHub can host a signed self-distributed XPI without a public AMO listing, but signing still goes through Mozilla validation and remains subject to Mozilla policies. Until signing is available, document Firefox support as temporary/developer installation rather than promising persistent one-click installation. See [Firefox add-on signing](https://support.mozilla.org/en-US/kb/add-on-signing-in-firefox) and [Mozilla self-distribution](https://extensionworkshop.com/documentation/publish/self-distribution/).

One source tree and one manifest should be preferred. Browser-specific release artifacts are allowed only for required signing or packaging metadata, not for feature divergence.

### GitHub release contents

- Human-readable source code and license。
- Versioned Chromium ZIP whose root contains `manifest.json`。
- Firefox XPI only after successful signing；otherwise clearly labelled temporary-install instructions。
- SHA-256 checksums。
- Installation、update、uninstall、privacy 和 troubleshooting instructions。
- Changelog with data-contract minimum version when it changes。

The user manually installs updates for unpacked Chromium releases. Extension settings display the installed version. Each extension UI startup fetches GitHub public `releases/latest` metadata without page-derived data or user identifiers; only a strictly newer stable semantic version displays an accessible upgrade link that opens the latest GitHub Release in a new tab. Failed, malformed or rate-limited checks remain silent and never block scanning or settings.

## 12. Testing strategy

### Unit tests

- `normalizeCode()`：case、full-width characters、dash variants、spaces、underscores、FC2 and dotted codes。
- Candidate extraction：multiple codes、duplicates、large text、missing body and truncation。
- Lookup：confirmed、unconfirmed、ambiguous normalized keys and null codes。
- Schema validation：supported version、unsupported version、malformed records and invalid URLs。
- Release update check：stable semantic version comparison、invalid payload、network failure and strictly-newer release handling。
- Cache manager：cache hit、cache miss、12 小时 soft window 命中免请求、manifest revision 变化触发全量更新、30 天 hard TTL 强制过期、locale 切换时自动清理旧缓存、`QuotaExceededError` 优雅降级内存运行。
- Ordering：first page occurrence and deterministic ranking appearance order。

### Static data contract tests

- Every published video with a non-null code has a unique comparison key。
- Every search video includes `rankingAppearances` and boolean `hasPreviewVideo`。
- Every appearance references a published ranking and has a positive integer position。
- `hasPreviewVideo` matches the build-time database value without exposing `previewVideoUrl`。
- Companion manifest 的 `revision`、`schemaVersion`、`locale`、`videoCount` 与对应 `search-index.json` 严格自洽。
- 相同 SQLite 数据库输入生成的 manifest 与 index 具备确定性 SHA-256 revision hash。
- Index output is deterministic and stays within the agreed size budget。
- Existing site search still works after additive fields are introduced。

### Browser integration tests

Use a local fixture page rather than third-party live sites for deterministic tests：

- Clicking the action scans only the active tab and only once。
- Two or more codes are recognized and deduplicated。
- Cover、honours and links render without modifying the page。
- Preview CTA is absent/present according to `hasPreviewVideo`。
- Preview CTA opens the localized JavRanking `#preview` URL in a new tab。
- No preview media request originates from the extension。
- Restricted browser pages show an unsupported state。
- Network and schema failures show retryable errors。
- Chrome、Edge and Firefox render equivalent core results。

## 13. Implementation sequence

### Phase 1 — Site data contract

1. Extend `SearchIndex` and `SearchVideo` types。
2. Reuse `getRankingAppearances()` inside `getPublishedSearchIndex()`。
3. Add `hasPreviewVideo` in the same build-time query。
4. Add `search-index-manifest.json.ts` route and deterministic SHA-256 revision generation。
5. Add `schemaVersion: 2` and contract tests。
6. Add the stable `#preview` anchor to video detail pages without autoplay。
7. Measure generated JSON and manifest, adjust only if it exceeds the budget。

### Phase 2 — Extension core

1. Create Manifest V3 package with `activeTab`、`scripting` and one JavRanking host permission。
2. Implement shared normalization and candidate extraction。
3. Implement `src/index-cache.js` (localStorage manager, manifest revalidation, 30-day hard TTL, quota fallback)。
4. Implement schema validation and local lookup。
5. Add fixture-based unit and browser tests。

### Phase 3 — Popup UI

1. Implement state machine and result cards with plain DOM APIs。
2. Add cover allowlist、fallback and `no-referrer`。
3. Add honours expansion、detail links and preview CTA。
4. Add three locale message sets and accessibility QA。

### Phase 4 — Release

1. Validate Chrome、Edge and Firefox manually。
2. Produce auditable ZIP and checksums。
3. Write install/update/privacy/troubleshooting documentation。
4. Publish GitHub Release；treat Firefox signed XPI as a separate release gate。

## 14. Definition of Done

MVP is complete when：

- a user can install the GitHub artifact in Chrome and Edge and temporarily load it in Firefox；
- clicking the toolbar icon is the only way to start a scan；
- the scan reads only the current active top-level document snapshot；
- matched videos show direct covers and every published ranking name/position；
- the extension consumes the existing static search index route with no runtime API or database；
- search-index 客户端缓存与 revision manifest 机制经单元测试验证，支持秒级冷启动与毫秒级热打开，且严格遵守 30-day hard TTL 与 5 MiB quota 兜底；
- preview is never requested or played inside the extension；
- preview CTA opens the correct localized JavRanking detail `#preview` URL in a new tab；
- manifest contains no unnecessary permissions or background listener；
- no page URL、full text、DOM、candidate or browsing activity is transmitted or persisted；
- unit、data-contract and browser smoke tests pass；
- root `npm run check:docs` and relevant frontend checks pass。

## 15. Open decisions

- Public product name and repository naming。
- Exact approved third-party cover host list while older covers have not all moved to owned storage。
- Whether Firefox self-distributed signing is viable；this does not block source compatibility or temporary loading。
- 已确认采纳客户端 localStorage + 小型 revision manifest + 30-day hard TTL 方案，解决常规打开下的网络延时与流量开销，无需在 MVP 引入更重的 IndexedDB 或 Service Worker。

Side Panel、automatic scanning、in-extension playback and a dynamic API are not open decisions for the MVP；they require an explicit future scope change。
