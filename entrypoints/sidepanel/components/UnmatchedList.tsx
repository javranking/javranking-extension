import React, { useState } from "react";
import { locateCodeInActiveTab } from "../../../src/lib/locate-code";
import type { LocaleMessages } from "../../../src/lib/locales";
import { normalizeCode } from "../../../src/lib/normalize-code";
import { getSettings, resolveSearchUrl } from "../../../src/lib/settings";

interface UnmatchedListProps {
	candidates: string[];
	t: LocaleMessages;
}

export const UnmatchedList: React.FC<UnmatchedListProps> = ({
	candidates,
	t,
}) => {
	if (candidates.length === 0) return null;

	const settings = getSettings();
	const [locateStates, setLocateStates] = useState<
		Record<
			string,
			{
				status: "idle" | "success" | "not_found";
				index?: number;
				total?: number;
			}
		>
	>({});

	// Deduplicate candidates
	const seen = new Set<string>();
	const uniqueCodes: string[] = [];
	for (const candidate of candidates) {
		const normalized = normalizeCode(candidate);
		if (normalized && !seen.has(normalized)) {
			seen.add(normalized);
			uniqueCodes.push(normalized);
		}
	}

	const handleLocate = async (code: string) => {
		const res = await locateCodeInActiveTab(code);
		setLocateStates((prev) => ({
			...prev,
			[code]: {
				status: res.found ? "success" : "not_found",
				index: res.matchIndex,
				total: res.totalMatches,
			},
		}));
		setTimeout(() => {
			setLocateStates((prev) => ({
				...prev,
				[code]: { status: "idle" },
			}));
		}, 3000);
	};

	return (
		<section className="unmatched-section">
			<div className="unmatched-section__header">
				<h3 className="unmatched-section__title">
					{t.unmatchedTitle}{" "}
					<span className="unmatched-section__count">
						({uniqueCodes.length})
					</span>
				</h3>
				<p className="unmatched-section__desc">{t.unmatchedDesc}</p>
			</div>

			<ul className="unmatched-section__list">
				{uniqueCodes.map((code) => {
					const missavUrl = resolveSearchUrl(settings.missavTemplate, code);
					const javdbUrl = resolveSearchUrl(settings.javbusTemplate, code);
					const locateState = locateStates[code] || { status: "idle" };

					return (
						<li key={code} className="unmatched-item">
							<span className="unmatched-item__code">{code}</span>
							<div className="unmatched-item__links">
								<button
									type="button"
									className={`unmatched-item__link unmatched-item__link--locate ${
										locateState.status === "success"
											? "unmatched-item__link--locate-success"
											: locateState.status === "not_found"
												? "unmatched-item__link--locate-fail"
												: ""
									}`}
									onClick={() => handleLocate(code)}
									title={t.locateTitle}
									aria-label={`${t.locateTitle}: ${code}`}
								>
									{locateState.status === "success" ? (
										<>
											<svg
												className="icon-locate"
												viewBox="0 0 20 20"
												fill="currentColor"
												width="13"
												height="13"
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
													? `${t.locateSuccess} (${locateState.index}/${locateState.total})`
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
												width="13"
												height="13"
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
								<a
									href={missavUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="unmatched-item__link unmatched-item__link--missav"
									title={`Search ${code} on MissAV`}
								>
									{t.missav}
								</a>
								<a
									href={javdbUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="unmatched-item__link unmatched-item__link--javdb"
									title={`Search ${code} on JavDB`}
								>
									{t.javdb}
								</a>
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
};
