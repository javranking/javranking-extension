import React, { useEffect, useState } from "react";
import { extractCandidatesInTab } from "../../src/lib/extract-codes";
import { IndexCacheManager } from "../../src/lib/index-cache";
import { messages } from "../../src/lib/locales";
import { toComparisonKey } from "../../src/lib/normalize-code";
import {
	DEFAULT_CODE_REGEX,
	getEffectiveLocale,
	getSettings,
	isHostExcluded,
} from "../../src/lib/settings";
import type {
	ExtractionResult,
	MatchedResult,
	PopupStatus,
	SearchIndex,
	SearchVideo,
	SupportedLocale,
} from "../../src/lib/types";
import { buildJavRankingUrl } from "../../src/lib/url";
import { ResultCard } from "./components/ResultCard";
import { SettingsView } from "./components/SettingsView";
import { UnmatchedList } from "./components/UnmatchedList";

export const App: React.FC = () => {
	const [locale, setLocale] = useState<SupportedLocale>(() =>
		getEffectiveLocale(),
	);
	const t = messages[locale];

	const [status, setStatus] = useState<PopupStatus>("loading");
	const [showSettings, setShowSettings] = useState(false);
	const [candidateCount, setCandidateCount] = useState(0);
	const [matchedResults, setMatchedResults] = useState<MatchedResult[]>([]);
	const [unmatchedCandidates, setUnmatchedCandidates] = useState<string[]>([]);
	const [truncated, setTruncated] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Recommendations in empty state
	const [indexVideos, setIndexVideos] = useState<SearchVideo[]>([]);
	const [recommendMode, setRecommendMode] = useState<"top_rated" | "lucky">(
		"lucky",
	);
	const [topRatedCount, setTopRatedCount] = useState(10);
	const [luckyPool, setLuckyPool] = useState<SearchVideo[]>([]);
	const [luckyCount, setLuckyCount] = useState(10);

	const cacheManager = React.useMemo(() => new IndexCacheManager(), []);

	const runScan = async () => {
		setStatus("loading");
		setErrorMessage(null);
		setMatchedResults([]);
		setUnmatchedCandidates([]);
		setCandidateCount(0);
		setTruncated(false);
		setLuckyPool([]);
		setTopRatedCount(10);
		setLuckyCount(10);

		const settings = getSettings();

		try {
			// 1. Concurrently fetch/load static index and extract page candidates
			const indexPromise = cacheManager.loadIndex(locale);

			const extractionPromise = (async (): Promise<
				ExtractionResult & { excluded?: boolean }
			> => {
				// Query active tab in the browser window
				let tabs = await browser.tabs.query({
					active: true,
					lastFocusedWindow: true,
				});
				if (!tabs || tabs.length === 0) {
					tabs = await browser.tabs.query({
						active: true,
						currentWindow: true,
					});
				}
				const activeTab = tabs && tabs.length > 0 ? tabs[0] : undefined;
				if (!activeTab || !activeTab.id) {
					return { candidates: [], truncated: false, unsupported: true };
				}

				const url = activeTab.url || "";
				if (isHostExcluded(url, settings.excludedHosts)) {
					return { candidates: [], truncated: false, excluded: true };
				}

				// Check for restricted URLs if available
				const lowerUrl = url.toLowerCase();
				if (
					lowerUrl.startsWith("chrome://") ||
					lowerUrl.startsWith("chrome-extension://") ||
					lowerUrl.startsWith("edge://") ||
					lowerUrl.startsWith("about:") ||
					lowerUrl.startsWith("chrome.google.com/webstore") ||
					lowerUrl.startsWith("chromewebstore.google.com") ||
					lowerUrl.startsWith("addons.mozilla.org")
				) {
					return { candidates: [], truncated: false, unsupported: true };
				}

				try {
					const results = await browser.scripting.executeScript({
						target: { tabId: activeTab.id },
						func: extractCandidatesInTab,
						args: [settings.customRegex || DEFAULT_CODE_REGEX],
					});

					const firstResult =
						results && results.length > 0
							? results[0]?.result
							: undefined;
					if (!firstResult) {
						return { candidates: [], truncated: false };
					}

					return firstResult as ExtractionResult;
				} catch (err) {
					console.warn("ExecuteScript failed on tab:", activeTab.id, err);
					return { candidates: [], truncated: false, unsupported: true };
				}
			})();

			const [searchIndex, extraction] = await Promise.all([
				indexPromise,
				extractionPromise,
			]);

			setIndexVideos(searchIndex.videos);
			if (searchIndex.videos.length > 0) {
				setLuckyPool(
					[...searchIndex.videos].sort(() => Math.random() - 0.5),
				);
			}

			if (extraction.excluded) {
				setStatus("excluded_site");
				return;
			}

			if (extraction.unsupported) {
				setStatus("unsupported_page");
				return;
			}

			setTruncated(extraction.truncated);
			setCandidateCount(extraction.candidates.length);

			if (extraction.candidates.length === 0) {
				setStatus("no_candidates");
				return;
			}

			// 2. Build fast lookup map for index codes
			const codeMap = new Map<string, (typeof searchIndex.videos)[0]>();
			for (const video of searchIndex.videos) {
				if (!video.code) continue;
				const compKey = toComparisonKey(video.code);
				if (compKey && !codeMap.has(compKey)) {
					codeMap.set(compKey, video);
				}
			}

			// 3. Match candidates in first appearance order
			const matches: MatchedResult[] = [];
			const seenVideoIds = new Set<number>();

			for (const candidate of extraction.candidates) {
				const candidateKey = toComparisonKey(candidate);
				if (!candidateKey) continue;

				const matchedVideo = codeMap.get(candidateKey);
				if (matchedVideo && !seenVideoIds.has(matchedVideo.videoId)) {
					seenVideoIds.add(matchedVideo.videoId);
					matches.push({
						candidate,
						comparisonKey: candidateKey,
						video: matchedVideo,
					});
				}
			}

			setMatchedResults(matches);

			const matchedCandidateKeys = new Set(matches.map((m) => m.comparisonKey));
			const unmatched = extraction.candidates.filter(
				(c) => !matchedCandidateKeys.has(toComparisonKey(c)),
			);
			setUnmatchedCandidates(unmatched);

			if (matches.length === 0) {
				setStatus("no_confirmed_matches");
			} else {
				setStatus("results");
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			setErrorMessage(msg);
			setStatus("error");
		}
	};

	useEffect(() => {
		runScan();

		const handleTabActivated = () => {
			runScan();
		};

		const handleTabUpdated = (
			_tabId: number,
			changeInfo: { status?: string },
		) => {
			if (changeInfo.status === "complete") {
				runScan();
			}
		};

		if (typeof browser !== "undefined" && browser.tabs) {
			browser.tabs.onActivated?.addListener(handleTabActivated);
			browser.tabs.onUpdated?.addListener(handleTabUpdated);
		}

		return () => {
			if (typeof browser !== "undefined" && browser.tabs) {
				browser.tabs.onActivated?.removeListener(handleTabActivated);
				browser.tabs.onUpdated?.removeListener(handleTabUpdated);
			}
		};
	}, [locale]);

	const topRatedVideos = React.useMemo(() => {
		return [...indexVideos].sort(
			(a, b) =>
				(a.rank ?? 999999) - (b.rank ?? 999999) ||
				(b.score ?? 0) - (a.score ?? 0),
		);
	}, [indexVideos]);

	const displayedVideos =
		recommendMode === "top_rated"
			? topRatedVideos.slice(0, topRatedCount)
			: (luckyPool.length > 0 ? luckyPool : topRatedVideos).slice(
					0,
					luckyCount,
				);

	const hasMoreRecommendations =
		recommendMode === "top_rated"
			? topRatedCount < topRatedVideos.length
			: luckyCount <
				(luckyPool.length > 0 ? luckyPool.length : topRatedVideos.length);

	const handleLoadMore = () => {
		if (recommendMode === "top_rated") {
			setTopRatedCount((prev) => prev + 10);
		} else {
			setLuckyCount((prev) => prev + 10);
		}
	};

	return (
		<div className="popup-container">
			<header className="popup-header">
				<div className="popup-header__brand">
					<h1 className="popup-header__title">
						<a
							href={buildJavRankingUrl(`/${locale}/`, {
								campaign: "header_logo",
							})}
							target="_blank"
							rel="noopener noreferrer"
							className="popup-header__logo-link"
							title="JavRanking Home"
						>
							<img
								src="/brand-logo.png"
								alt="JavRanking"
								className="popup-header__logo"
								width="76"
								height="25"
							/>
						</a>
					</h1>
				</div>
				<div className="popup-header__actions">
					<button
						type="button"
						className="popup-header__icon-btn"
						onClick={() => runScan()}
						title={
							locale === "zh-hans"
								? "重新扫描页面"
								: locale === "zh-hant"
									? "重新掃描頁面"
									: "Rescan Page"
						}
						aria-label="Rescan"
					>
						<svg
							className={`icon-refresh ${status === "loading" ? "icon-refresh--spinning" : ""}`}
							viewBox="0 0 20 20"
							fill="currentColor"
							width="16"
							height="16"
							aria-hidden="true"
						>
							<path
								fillRule="evenodd"
								d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
								clipRule="evenodd"
							/>
						</svg>
					</button>
					<button
						type="button"
						className={`popup-header__icon-btn ${showSettings ? "popup-header__icon-btn--active" : ""}`}
						onClick={() => setShowSettings(!showSettings)}
						title={t.settingsTitle}
						aria-label={t.settingsTitle}
					>
						<svg
							className="icon-gear"
							viewBox="0 0 20 20"
							fill="currentColor"
							width="16"
							height="16"
							aria-hidden="true"
						>
							<path
								fillRule="evenodd"
								d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
								clipRule="evenodd"
							/>
						</svg>
					</button>
				</div>
			</header>

			{truncated && !showSettings && (
				<div className="popup-alert popup-alert--warning" role="alert">
					<svg
						className="icon-warning"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							fillRule="evenodd"
							d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
							clipRule="evenodd"
						/>
					</svg>
					<span>{t.truncatedWarning}</span>
				</div>
			)}

			<main className="popup-main">
				{showSettings ? (
					<SettingsView
						t={t}
						onBack={() => {
							setShowSettings(false);
							runScan();
						}}
						onLocaleChange={(newLocale) => setLocale(newLocale)}
					/>
				) : (
					<>
						{status === "loading" && (
							<div className="popup-state popup-state--loading">
								<div className="spinner" aria-hidden="true" />
								<p className="popup-state__message">{t.loading}</p>
							</div>
						)}

						{status === "excluded_site" && (
							<div className="popup-state popup-state--empty popup-state--excluded">
								<div className="popup-state__icon">🚫</div>
								<h2 className="popup-state__title">{t.excludedSiteTitle}</h2>
								<p className="popup-state__desc">{t.excludedSiteDesc}</p>
								<button
									type="button"
									className="popup-btn popup-btn--secondary"
									style={{ marginTop: 16 }}
									onClick={() => setShowSettings(true)}
								>
									{t.manageExcludedSites}
								</button>
							</div>
						)}

						{status === "unsupported_page" && (
							<div className="popup-state popup-state--empty">
								<div className="popup-state__icon">🔒</div>
								<h2 className="popup-state__title">{t.unsupportedPageTitle}</h2>
								<p className="popup-state__desc">{t.unsupportedPageDesc}</p>
								<button
									type="button"
									className="popup-btn popup-btn--primary"
									style={{ marginTop: 16 }}
									onClick={runScan}
								>
									{t.retry}
								</button>
							</div>
						)}

						{status === "no_candidates" && (
							<div className="popup-empty-container">
								<div className="popup-empty-notice">
									<span className="popup-empty-notice__icon">🔍</span>
									<div className="popup-empty-notice__text">
										<h2 className="popup-empty-notice__title">
											{t.noCandidatesTitle}
										</h2>
										<p className="popup-empty-notice__desc">
											{t.noCandidatesDesc}
										</p>
									</div>
								</div>

								{indexVideos.length > 0 && (
									<div className="popup-recommendations">
										<div className="popup-recommendations__bar">
											<div className="popup-recommendations__headline">
												<span className="popup-recommendations__badge">🔥</span>
												<h3 className="popup-recommendations__title">
													{t.recommendedTitle}
												</h3>
											</div>
											<div className="popup-recommendations__tabs" role="tablist">
												<button
													type="button"
													role="tab"
													aria-selected={recommendMode === "lucky"}
													className={`popup-recommendations__tab ${
														recommendMode === "lucky"
															? "popup-recommendations__tab--active"
															: ""
													}`}
													onClick={() => {
														setRecommendMode("lucky");
														if (luckyPool.length === 0 && indexVideos.length > 0) {
															setLuckyPool(
																[...indexVideos].sort(() => Math.random() - 0.5),
															);
														}
													}}
												>
													{t.feelingLucky}
												</button>
												<button
													type="button"
													role="tab"
													aria-selected={recommendMode === "top_rated"}
													className={`popup-recommendations__tab ${
														recommendMode === "top_rated"
															? "popup-recommendations__tab--active"
															: ""
													}`}
													onClick={() => setRecommendMode("top_rated")}
												>
													{t.topRated}
												</button>
											</div>
										</div>

										<div className="popup-results__list">
											{displayedVideos.map((video, idx) => (
												<ResultCard
													key={`${video.videoId}-${recommendMode}-${idx}`}
													item={{
														candidate: video.code || "",
														comparisonKey: toComparisonKey(video.code || ""),
														video,
													}}
													locale={locale}
													t={t}
													showLocate={false}
												/>
											))}
										</div>

										{hasMoreRecommendations && (
											<div className="popup-recommendations__footer">
												<button
													type="button"
													className="popup-btn popup-btn--secondary popup-recommendations__more-btn"
													onClick={handleLoadMore}
												>
													{t.loadMore}
												</button>
											</div>
										)}
									</div>
								)}
							</div>
						)}

						{status === "no_confirmed_matches" && (
							<div className="popup-no-matches">
								<div className="popup-state popup-state--empty">
									<div className="popup-state__icon">📋</div>
									<h2 className="popup-state__title">{t.noConfirmedTitle}</h2>
									<p className="popup-state__desc">{t.noConfirmedDesc}</p>
									<p className="popup-state__subdesc">
										{t.summary(candidateCount, 0)}
									</p>
								</div>
								{unmatchedCandidates.length > 0 && (
									<UnmatchedList candidates={unmatchedCandidates} t={t} />
								)}
							</div>
						)}

						{status === "error" && (
							<div className="popup-state popup-state--error">
								<div className="popup-state__icon">⚠️</div>
								<h2 className="popup-state__title">{t.errorTitle}</h2>
								<p className="popup-state__desc">
									{errorMessage || t.errorDesc}
								</p>
								<button
									type="button"
									className="popup-btn popup-btn--primary"
									onClick={runScan}
								>
									{t.retry}
								</button>
							</div>
						)}

						{status === "results" && (
							<div className="popup-results">
								<div className="popup-results__bar">
									<span className="popup-results__summary">
										{t.summary(candidateCount, matchedResults.length)}
									</span>
									<p className="popup-results__hint">{t.clickHint}</p>
								</div>
								<div className="popup-results__list">
									{matchedResults.map((item) => (
										<ResultCard
											key={`${item.video.videoId}-${item.comparisonKey}`}
											item={item}
											locale={locale}
											t={t}
										/>
									))}
								</div>
								{unmatchedCandidates.length > 0 && (
									<UnmatchedList candidates={unmatchedCandidates} t={t} />
								)}
							</div>
						)}
					</>
				)}
			</main>
		</div>
	);
};
