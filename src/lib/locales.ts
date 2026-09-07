import type { SupportedLocale } from "./types";

export interface LocaleMessages {
	title: string;
	loading: string;
	loadingPage: string;
	loadingData: string;
	summary: (candidates: number, confirmed: number) => string;
	noCandidatesTitle: string;
	noCandidatesDesc: string;
	noConfirmedTitle: string;
	noConfirmedDesc: string;
	unsupportedPageTitle: string;
	unsupportedPageDesc: string;
	errorTitle: string;
	errorDesc: string;
	retry: string;
	truncatedWarning: string;
	honoursCount: (n: number) => string;
	expandHonours: string;
	collapseHonours: string;
	viewDetails: string;
	previewCTA: string;
	noCover: string;
	scoreUnit: string;
	allTimeRank: string;
	allTimeRankBadge: (rank: number) => string;
	rankingsSectionTitle: string;
	clickHint: string;
	unmatchedTitle: string;
	unmatchedDesc: string;
	missav: string;
	javdb: string;
	settingsTitle: string;
	settingsDesc: string;
	missavLabel: string;
	javbusLabel: string;
	saveSettings: string;
	resetDefaults: string;
	settingsSaved: string;
	backToScanner: string;
	previewUrlLabel: string;
	locate: string;
	locateSuccess: string;
	locateNotFound: string;
	locateTitle: string;
	recommendedTitle: string;
	recommendedDesc: string;
	topRated: string;
	feelingLucky: string;
	loadMore: string;
	allTimeRankTitle: string;
	languageLabel: string;
	languageAuto: string;
	excludedSitesLabel: string;
	excludedSitesDesc: string;
	addSite: string;
	removeSite: string;
	sitePlaceholder: string;
	excludedSiteTitle: string;
	excludedSiteDesc: string;
	manageExcludedSites: string;
	customRegexLabel: string;
	customRegexDesc: string;
	regexSyntaxError: string;
	resetRegex: string;
	extensionVersionLabel: string;
	updateAvailableTitle: (version: string) => string;
	updateAvailableDesc: string;
	updateNow: string;
	updateAvailableAria: (version: string) => string;
}

