import React, { useEffect, useState } from "react";
import type { LocaleMessages } from "../../../src/lib/locales";
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
import { EXTENSION_VERSION } from "../../../src/lib/release";

interface SettingsViewProps {
	t: LocaleMessages;
	onBack: () => void;
	onLocaleChange?: (locale: SupportedLocale) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
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

	useEffect(() => {
		const current = getSettings();
		setMissav(current.missavTemplate);
		setJavbus(current.javbusTemplate);
		setLocaleOption(getSavedLocale());
		setExcludedHosts(current.excludedHosts || DEFAULT_SETTINGS.excludedHosts);
		setCustomRegex(current.customRegex || DEFAULT_CODE_REGEX);
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
