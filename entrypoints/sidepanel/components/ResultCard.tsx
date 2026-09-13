import React, { useState } from "react";
import { locateCodeInActiveTab } from "../../../src/lib/locate-code";
import type { LocaleMessages } from "../../../src/lib/locales";
import type { MatchedResult, SupportedLocale } from "../../../src/lib/types";
import { buildJavRankingUrl } from "../../../src/lib/url";

interface ResultCardProps {
	item: MatchedResult;
	locale: SupportedLocale;
	t: LocaleMessages;
	showLocate?: boolean;
}

const APPROVED_HOSTS = [
	"javranking.cc",
	"static.javranking.cc",
	"c0.jdbstatic.com",
	"jdbstatic.com",
];

function isApprovedCover(url: string | null): boolean {
	if (!url) return false;
	try {
		const parsed = new URL(url);
		return (
			parsed.protocol === "https:" &&
			APPROVED_HOSTS.some(
				(host) =>
					parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
			)
		);
	} catch {
		return false;
	}
}

export const ResultCard: React.FC<ResultCardProps> = ({
	item,
	locale,
	t,
	showLocate = true,
}) => {
	const { video } = item;
	const [expanded, setExpanded] = useState(false);
	const [imageError, setImageError] = useState(false);
	const [locateState, setLocateState] = useState<{
		status: "idle" | "success" | "not_found";
		index?: number;
		total?: number;
	}>({ status: "idle" });

	const appearances = video.rankingAppearances || [];
	const visibleAppearances = expanded ? appearances : appearances.slice(0, 3);
	const hasMore = appearances.length > 3;

	const detailUrl = buildJavRankingUrl(`/${locale}/videos/${video.videoId}/`, {
		campaign: "card",
	});

	const validCover = !imageError && isApprovedCover(video.coverUrl);

	// Format actors string with gender icons (e.g. 涼森れむ ♀ · イセドン内村 ♂)
	const actorsText =
		video.actorLinks && video.actorLinks.length > 0
			? video.actorLinks
					.map((a) => {
						const symbol =
							a.gender === "female" ? " ♀" : a.gender === "male" ? " ♂" : "";
						return `${a.name}${symbol}`;
					})
					.join(" · ")
			: null;

	const handleCardClick = (e: React.MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.closest("button") || target.closest("a")) {
			return;
		}
		window.open(detailUrl, "_blank", "noopener,noreferrer");
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			const target = e.target as HTMLElement;
			if (target.closest("button") || target.closest("a")) {
				return;
			}
			e.preventDefault();
			window.open(detailUrl, "_blank", "noopener,noreferrer");
		}
	};

	const handleLocate = async (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		const codeToLocate = item.candidate || video.code;
		if (!codeToLocate) return;

		const res = await locateCodeInActiveTab(codeToLocate);
		setLocateState({
			status: res.found ? "success" : "not_found",
			index: res.matchIndex,
			total: res.totalMatches,
		});
		setTimeout(() => {
			setLocateState({ status: "idle" });
		}, 3000);
	};

	return (
		<article
			className="result-card"
			onClick={handleCardClick}
			onKeyDown={handleKeyDown}
			tabIndex={0}
			role="link"
			aria-label={`${video.code || ""} ${video.title}`}
		>
			{/* Top Hero: 3:2 landscape cover on left, metadata on right */}
			<div className="result-card__hero">
				<div className="result-card__cover-wrap">
					{video.rank !== undefined && (
						<div
							className="result-card__rank-badge"
							title={t.allTimeRankBadge(video.rank)}
							aria-label={t.allTimeRankBadge(video.rank)}
						>
							{t.allTimeRankBadge(video.rank)}
						</div>
					)}
					{validCover && video.coverUrl ? (
						<a
							href={detailUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="result-card__cover-link"
							tabIndex={-1}
							onClick={(e) => e.stopPropagation()}
						>
							<img
								src={video.coverUrl}
								alt={`${video.code || ""} ${video.title}`}
								className="result-card__cover"
								loading="lazy"
								referrerPolicy="no-referrer"
								onError={() => setImageError(true)}
							/>
						</a>
					) : (
						<div className="result-card__cover-fallback" aria-label={t.noCover}>
							<span>{video.code || "NO CODE"}</span>
						</div>
					)}
					<div className="result-card__play-badge" aria-hidden="true">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="currentColor"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="icon-play-badge"
						>
							<path stroke="none" d="M0 0h24v24H0z" fill="none" />
							<path d="M7 4v16l13 -8l-13 -8" />
						</svg>
					</div>
				</div>

				<div className="result-card__meta">
					<div className="result-card__header-line">
						<span className="result-card__code">{video.code}</span>
						{showLocate && (
							<button
								type="button"
								className={`result-card__locate-btn ${
									locateState.status === "success"
										? "result-card__locate-btn--success"
										: locateState.status === "not_found"
											? "result-card__locate-btn--fail"
											: ""
								}`}
								onClick={handleLocate}
								title={t.locateTitle}
								aria-label={`${t.locateTitle}: ${video.code || ""}`}
							>
								{locateState.status === "success" ? (
									<>
										<svg
											className="icon-locate"
											viewBox="0 0 20 20"
											fill="currentColor"
											width="11"
											height="11"
											aria-hidden="true"
										>
											<path
												fillRule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clipRule="evenodd"
											/>
										</svg>
										<span>
											{locateState.total && locateState.total > 1
												? `${locateState.index}/${locateState.total}`
												: t.locateSuccess}
										</span>
									</>
								) : locateState.status === "not_found" ? (
									<span>{t.locateNotFound}</span>
								) : (
									<>
										<svg
											className="icon-locate"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2.2"
											strokeLinecap="round"
											strokeLinejoin="round"
											width="11"
											height="11"
											aria-hidden="true"
										>
											<circle cx="12" cy="12" r="7" />
											<line x1="12" y1="1" x2="12" y2="5" />
											<line x1="12" y1="19" x2="12" y2="23" />
											<line x1="1" y1="12" x2="5" y2="12" />
											<line x1="19" y1="12" x2="23" y2="12" />
										</svg>
										<span>{t.locate}</span>
									</>
								)}
							</button>
						)}
					</div>

					{actorsText && (
						<div className="result-card__actors" title={actorsText}>
							{actorsText}
						</div>
					)}

					<h3 className="result-card__title">
						<a
							href={detailUrl}
							target="_blank"
							rel="noopener noreferrer"
							title={video.title}
							onClick={(e) => e.stopPropagation()}
						>
							{video.title}
						</a>
					</h3>
				</div>
			</div>

			{/* Bottom: Ranking appearances list */}
			{appearances.length > 0 && (
				<div className="result-card__rankings-section">
					<ul className="result-card__ranking-list">
						{visibleAppearances.map((app, idx) => {
							const displayName =
								app.year && !app.name.includes(String(app.year))
									? `${app.name} ${app.year}`
									: app.name;
							const rankingUrl = buildJavRankingUrl(
								`/${locale}/rankings/${app.slug}/`,
								{ campaign: "card-ranking" },
							);
							return (
								<li
									key={`${app.slug}-${app.position}-${idx}`}
									className="result-card__ranking-item"
								>
									<a
										href={rankingUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="result-card__ranking-link"
										onClick={(e) => e.stopPropagation()}
										title={`${displayName} #${app.position}`}
									>
										<strong className="result-card__ranking-pos">
											#{app.position}
										</strong>
										<span className="result-card__ranking-name">
											{displayName}
										</span>
										<svg
											className="result-card__ranking-arrow"
											viewBox="0 0 20 20"
											fill="currentColor"
											width="12"
											height="12"
											aria-hidden="true"
										>
											<path
												fillRule="evenodd"
												d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
												clipRule="evenodd"
											/>
										</svg>
									</a>
								</li>
							);
						})}
					</ul>
					{hasMore && (
						<button
							type="button"
							className="result-card__toggle-btn"
							onClick={(e) => {
								e.stopPropagation();
								setExpanded(!expanded);
							}}
							aria-expanded={expanded}
						>
							{expanded
								? t.collapseHonours
								: `${t.expandHonours} (${appearances.length})`}
						</button>
					)}
				</div>
			)}
		</article>
	);
};
