import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_SETTINGS,
	getEffectiveLocale,
	getSavedLocale,
	getSettings,
	isHostExcluded,
	isValidRegex,
	normalizeDomain,
	resetSettings,
	resolveSearchUrl,
	saveLocale,
	saveSettings,
} from "../src/lib/settings";

describe("settings", () => {
	let storageMock: Record<string, string> = {};

	beforeEach(() => {
		storageMock = {};
		vi.stubGlobal("localStorage", {
			getItem: vi.fn((key: string) => storageMock[key] ?? null),
			setItem: vi.fn((key: string, val: string) => {
				storageMock[key] = val;
			}),
			removeItem: vi.fn((key: string) => {
				delete storageMock[key];
			}),
			clear: vi.fn(() => {
				storageMock = {};
			}),
		});
	});

	it("returns default settings when localStorage is empty", () => {
		const settings = getSettings();
		expect(settings).toEqual(DEFAULT_SETTINGS);
	});

	it("saves and retrieves custom templates", () => {
		saveSettings({
			missavTemplate: "https://custom.missav.ai/{code}",
			javbusTemplate: "https://www.javbus.com/{code}",
		});

		const saved = getSettings();
		expect(saved.missavTemplate).toBe("https://custom.missav.ai/{code}");
		expect(saved.javbusTemplate).toBe("https://www.javbus.com/{code}");
	});

	it("resets to default settings", () => {
		saveSettings({
			missavTemplate: "https://custom.example.com/{code}",
		});
		expect(getSettings().missavTemplate).toBe(
			"https://custom.example.com/{code}",
		);

		resetSettings();
		expect(getSettings()).toEqual(DEFAULT_SETTINGS);
	});

	describe("resolveSearchUrl", () => {
		it("replaces {code} placeholder", () => {
			const url = resolveSearchUrl("https://missav.ws/cn/{code}", "ABP-123");
			expect(url).toBe("https://missav.ws/cn/ABP-123");
		});

		it("replaces {番号} placeholder", () => {
			const url = resolveSearchUrl(
				"https://javdb.com/search?q={番号}",
				"SNIS-456",
			);
			expect(url).toBe("https://javdb.com/search?q=SNIS-456");
		});

		it("appends code when template has trailing slash", () => {
			const url = resolveSearchUrl("https://www.javbus.com/", "SSIS-001");
			expect(url).toBe("https://www.javbus.com/SSIS-001");
		});

		it("appends code when template has trailing equals", () => {
			const url = resolveSearchUrl("https://example.com/search?k=", "FC2-123");
			expect(url).toBe("https://example.com/search?k=FC2-123");
		});
	});

	describe("locale settings", () => {
		it("defaults to auto when storage is empty", () => {
			expect(getSavedLocale()).toBe("auto");
		});

		it("saves and retrieves locale preference", () => {
			saveLocale("zh-hant");
			expect(getSavedLocale()).toBe("zh-hant");
			saveLocale("en");
			expect(getSavedLocale()).toBe("en");
			saveLocale("auto");
			expect(getSavedLocale()).toBe("auto");
		});

		it("resolves effective locale properly", () => {
			expect(getEffectiveLocale("zh-hans")).toBe("zh-hans");
			expect(getEffectiveLocale("zh-hant")).toBe("zh-hant");
			expect(getEffectiveLocale("en")).toBe("en");
			// auto falls back to detectLocale (which uses navigator or 'en')
			expect(["zh-hans", "zh-hant", "en"]).toContain(getEffectiveLocale("auto"));
		});
	});

	describe("domain normalization and host exclusion", () => {
		it("normalizes domains properly", () => {
			expect(normalizeDomain("https://javranking.cc/zh-hans/")).toBe("javranking.cc");
			expect(normalizeDomain("http://SUB.Example.COM:8080/path?q=1")).toBe("sub.example.com");
			expect(normalizeDomain("  foo.bar.org  ")).toBe("foo.bar.org");
		});

		it("correctly identifies excluded hosts and subdomains", () => {
			const excluded = ["javranking.cc", "google.com"];
			expect(isHostExcluded("https://javranking.cc/search", excluded)).toBe(true);
			expect(isHostExcluded("https://static.javranking.cc/cover.jpg", excluded)).toBe(true);
			expect(isHostExcluded("https://sub.sub.google.com/test", excluded)).toBe(true);
			expect(isHostExcluded("https://notjavranking.cc/", excluded)).toBe(false);
			expect(isHostExcluded("https://example.org/", excluded)).toBe(false);
		});
	});

	describe("regex validation and custom regex settings", () => {
		it("validates regex patterns", () => {
			expect(isValidRegex("\\b[A-Za-z]{3,6}[-—–\\s]+\\d{3,6}\\b")).toBe(true);
			expect(isValidRegex("[A-Z]+-\\d+")).toBe(true);
			expect(isValidRegex("[unclosed-group")).toBe(false);
			expect(isValidRegex("")).toBe(false);
		});

		it("saves and restores custom regex and excluded hosts", () => {
			saveSettings({
				excludedHosts: ["custom-site.org", "javranking.cc"],
				customRegex: "\\bFC2[-_\\s]+\\d+\\b",
			});

			const s = getSettings();
			expect(s.excludedHosts).toContain("custom-site.org");
			expect(s.excludedHosts).toContain("javranking.cc");
			expect(s.customRegex).toBe("\\bFC2[-_\\s]+\\d+\\b");

			resetSettings();
			const reset = getSettings();
			expect(reset.excludedHosts).toEqual(DEFAULT_SETTINGS.excludedHosts);
			expect(reset.customRegex).toBe(DEFAULT_SETTINGS.customRegex);
		});
	});
});
