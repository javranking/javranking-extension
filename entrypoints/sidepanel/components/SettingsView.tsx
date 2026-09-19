import React, { useEffect, useState } from "react";
import {
	bindExistingChongCode,
	clearChongCode,
	createCloudChongCode,
	getChongCode,
	getCounts,
	syncWithCloud,
} from "../../../src/lib/chong-store";
import type { LocaleMessages } from "../../../src/lib/locales";
import { EXTENSION_VERSION } from "../../../src/lib/release";
import {
	DEFAULT_CODE_REGEX,
	DEFAULT_SETTINGS,
	getEffectiveLocale,
	getSavedLocale,
	getSettings,
	isValidRegex,
	normalizeDomain,
	resetSettings,
	resolveSearchUrl,
	saveLocale,
	saveSettings,
	type LocaleOption,
} from "../../../src/lib/settings";
import type { SupportedLocale } from "../../../src/lib/types";
import { buildJavRankingUrl } from "../../../src/lib/url";

interface SettingsViewProps {
	locale: SupportedLocale;
	t: LocaleMessages;
	onBack: () => void;
	onLocaleChange?: (locale: SupportedLocale) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
	locale,
	t,
	onBack,
	onLocaleChange,
}) => {
	const [missav, setMissav] = useState("");
	const [javbus, setJavbus] = useState("");
	const [localeOption, setLocaleOption] = useState<LocaleOption>("auto");
	const [excludedHosts, setExcludedHosts] = useState<string[]>([]);
	const [newHostInput, setNewHostInput] = useState("");
	const [customRegex, setCustomRegex] = useState("");
	const [regexError, setRegexError] = useState<string | null>(null);
	const [savedMessage, setSavedMessage] = useState(false);

	// Chong Code states
	const [chongCode, setChongCode] = useState<string | null>(() => getChongCode());
	const [counts, setCounts] = useState(() => getCounts());
	const [bindInput, setBindInput] = useState("");
	const [binding, setBinding] = useState(false);
	const [creating, setCreating] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const [copied, setCopied] = useState(false);
	const [bindError, setBindError] = useState<string | null>(null);
	const [syncFeedback, setSyncFeedback] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	useEffect(() => {
		const current = getSettings();
		setMissav(current.missavTemplate);
		setJavbus(current.javbusTemplate);
		setLocaleOption(getSavedLocale());
		setExcludedHosts(current.excludedHosts || DEFAULT_SETTINGS.excludedHosts);
		setCustomRegex(current.customRegex || DEFAULT_CODE_REGEX);
		setChongCode(getChongCode());
		setCounts(getCounts());

		const handleChongUpdate = () => {
			setChongCode(getChongCode());
			setCounts(getCounts());
		};

		window.addEventListener("chong:change", handleChongUpdate);
		window.addEventListener("chong:synced", handleChongUpdate);
		return () => {
			window.removeEventListener("chong:change", handleChongUpdate);
			window.removeEventListener("chong:synced", handleChongUpdate);
		};
	}, []);


	const handleLocaleSelect = (val: LocaleOption) => {
		setLocaleOption(val);
		saveLocale(val);
		const effective = getEffectiveLocale(val);
		onLocaleChange?.(effective);
		setSavedMessage(true);
		setTimeout(() => {
			setSavedMessage(false);
		}, 2000);
	};

	const handleAddHost = () => {
		const norm = normalizeDomain(newHostInput);
		if (!norm) return;
		if (!excludedHosts.includes(norm)) {
			setExcludedHosts([...excludedHosts, norm]);
		}
		setNewHostInput("");
	};

	const handleRemoveHost = (hostToRemove: string) => {
		setExcludedHosts(excludedHosts.filter((h) => h !== hostToRemove));
	};

	const handleRegexChange = (val: string) => {
		setCustomRegex(val);
		if (val.trim() && !isValidRegex(val)) {
			setRegexError(t.regexSyntaxError);
		} else {
			setRegexError(null);
		}
	};

	const handleResetRegex = () => {
		setCustomRegex(DEFAULT_CODE_REGEX);
		setRegexError(null);
	};

	const handleSave = (e: React.FormEvent) => {
		e.preventDefault();
		if (customRegex.trim() && !isValidRegex(customRegex)) {
			setRegexError(t.regexSyntaxError);
			return;
		}
		saveSettings({
			missavTemplate: missav,
			javbusTemplate: javbus,
			excludedHosts,
			customRegex: customRegex.trim() || DEFAULT_CODE_REGEX,
		});
		saveLocale(localeOption);
		onLocaleChange?.(getEffectiveLocale(localeOption));
		setSavedMessage(true);
		setTimeout(() => {
			setSavedMessage(false);
		}, 2000);
	};

	const handleReset = () => {
		resetSettings();
		setMissav(DEFAULT_SETTINGS.missavTemplate);
		setJavbus(DEFAULT_SETTINGS.javbusTemplate);
		setExcludedHosts([...DEFAULT_SETTINGS.excludedHosts]);
		setCustomRegex(DEFAULT_CODE_REGEX);
		setRegexError(null);
		setNewHostInput("");
		saveLocale("auto");
		setLocaleOption("auto");
		onLocaleChange?.(getEffectiveLocale("auto"));
		setSavedMessage(true);
		setTimeout(() => {
			setSavedMessage(false);
		}, 2000);
	};

	const sampleCode = "ABP-123";
	const missavPreview = resolveSearchUrl(missav, sampleCode);
	const javbusPreview = resolveSearchUrl(javbus, sampleCode);

	const handleCopyCode = async () => {
		if (!chongCode) return;
		try {
			await navigator.clipboard.writeText(chongCode);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.warn("Failed to copy chong code", err);
		}
	};

	const handleManualSync = async () => {
		if (!chongCode || syncing) return;
		setSyncing(true);
		setSyncFeedback(null);
		try {
			const res = await syncWithCloud();
			if (res.success) {
				setSyncFeedback({ type: "success", message: t.syncSuccess });
			} else {
				setSyncFeedback({
					type: "error",
					message: res.error || t.syncFailed,
				});
			}
		} catch {
			setSyncFeedback({ type: "error", message: t.syncFailed });
		} finally {
			setSyncing(false);
			setTimeout(() => setSyncFeedback(null), 3000);
		}
	};

	const handleUnbind = () => {
		clearChongCode();
		setChongCode(null);
		setCounts(getCounts());
		setBindError(null);
		setSyncFeedback(null);
	};

	const handleBindExisting = async () => {
		const val = bindInput.trim();
		if (!val || binding || creating) return;
		setBinding(true);
		setBindError(null);
		try {
			const res = await bindExistingChongCode(val);
			if (res.success) {
				setChongCode(getChongCode());
				setCounts(getCounts());
				setBindInput("");
			} else {
				setBindError(res.error || "绑定失败");
			}
		} catch (err) {
			setBindError(err instanceof Error ? err.message : "绑定失败");
		} finally {
			setBinding(false);
		}
	};

	const handleCreateNew = async () => {
		if (binding || creating) return;
		setCreating(true);
		setBindError(null);
		try {
			const res = await createCloudChongCode();
			if (res.success) {
				setChongCode(getChongCode());
				setCounts(getCounts());
			} else {
				setBindError(res.error || "创建失败");
			}
		} catch (err) {
			setBindError(err instanceof Error ? err.message : "创建失败");
		} finally {
			setCreating(false);
		}
	};

	return (
		<div className="settings-view">
			<div className="settings-view__header">
				<button
					type="button"
					className="settings-view__back-btn"
					onClick={onBack}
					title={t.backToScanner}
				>
					<svg
						className="icon-back"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<polyline points="15 18 9 12 15 6" />
					</svg>
					<span>{t.backToScanner}</span>
				</button>
				<h2 className="settings-view__title">{t.settingsTitle}</h2>
			</div>

			<p className="settings-view__desc">{t.settingsDesc}</p>
			<section className="settings-version" aria-labelledby="extension-version-label">
				<span id="extension-version-label" className="settings-version__label">
					{t.extensionVersionLabel}
				</span>
				<code className="settings-version__value">v{EXTENSION_VERSION}</code>
			</section>

			{/* Chong Code Management Section */}
			<section className="chong-section" aria-labelledby="chong-section-title">
				<div className="chong-section__header">
					<h3 id="chong-section-title" className="chong-section__title">
						{t.chongCodeSectionTitle}
					</h3>
					<p className="chong-section__desc">{t.chongCodeSectionDesc}</p>
				</div>

				{chongCode ? (
					<div className="chong-card chong-card--bound">
						<div className="chong-card__top">
							<div className="chong-card__code-info">
								<span className="chong-card__label">{t.chongCode}:</span>
								<code className="chong-card__code">{chongCode}</code>
							</div>
							<div className="chong-card__code-actions">
								<button
									type="button"
									className="popup-btn popup-btn--secondary chong-btn--copy"
									onClick={handleCopyCode}
								>
									{copied ? t.copied : t.copyCode}
								</button>
								<button
									type="button"
									className="popup-btn popup-btn--secondary chong-btn--sync"
									onClick={handleManualSync}
									disabled={syncing}
								>
									{syncing ? t.syncing : t.syncNow}
								</button>
								<button
									type="button"
									className="chong-btn--unbind"
									onClick={handleUnbind}
									title={t.unbindChongCode}
								>
									{t.unbindChongCode}
								</button>
							</div>
						</div>

						<div className="chong-card__stats">
							{t.marksCountSummary(counts.total, counts.done, counts.wish)}
						</div>

						{syncFeedback && (
							<div
								className={`chong-card__feedback chong-card__feedback--${syncFeedback.type}`}
								role="status"
							>
								{syncFeedback.message}
							</div>
						)}

						<p className="chong-card__notice">{t.boundCodeNotice}</p>

						<a
							href={buildJavRankingUrl(`/${locale}/marks`)}
							target="_blank"
							rel="noopener noreferrer"
							className="popup-btn popup-btn--primary chong-mainsite-btn"
						>
							<span>{t.viewOnMainSite}</span>
							<svg
								viewBox="0 0 20 20"
								fill="currentColor"
								width="14"
								height="14"
								aria-hidden="true"
							>
								<path
									fillRule="evenodd"
									d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
									clipRule="evenodd"
								/>
							</svg>
						</a>
					</div>
				) : (
					<div className="chong-card chong-card--unbound">
						<div className="chong-card__status-row">
							<span className="chong-card__unbound-tag">{t.notBound}</span>
						</div>

						{counts.total > 0 && (
							<div className="chong-card__stats">
								{t.localMarksCount(counts.total)}
							</div>
						)}

						<div className="chong-bind-form">
							<input
								type="text"
								className="settings-field__input chong-bind-input"
								placeholder={t.enterChongCodePlaceholder}
								value={bindInput}
								onChange={(e) => setBindInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleBindExisting();
									}
								}}
								disabled={binding || creating}
								spellCheck={false}
								autoComplete="off"
							/>
							<button
								type="button"
								className="popup-btn popup-btn--secondary chong-bind-btn"
								onClick={handleBindExisting}
								disabled={binding || creating || !bindInput.trim()}
							>
								{binding ? "..." : t.bindChongCode}
							</button>
						</div>

						<div className="chong-card__or-divider">
							<span>{t.orDivider}</span>
						</div>

						<button
							type="button"
							className="popup-btn popup-btn--secondary chong-create-btn"
							onClick={handleCreateNew}
							disabled={binding || creating}
						>
							{creating ? "..." : t.createChongCode}
						</button>

						{bindError && (
							<div className="settings-field__error" role="alert">
								{bindError}
							</div>
						)}

						<p className="chong-card__hint">{t.chongCodeHint}</p>

						<a
							href={buildJavRankingUrl(`/${locale}/marks`)}
							target="_blank"
							rel="noopener noreferrer"
							className="chong-mainsite-link"
						>
							<span>{t.viewOnMainSite}</span>
							<span aria-hidden="true">&rarr;</span>
						</a>
					</div>
				)}
			</section>

			<form className="settings-view__form" onSubmit={handleSave}>

				<div className="settings-field">
					<label className="settings-field__label" htmlFor="locale-select">
						{t.languageLabel}
					</label>
					<select
						id="locale-select"
						className="settings-field__select"
						value={localeOption}
						onChange={(e) => handleLocaleSelect(e.target.value as LocaleOption)}
					>
						<option value="auto">{t.languageAuto}</option>
						<option value="zh-hans">简体中文</option>
						<option value="zh-hant">繁體中文</option>
						<option value="en">English</option>
					</select>
				</div>

				<div className="settings-field">
					<label className="settings-field__label">
						{t.excludedSitesLabel}
					</label>
					<p className="settings-field__hint">{t.excludedSitesDesc}</p>
					{excludedHosts.length > 0 && (
						<div className="excluded-hosts-list">
							{excludedHosts.map((host) => (
								<span key={host} className="excluded-host-chip">
									<span className="excluded-host-chip__name">{host}</span>
									<button
										type="button"
										className="excluded-host-chip__remove"
										onClick={() => handleRemoveHost(host)}
										title={`${t.removeSite}: ${host}`}
										aria-label={`${t.removeSite}: ${host}`}
									>
										&times;
									</button>
								</span>
							))}
						</div>
					)}
					<div className="excluded-hosts-add-row">
						<input
							type="text"
							className="settings-field__input excluded-hosts-input"
							value={newHostInput}
							onChange={(e) => setNewHostInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleAddHost();
								}
							}}
							placeholder={t.sitePlaceholder}
							spellCheck={false}
							autoComplete="off"
						/>
						<button
							type="button"
							className="popup-btn popup-btn--secondary excluded-hosts-add-btn"
							onClick={handleAddHost}
						>
							{t.addSite}
						</button>
					</div>
				</div>

				<div className="settings-field">
					<div className="settings-field__header-row">
						<label className="settings-field__label" htmlFor="custom-regex">
							{t.customRegexLabel}
						</label>
						<button
							type="button"
							className="settings-field__reset-link"
							onClick={handleResetRegex}
						>
							{t.resetRegex}
						</button>
					</div>
					<p className="settings-field__hint">{t.customRegexDesc}</p>
					<input
						id="custom-regex"
						type="text"
						className={`settings-field__input settings-field__input--code ${
							regexError ? "settings-field__input--error" : ""
						}`}
						value={customRegex}
						onChange={(e) => handleRegexChange(e.target.value)}
						placeholder={DEFAULT_CODE_REGEX}
						spellCheck={false}
						autoComplete="off"
					/>
					{regexError && (
						<div className="settings-field__error" role="alert">
							{regexError}
						</div>
					)}
				</div>

				<div className="settings-field">
					<label className="settings-field__label" htmlFor="missav-template">
						{t.missavLabel}
					</label>
					<input
						id="missav-template"
						type="text"
						className="settings-field__input"
						value={missav}
						onChange={(e) => setMissav(e.target.value)}
						placeholder={DEFAULT_SETTINGS.missavTemplate}
						spellCheck={false}
						autoComplete="off"
					/>
					<div className="settings-field__preview">
						<span className="settings-field__preview-label">
							{t.previewUrlLabel}
						</span>
						<span className="settings-field__preview-url" title={missavPreview}>
							{missavPreview}
						</span>
					</div>
				</div>

				<div className="settings-field">
					<label className="settings-field__label" htmlFor="javbus-template">
						{t.javbusLabel}
					</label>
					<input
						id="javbus-template"
						type="text"
						className="settings-field__input"
						value={javbus}
						onChange={(e) => setJavbus(e.target.value)}
						placeholder={DEFAULT_SETTINGS.javbusTemplate}
						spellCheck={false}
						autoComplete="off"
					/>
					<div className="settings-field__preview">
						<span className="settings-field__preview-label">
							{t.previewUrlLabel}
						</span>
						<span className="settings-field__preview-url" title={javbusPreview}>
							{javbusPreview}
						</span>
					</div>
				</div>

				<div className="settings-view__actions">
					<button
						type="submit"
						className="popup-btn popup-btn--primary settings-btn--save"
					>
						{t.saveSettings}
					</button>
					<button
						type="button"
						className="settings-btn--reset"
						onClick={handleReset}
					>
						{t.resetDefaults}
					</button>
					{savedMessage && (
						<span className="settings-view__saved-toast">
							{t.settingsSaved}
						</span>
					)}
				</div>
			</form>
		</div>
	);
};
