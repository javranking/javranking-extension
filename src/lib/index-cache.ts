import type {
	IndexCacheMeta,
	SearchIndex,
	SearchIndexManifest,
	SupportedLocale,
} from "./types";

export const META_STORAGE_KEY = "javranking_index_meta";
export const DATA_STORAGE_KEY = "javranking_index_data";

export const SOFT_REVALIDATE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours
export const HARD_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const DEFAULT_BASE_URL = "https://javranking.top";

export async function sha256Hex16(text: string): Promise<string> {
	if (typeof crypto !== "undefined" && crypto.subtle) {
		const buffer = new TextEncoder().encode(text);
		const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")
			.slice(0, 16);
	}
	let hash = 0;
	for (let i = 0; i < text.length; i++) {
		hash = (hash << 5) - hash + text.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash).toString(16).padStart(16, "0").slice(0, 16);
}

export class IndexCacheManager {
	private baseUrl: string;

	constructor(baseUrl = DEFAULT_BASE_URL) {
		this.baseUrl = baseUrl.replace(/\/+$/, "");
	}

	public getMeta(): IndexCacheMeta | null {
		try {
			const raw = localStorage.getItem(META_STORAGE_KEY);
			if (!raw) return null;
			return JSON.parse(raw) as IndexCacheMeta;
		} catch {
			return null;
		}
	}

	public setMeta(meta: IndexCacheMeta): void {
		try {
			localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
		} catch (e) {
			console.warn("Failed to write index meta to localStorage:", e);
		}
	}

	public getData(): string | null {
		try {
			return localStorage.getItem(DATA_STORAGE_KEY);
		} catch {
			return null;
		}
	}

	public setData(dataStr: string): boolean {
		try {
			localStorage.setItem(DATA_STORAGE_KEY, dataStr);
			return true;
		} catch (e) {
			console.warn(
				"QuotaExceededError writing index data to localStorage, clearing old cache:",
				e,
			);
			try {
				localStorage.removeItem(DATA_STORAGE_KEY);
				localStorage.removeItem(META_STORAGE_KEY);
			} catch {
				// ignore
			}
			return false;
		}
	}

	public clearCache(): void {
		try {
			localStorage.removeItem(META_STORAGE_KEY);
			localStorage.removeItem(DATA_STORAGE_KEY);
		} catch {
			// ignore
		}
	}

	/**
	 * Loads the search index with Cache-First + Stale-While-Revalidate + 30-day hard TTL.
	 */
	public async loadIndex(locale: SupportedLocale): Promise<SearchIndex> {
		const now = Date.now();
		const meta = this.getMeta();

		// Check if active locale matches and cache exists
		if (meta && meta.locale === locale && meta.schemaVersion === 2) {
			const age = now - meta.cachedAt;
			// Within 30-day hard TTL
			if (age <= HARD_TTL_MS) {
				const dataStr = this.getData();
				if (dataStr) {
					try {
						const cachedIndex = JSON.parse(dataStr) as SearchIndex;
						if (Array.isArray(cachedIndex.videos)) {
							// Ensure cached data contains the ranking structure (rank / appearances)
							const hasRankingData =
								cachedIndex.videos.length === 0 ||
								cachedIndex.videos.some(
									(v) =>
										v.rank !== undefined ||
										(v.rankingAppearances && v.rankingAppearances.length > 0),
								);

							if (!hasRankingData) {
								this.clearCache();
								return this.fetchAndCache(locale);
							}

							// Check if 12-hour soft window has elapsed -> revalidate in background
							if (now - meta.lastCheckedAt >= SOFT_REVALIDATE_WINDOW_MS) {
								this.revalidateInBackground(locale, meta).catch((err) => {
									console.warn("Background revalidation error:", err);
								});
							}
							return cachedIndex;
						}
					} catch {
						// Malformed JSON, fall through to fetch
					}
				}
			}
		} else if (meta && meta.locale !== locale) {
			// User changed locale; clear previous locale cache to save quota
			this.clearCache();
		}

		// Cache miss, expired, or corrupted: fetch fresh from server
		return this.fetchAndCache(locale);
	}