export const messages: Record<SupportedLocale, LocaleMessages> = {
	"zh-hans": {
		title: "JavRanking 榜单助手",
		loading: "正在识别与加载...",
		loadingPage: "正在读取当前页面内容...",
		loadingData: "正在同步 JavRanking 榜单数据...",
		summary: (candidates, confirmed) =>
			`识别到 ${candidates} 个番号，${confirmed} 部影片上榜`,
		clickHint: "点击即可查看排名详情，预览视频，剧照截图，精选评论和磁力链接",
		noCandidatesTitle: "未发现番号",
		noCandidatesDesc: "当前页面未识别到受支持的影片番号格式。",
		noConfirmedTitle: "暂无上榜收录",
		noConfirmedDesc:
			"已识别到页面候选，但 JavRanking 当前公开榜单中没有可确认的匹配。",
		unsupportedPageTitle: "页面受限",
		unsupportedPageDesc: "浏览器安全策略禁止在当前系统/扩展页面运行扫描。",
		errorTitle: "网络或数据错误",
		errorDesc: "无法加载榜单索引数据，请检查网络连接后重试。",
		retry: "重新尝试",
		truncatedWarning: "页面内容超过扫描上限，部分候选可能未纳入统计。",
		honoursCount: (n) => `上榜 ${n} 次`,
		expandHonours: "展开全部",
		collapseHonours: "收起",
		viewDetails: "查看详情",
		previewCTA: "在 JavRanking 查看预览",
		noCover: "暂无封面",
		scoreUnit: "分",
		allTimeRank: "全站",
		allTimeRankBadge: (rank) => `总榜 #${rank}`,
		rankingsSectionTitle: "上榜榜单",
		unmatchedTitle: "未上榜影片",
		unmatchedDesc:
			"以下番号已在页面中识别，但未在 JavRanking 中上榜，点击按钮可直达 MissAV 在线观看，或者在 JavDB 中查看详情：",
		missav: "MissAV",
		javdb: "JavDB",
		settingsTitle: "搜索与跳转设置",
		settingsDesc:
			"自定义外部平台跳转规则，支持 {code} 或 {番号} 占位符。设置永久保存在本地。",
		missavLabel: "MissAV 链接规则",
		javbusLabel: "JavBus / JavDB 链接规则",
		saveSettings: "保存设置",
		resetDefaults: "恢复默认",
		settingsSaved: "设置已保存！",
		backToScanner: "返回扫描",
		previewUrlLabel: "示例效果预览 (以 ABP-123 为例)：",
		locate: "定位",
		locateSuccess: "已定位",
		locateNotFound: "未找到",
		locateTitle: "在网页中定位此番号",
		recommendedTitle: "JavRanking 推荐神作",
		recommendedDesc: "精选高分与经典好片，随心发现探索",
		topRated: "评分最高",
		feelingLucky: "手气不错",
		loadMore: "加载更多",
		allTimeRankTitle: "JAVRANKING 全站总榜",
		languageLabel: "界面语言",
		languageAuto: "跟随系统",
		excludedSitesLabel: "排除站点黑名单",
		excludedSitesDesc:
			"在以下站点中插件自动停用，不执行扫描。支持子域名泛匹配（如 javranking.top 会同时匹配所有子域名）。",
		addSite: "添加",
		removeSite: "移除",
		sitePlaceholder: "输入域名，如：javranking.top",
		excludedSiteTitle: "站点已排除",
		excludedSiteDesc: "当前站点已被加入排除黑名单，插件在此页面不执行扫描。",
		manageExcludedSites: "管理排除设置",
		customRegexLabel: "番号识别正则",
		customRegexDesc:
			"自定义页面番号提取的核心正则表达式规则，保存后即时生效。",
		regexSyntaxError: "正则表达式语法无效，请检查后重试",
		resetRegex: "恢复默认正则",
		extensionVersionLabel: "当前插件版本",
		updateAvailableTitle: (version) => `发现新版本 v${version}`,
		updateAvailableDesc: "前往 GitHub Release 下载更新。",
		updateNow: "立即更新",
		updateAvailableAria: (version) =>
			`发现新版本 v${version}，在新标签页打开 GitHub 最新 Release`,
	},
	"zh-hant": {
		title: "JavRanking 榜單助手",
		loading: "正在識別與載入...",
		loadingPage: "正在讀取當前頁面內容...",
		loadingData: "正在同步 JavRanking 榜單資料...",
		summary: (candidates, confirmed) =>
			`識別到 ${candidates} 個番號，${confirmed} 部影片上榜`,
		clickHint: "點擊即可查看排名詳情，預覽影片，劇照截圖，精選評論和磁力連結",
		noCandidatesTitle: "未發現番號",
		noCandidatesDesc: "當前頁面未識別到受支援的影片番號格式。",
		noConfirmedTitle: "暫無上榜收錄",
		noConfirmedDesc:
			"已識別到頁面候選，但 JavRanking 當前公開榜單中沒有可確認的匹配。",
		unsupportedPageTitle: "頁面受限",
		unsupportedPageDesc: "瀏覽器安全策略禁止在當前系統/擴充頁面執行掃描。",
		errorTitle: "網路或資料錯誤",
		errorDesc: "無法載入榜單索引資料，請檢查網路連線後重試。",
		retry: "重新嘗試",
		truncatedWarning: "頁面內容超過掃描上限，部分候選可能未納入統計。",
		honoursCount: (n) => `上榜 ${n} 次`,
		expandHonours: "展開全部",
		collapseHonours: "收起",
		viewDetails: "查看詳情",
		previewCTA: "在 JavRanking 查看預覽",
		noCover: "暫無封面",
		scoreUnit: "分",
		allTimeRank: "全站",
		allTimeRankBadge: (rank) => `總榜 #${rank}`,
		rankingsSectionTitle: "上榜榜單",
		unmatchedTitle: "未上榜影片",
		unmatchedDesc:
			"以下番號已在頁面中識別，但未在 JavRanking 中上榜，點擊按鈕可直達 MissAV 線上看，或者在 JavDB 中查看詳情：",
		missav: "MissAV",
		javdb: "JavDB",
		settingsTitle: "搜尋與跳轉設定",
		settingsDesc:
			"自訂外部平台跳轉規則，支援 {code} 或 {番号} 佔位符。設定永久保存在本地。",
		missavLabel: "MissAV 連結規則",
		javbusLabel: "JavBus / JavDB 連結規則",
		saveSettings: "儲存設定",
		resetDefaults: "恢復預設",
		settingsSaved: "設定已儲存！",
		backToScanner: "返回掃描",
		previewUrlLabel: "範例效果預覽 (以 ABP-123 為例)：",
		locate: "定位",
		locateSuccess: "已定位",
		locateNotFound: "未找到",
		locateTitle: "在網頁中定位此番號",
		recommendedTitle: "JavRanking 推薦神作",
		recommendedDesc: "精選高分與經典好片，隨心發現探索",
		topRated: "評分最高",
		feelingLucky: "手氣不錯",
		loadMore: "載入更多",
		allTimeRankTitle: "JAVRANKING 全站總榜",
		languageLabel: "介面語言",
		languageAuto: "跟隨系統",
		excludedSitesLabel: "排除站點黑名單",
		excludedSitesDesc:
			"在以下站點中擴充功能自動停用，不執行掃描。支援子網域泛匹配（如 javranking.top 會同時匹配所有子網域）。",
		addSite: "新增",
		removeSite: "移除",
		sitePlaceholder: "輸入網域，如：javranking.top",
		excludedSiteTitle: "站點已排除",
		excludedSiteDesc: "當前站點已被加入排除黑名單，擴充功能在此頁面不執行掃描。",
		manageExcludedSites: "管理排除設定",
		customRegexLabel: "番號識別正則",
		customRegexDesc:
			"自訂頁面番號提取的核心規則表達式規則，儲存後即時生效。",
		regexSyntaxError: "規則表達式語法無效，請檢查後重試",
		resetRegex: "恢復預設正則",
		extensionVersionLabel: "目前擴充功能版本",
		updateAvailableTitle: (version) => `發現新版本 v${version}`,
		updateAvailableDesc: "前往 GitHub Release 下載更新。",
		updateNow: "立即更新",
		updateAvailableAria: (version) =>
			`發現新版本 v${version}，在新分頁開啟 GitHub 最新 Release`,
	},
	en: {
		title: "JavRanking Companion",
		loading: "Scanning and loading...",
		loadingPage: "Reading current page text...",
		loadingData: "Loading JavRanking catalog index...",
		summary: (candidates, confirmed) =>
			`Found ${candidates} video codes, ${confirmed} ranked on JavRanking`,
		clickHint:
			"Click to view ranking details, preview trailer, stills, top reviews, and magnets",
		noCandidatesTitle: "No video codes found",
		noCandidatesDesc: "No supported video codes recognized on this page.",
		noConfirmedTitle: "No confirmed ranking matches",
		noConfirmedDesc:
			"Candidates were found, but none match JavRanking's published rankings.",
		unsupportedPageTitle: "Unsupported page",
		unsupportedPageDesc:
			"Browser security restrictions prohibit reading this page.",
		errorTitle: "Network or data error",
		errorDesc: "Failed to load static index data. Please check your network.",
		retry: "Retry",
		truncatedWarning:
			"Page text exceeded limit; scan was partially truncated.",
		honoursCount: (n) => `${n} ranking appearance${n > 1 ? "s" : ""}`,
		expandHonours: "Show all",
		collapseHonours: "Collapse",
		viewDetails: "View Details",
		previewCTA: "Watch Preview on JavRanking",
		noCover: "No cover",
		scoreUnit: "pts",
		allTimeRank: "All-Time",
		allTimeRankBadge: (rank) => `Rank #${rank}`,
		rankingsSectionTitle: "Rankings",
		unmatchedTitle: "Unranked Videos",
		unmatchedDesc:
			"Identified on page but not ranked on JavRanking. Click below to watch on MissAV or view details on JavDB:",
		missav: "MissAV",
		javdb: "JavDB",
		settingsTitle: "Search & Navigation Settings",
		settingsDesc:
			"Customize external navigation rules. Supports {code} placeholder. Saved permanently in local storage.",
		missavLabel: "MissAV URL Template",
		javbusLabel: "JavBus / JavDB URL Template",
		saveSettings: "Save Settings",
		resetDefaults: "Reset Defaults",
		settingsSaved: "Settings saved!",
		backToScanner: "Back to Scanner",
		previewUrlLabel: "Preview URL (e.g. ABP-123):",
		locate: "Locate",
		locateSuccess: "Located",
		locateNotFound: "Not found",
		locateTitle: "Locate this code on current page",
		recommendedTitle: "JavRanking Recommendations",
		recommendedDesc: "Explore top-rated and classic picks from JavRanking",
		topRated: "Top Rated",
		feelingLucky: "I'm Feeling Lucky",
		loadMore: "Load More",
		allTimeRankTitle: "JAVRANKING All-Time Leaderboard",
		languageLabel: "Language",
		languageAuto: "Follow Browser",
		excludedSitesLabel: "Excluded Sites",
		excludedSitesDesc:
			"The extension is disabled and will not scan pages on these sites. Matches subdomains automatically.",
		addSite: "Add",
		removeSite: "Remove",
		sitePlaceholder: "Domain name, e.g. javranking.top",
		excludedSiteTitle: "Site Excluded",
		excludedSiteDesc:
			"This site is in your excluded sites list. JavRanking Companion will not scan this page.",
		manageExcludedSites: "Manage Settings",
		customRegexLabel: "Video Code Regex",
		customRegexDesc:
			"Custom regular expression pattern used to extract video codes from web pages.",
		regexSyntaxError: "Invalid regular expression syntax",
		resetRegex: "Reset to Default Regex",
		extensionVersionLabel: "Current extension version",
		updateAvailableTitle: (version) => `Version ${version} is available`,
		updateAvailableDesc: "Download the update from GitHub Releases.",
		updateNow: "Update now",
		updateAvailableAria: (version) =>
			`Version ${version} is available. Open the latest GitHub Release in a new tab`,
	},
};

export function detectLocale(): SupportedLocale {
	const lang =
		(typeof navigator !== "undefined" && navigator.language) || "en";
	const lower = lang.toLowerCase();

	if (
		lower.startsWith("zh-cn") ||
		lower.startsWith("zh-sg") ||
		lower === "zh"
	) {
		return "zh-hans";
	}
	if (
		lower.startsWith("zh-tw") ||
		lower.startsWith("zh-hk") ||
		lower.startsWith("zh-mo") ||
		lower.includes("hant")
	) {
		return "zh-hant";
	}
	return "en";
}
