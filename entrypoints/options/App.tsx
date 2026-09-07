import React, { useState } from "react";
import { detectLocale, messages } from "../../src/lib/locales";
import type { SupportedLocale } from "../../src/lib/types";
import { buildJavRankingUrl } from "../../src/lib/url";
import { SettingsView } from "../sidepanel/components/SettingsView";
import { UpdateNotice } from "../shared/UpdateNotice";

export const App: React.FC = () => {
	const [locale] = useState<SupportedLocale>(detectLocale());
	const t = messages[locale];

	return (
		<div className="popup-container" style={{ maxWidth: 540, margin: "24px auto" }}>
			<header className="popup-header">
				<div className="popup-header__brand">
					<h1 className="popup-header__title">
						<img
							src="/brand-logo.png"
							alt="JavRanking"
							className="popup-header__logo"
							width="76"
							height="25"
						/>
					</h1>
					<span className="popup-header__locale">{locale}</span>
				</div>
				<a
					href={buildJavRankingUrl(`/${locale}/`, { campaign: "options" })}
					target="_blank"
					rel="noopener noreferrer"
					className="popup-header__home-link"
					title="JavRanking Home"
				>
					javranking.top
				</a>
			</header>
			<UpdateNotice t={t} />

			<main className="popup-main">
				<SettingsView
					t={t}
					onBack={() => {
						if (window.history.length > 1) {
							window.history.back();
						} else {
							window.close();
						}
					}}
				/>
			</main>
		</div>
	);
};
