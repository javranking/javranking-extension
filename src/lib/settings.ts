import { detectLocale } from "./locales";
import type { SupportedLocale } from "./types";

export const DEFAULT_CODE_REGEX = "\\b[A-Za-z]{3,6}[-—–\\s]+\\d{3,6}\\b";

export interface ExtensionSettings {
	missavTemplate: string;
	javbusTemplate: string;
	excludedHosts: string[];
	customRegex: string;
}

export type LocaleOption = "auto" | SupportedLocale;

export const SETTINGS_STORAGE_KEY = "javranking_search_settings";
export const LOCALE_STORAGE_KEY = "javranking_user_locale";

export const DEFAULT_SETTINGS: ExtensionSettings = {
	missavTemplate: "https://missav.ws/cn/{code}",
	javbusTemplate: "https://javdb.com/search?q={code}",
	excludedHosts: ["javranking.cc"],
	customRegex: DEFAULT_CODE_REGEX,
};

export function normalizeDomain(input: string): string {
	let str = (input || "").trim().toLowerCase();
	if (!str) return "";
	str = str.replace(/^[a-z]+:\/\//i, "");
	str = str.split("/")[0]?.split("?")[0]?.split("#")[0] ?? "";
	str = str.split(":")[0] ?? "";
	str = str.replace(/^\.+|\.+$/g, "");
	return str;
}

export function isHostExcluded(
	targetUrlOrHost: string,
	excludedHosts: string[],
): boolean {
	if (!targetUrlOrHost || !excludedHosts || excludedHosts.length === 0) {
		return false;
	}
	let host = targetUrlOrHost.trim().toLowerCase();
	try {
		if (host.includes("://")) {
			host = new URL(host).hostname.toLowerCase();
		} else {
			host = normalizeDomain(host);
		}
	} catch {
		host = normalizeDomain(host);
	}
	if (!host) return false;

	return excludedHosts.some((excluded) => {
		const normExcluded = normalizeDomain(excluded);
		if (!normExcluded) return false;
		return host === normExcluded || host.endsWith("." + normExcluded);
	});
}

export function isValidRegex(pattern: string): boolean {
	if (!pattern || !pattern.trim()) return false;
	try {
		new RegExp(pattern.trim(), "gi");
		return true;
	} catch {
		return false;
	}
}

function getStorage(): Storage | null {
	try {
		if (typeof localStorage !== "undefined") {
			return localStorage;
		}
		if (typeof window !== "undefined" && window.localStorage) {
			return window.localStorage;
		}
	} catch {
		// Ignore access errors
	}
	return null;
}

export function getSettings(): ExtensionSettings {
	try {
		const storage = getStorage();
		if (!storage) {
			return { ...DEFAULT_SETTINGS };
		}
		const raw = storage.getItem(SETTINGS_STORAGE_KEY);
		if (!raw) {
			return { ...DEFAULT_SETTINGS };
		}
		const parsed = JSON.parse(raw);
		const excludedHosts = Array.isArray(parsed.excludedHosts)
			? parsed.excludedHosts
					.map((h: unknown) => (typeof h === "string" ? normalizeDomain(h) : ""))
					.filter(Boolean)
			: DEFAULT_SETTINGS.excludedHosts;

		return {
			missavTemplate:
				typeof parsed.missavTemplate === "string" &&
				parsed.missavTemplate.trim()
					? parsed.missavTemplate.trim()
					: DEFAULT_SETTINGS.missavTemplate,
			javbusTemplate:
				typeof parsed.javbusTemplate === "string" &&
				parsed.javbusTemplate.trim()
					? parsed.javbusTemplate.trim()
					: DEFAULT_SETTINGS.javbusTemplate,
			excludedHosts:
				excludedHosts.length > 0 ? excludedHosts : [...DEFAULT_SETTINGS.excludedHosts],
			customRegex:
				typeof parsed.customRegex === "string" && parsed.customRegex.trim()
					? parsed.customRegex.trim()
					: DEFAULT_SETTINGS.customRegex,
		};
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function saveSettings(
	settings: Partial<ExtensionSettings>,
): ExtensionSettings {
	try {
		const current = getSettings();
		const updated: ExtensionSettings = {
			missavTemplate:
				settings.missavTemplate !== undefined &&
				settings.missavTemplate.trim()
					? settings.missavTemplate.trim()
					: current.missavTemplate,
			javbusTemplate:
				settings.javbusTemplate !== undefined &&
				settings.javbusTemplate.trim()
					? settings.javbusTemplate.trim()
					: current.javbusTemplate,
			excludedHosts:
				settings.excludedHosts !== undefined
					? Array.from(
							new Set(
								settings.excludedHosts
									.map(normalizeDomain)
									.filter(Boolean),
							),
						)
					: current.excludedHosts,
			customRegex:
				settings.customRegex !== undefined && settings.customRegex.trim()
					? settings.customRegex.trim()
					: current.customRegex,
		};
		const storage = getStorage();
		if (storage) {
			storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
		}
		return updated;
	} catch {
		return getSettings();
	}
}

export function resetSettings(): ExtensionSettings {
	try {
		const storage = getStorage();
		if (storage) {
			storage.setItem(
				SETTINGS_STORAGE_KEY,
				JSON.stringify(DEFAULT_SETTINGS),
			);
		}
	} catch {
		// Ignore storage write errors
	}
	return { ...DEFAULT_SETTINGS };
}

export function getSavedLocale(): LocaleOption {
	try {
		const storage = getStorage();
		if (!storage) return "auto";
		const val = storage.getItem(LOCALE_STORAGE_KEY);
		if (val === "zh-hans" || val === "zh-hant" || val === "en") {
			return val;
		}
		return "auto";
	} catch {
		return "auto";
	}
}

export function saveLocale(locale: LocaleOption): void {
	try {
		const storage = getStorage();
		if (storage) {
			storage.setItem(LOCALE_STORAGE_KEY, locale);
		}
	} catch {
		// Ignore write error
	}
}

export function getEffectiveLocale(savedOption?: LocaleOption): SupportedLocale {
	const opt = savedOption !== undefined ? savedOption : getSavedLocale();
	if (opt === "zh-hans" || opt === "zh-hant" || opt === "en") {
		return opt;
	}
	return detectLocale();
}

export function resolveSearchUrl(template: string, code: string): string {
	const trimmedTemplate = (template || "").trim();
	if (!trimmedTemplate) {
		return `https://javdb.com/search?q=${encodeURIComponent(code)}`;
	}

	const encoded = encodeURIComponent(code);

	// Check for placeholder patterns: {code}, {番号}, {ID}
	if (/\{(?:code|番号|id)\}/i.test(trimmedTemplate)) {
		return trimmedTemplate.replace(/\{(?:code|番号|id)\}/gi, encoded);
	}

	// No placeholder: append code cleanly
	if (trimmedTemplate.endsWith("=") || trimmedTemplate.endsWith("/")) {
		return `${trimmedTemplate}${encoded}`;
	}

	if (trimmedTemplate.includes("?")) {
		return `${trimmedTemplate}&q=${encoded}`;
	}

	return `${trimmedTemplate}/${encoded}`;
}