	private async fetchAndCache(locale: SupportedLocale): Promise<SearchIndex> {
		const manifestUrl = `${this.baseUrl}/${locale}/search-index-manifest.json`;
		const indexUrl = `${this.baseUrl}/${locale}/search-index.json`;

		const [manifestRes, indexRes] = await Promise.all([
			fetch(manifestUrl).catch(() => null),
			fetch(indexUrl),
		]);

		if (!indexRes.ok) {
			throw new Error(`Failed to fetch search index: HTTP ${indexRes.status}`);
		}

		const indexContentType = indexRes.headers.get("content-type") || "";
		if (!indexContentType.includes("application/json")) {
			throw new Error(
				`Expected JSON from ${indexUrl}, received ${indexContentType || "unknown"}`,
			);
		}

		const rawIndexText = await indexRes.text();
		let index: SearchIndex;
		try {
			index = JSON.parse(rawIndexText) as SearchIndex;
		} catch (e) {
			throw new Error(
				`Failed to parse search index JSON: ${e instanceof Error ? e.message : String(e)}`,
			);
		}

		// Backward-compatibility: ensure fields exist even if fetched from v1 server
		if (!index.schemaVersion) {
			index.schemaVersion = 2;
		}
		if (Array.isArray(index.videos)) {
			for (const video of index.videos) {
				if (!video.rankingAppearances) video.rankingAppearances = [];
				if (typeof video.hasPreviewVideo !== "boolean") {
					video.hasPreviewVideo = false;
				}
			}
		}

		// Parse manifest if valid and JSON
		let revision = "";
		if (
			manifestRes &&
			manifestRes.ok &&
			(manifestRes.headers.get("content-type") || "").includes("application/json")
		) {
			try {
				const manifest = (await manifestRes.json()) as SearchIndexManifest;
				if (manifest.schemaVersion === 2 && manifest.revision) {
					revision = manifest.revision;
				}
			} catch {
				// ignore manifest parse failure
			}
		}

		// If manifest is unavailable or not JSON (e.g. server hasn't deployed manifest yet),
		// derive revision directly using SHA-256
		if (!revision) {
			revision = await sha256Hex16(rawIndexText);
		}

		const now = Date.now();
		const saved = this.setData(rawIndexText);
		if (saved) {
			this.setMeta({
				schemaVersion: 2,
				locale,
				revision,
				cachedAt: now,
				lastCheckedAt: now,
			});
		}

		return index;
	}

	private async revalidateInBackground(
		locale: SupportedLocale,
		currentMeta: IndexCacheMeta,
	): Promise<void> {
		try {
			const manifestUrl = `${this.baseUrl}/${locale}/search-index-manifest.json`;
			const res = await fetch(manifestUrl);
			if (!res.ok) return;

			const contentType = res.headers.get("content-type") || "";
			if (!contentType.includes("application/json")) return;

			const manifest = (await res.json()) as SearchIndexManifest;
			if (manifest.schemaVersion !== 2 || !manifest.revision) return;

			const now = Date.now();
			if (manifest.revision === currentMeta.revision) {
				// Same revision, just update lastCheckedAt
				this.setMeta({
					...currentMeta,
					lastCheckedAt: now,
				});
			} else {
				// Revision changed: fetch new index and update cache
				const indexUrl = `${this.baseUrl}/${locale}/search-index.json`;
				const indexRes = await fetch(indexUrl);
				if (!indexRes.ok) return;

				const indexContentType = indexRes.headers.get("content-type") || "";
				if (!indexContentType.includes("application/json")) return;

				const rawIndexText = await indexRes.text();
				const saved = this.setData(rawIndexText);
				if (saved) {
					this.setMeta({
						schemaVersion: 2,
						locale,
						revision: manifest.revision,
						cachedAt: now,
						lastCheckedAt: now,
					});
				}
			}
		} catch (e) {
			console.warn("Background revalidate failed:", e);
		}
	}
}
