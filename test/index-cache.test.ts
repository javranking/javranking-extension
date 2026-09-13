import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DATA_STORAGE_KEY,
	HARD_TTL_MS,
	IndexCacheManager,
	META_STORAGE_KEY,
	SOFT_REVALIDATE_WINDOW_MS,
} from "../src/lib/index-cache";
import type { SearchIndex, SearchIndexManifest } from "../src/lib/types";

describe("IndexCacheManager", () => {
	let storageMock: Record<string, string> = {};

	const sampleIndex: SearchIndex = {
		schemaVersion: 2,
		videos: [
			{
				videoId: 1,
				code: "ABP-123",
				title: "Sample Video",
				score: 100,
				coverUrl: "https://javranking.cc/cover.jpg",
				releaseDate: "2024-01-01",
				actorLinks: [],
				rankingAppearances: [
					{ slug: "top-250", name: "Top 250", position: 1 },
				],
				hasPreviewVideo: true,
			},
		],
	};

	const sampleManifest: SearchIndexManifest = {
		schemaVersion: 2,
		locale: "zh-hans",
		revision: "rev-1234567890ab",
		generatedAt: "2026-09-04T00:00:00.000Z",
		videoCount: 1,
		byteLength: 500,
	};

	beforeEach(() => {
		storageMock = {};
		vi.stubGlobal("localStorage", {
			getItem: vi.fn((key: string) => storageMock[key] ?? null),
			setItem: vi.fn((key: string, value: string) => {
				storageMock[key] = value;
			}),
			removeItem: vi.fn((key: string) => {
				delete storageMock[key];
			}),
			clear: vi.fn(() => {
				storageMock = {};
			}),
		});

		vi.stubGlobal("fetch", vi.fn());
	});

	it("fetches and caches on cold start", async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes("manifest")) {
				return Promise.resolve({
					ok: true,
					status: 200,
					headers: new Headers({ "content-type": "application/json" }),
					json: () => Promise.resolve(sampleManifest),
				});
			}
			return Promise.resolve({
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				text: () => Promise.resolve(JSON.stringify(sampleIndex)),
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const manager = new IndexCacheManager("https://javranking.cc");
		const index = await manager.loadIndex("zh-hans");

		expect(index.schemaVersion).toBe(2);
		expect(index.videos.length).toBe(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		// Verified written to localStorage
		expect(storageMock[DATA_STORAGE_KEY]).toBeDefined();
		expect(storageMock[META_STORAGE_KEY]).toBeDefined();
		const meta = JSON.parse(storageMock[META_STORAGE_KEY] || "{}");
		expect(meta.revision).toBe("rev-1234567890ab");
		expect(meta.locale).toBe("zh-hans");
	});

	it("falls back gracefully when manifest returns HTML fallback (server not yet deployed)", async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes("manifest")) {
				// Simulating Cloudflare 404/fallback serving HTML
				return Promise.resolve({
					ok: true,
					status: 200,
					headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
					text: () => Promise.resolve("<!DOCTYPE html><html>...</html>"),
					json: () => Promise.reject(new SyntaxError("Unexpected token '<'")),
				});
			}
			return Promise.resolve({
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				text: () => Promise.resolve(JSON.stringify(sampleIndex)),
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const manager = new IndexCacheManager("https://javranking.cc");
		const index = await manager.loadIndex("zh-hans");

		expect(index.schemaVersion).toBe(2);
		expect(index.videos[0]?.code).toBe("ABP-123");
		// Meta was saved with SHA-256 derived revision
		const meta = JSON.parse(storageMock[META_STORAGE_KEY] || "{}");
		expect(meta.revision).toBeDefined();
		expect(meta.revision.length).toBe(16);
	});

	it("returns cached index immediately with 0 fetch calls within soft window", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const now = Date.now();
		storageMock[DATA_STORAGE_KEY] = JSON.stringify(sampleIndex);
		storageMock[META_STORAGE_KEY] = JSON.stringify({
			schemaVersion: 2,
			locale: "zh-hans",
			revision: "rev-1234567890ab",
			cachedAt: now - 1000,
			lastCheckedAt: now - 1000,
		});

		const manager = new IndexCacheManager("https://javranking.cc");
		const index = await manager.loadIndex("zh-hans");

		expect(index.videos[0]?.code).toBe("ABP-123");
		expect(fetchMock).toHaveBeenCalledTimes(0);
	});

	it("triggers background manifest check when soft window has elapsed", async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes("manifest")) {
				return Promise.resolve({
					ok: true,
					status: 200,
					headers: new Headers({ "content-type": "application/json" }),
					json: () => Promise.resolve(sampleManifest),
				});
			}
			return Promise.resolve({
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				text: () => Promise.resolve(JSON.stringify(sampleIndex)),
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const now = Date.now();
		const oldCheck = now - (SOFT_REVALIDATE_WINDOW_MS + 60000); // 12 hours + 1 min
		storageMock[DATA_STORAGE_KEY] = JSON.stringify(sampleIndex);
		storageMock[META_STORAGE_KEY] = JSON.stringify({
			schemaVersion: 2,
			locale: "zh-hans",
			revision: "rev-1234567890ab",
			cachedAt: oldCheck,
			lastCheckedAt: oldCheck,
		});

		const manager = new IndexCacheManager("https://javranking.cc");
		const index = await manager.loadIndex("zh-hans");

		expect(index.videos[0]?.code).toBe("ABP-123");
		// Background manifest fetch was initiated
		expect(fetchMock).toHaveBeenCalledWith(
			"https://javranking.cc/zh-hans/search-index-manifest.json",
		);
	});

	it("forces fresh fetch when local cache exceeds 30-day hard TTL", async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes("manifest")) {
				return Promise.resolve({
					ok: true,
					status: 200,
					headers: new Headers({ "content-type": "application/json" }),
					json: () => Promise.resolve(sampleManifest),
				});
			}
			return Promise.resolve({
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				text: () => Promise.resolve(JSON.stringify(sampleIndex)),
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const now = Date.now();
		const expiredTime = now - (HARD_TTL_MS + 60000); // 30 days + 1 min
		storageMock[DATA_STORAGE_KEY] = JSON.stringify(sampleIndex);
		storageMock[META_STORAGE_KEY] = JSON.stringify({
			schemaVersion: 2,
			locale: "zh-hans",
			revision: "rev-ancient",
			cachedAt: expiredTime,
			lastCheckedAt: expiredTime,
		});

		const manager = new IndexCacheManager("https://javranking.cc");
		const index = await manager.loadIndex("zh-hans");

		expect(index.schemaVersion).toBe(2);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("purges previous locale cache when locale switches", async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes("manifest")) {
				return Promise.resolve({
					ok: true,
					status: 200,
					headers: new Headers({ "content-type": "application/json" }),
					json: () => Promise.resolve({ ...sampleManifest, locale: "en" }),
				});
			}
			return Promise.resolve({
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				text: () => Promise.resolve(JSON.stringify(sampleIndex)),
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const now = Date.now();
		storageMock[DATA_STORAGE_KEY] = "zh-hans data";
		storageMock[META_STORAGE_KEY] = JSON.stringify({
			schemaVersion: 2,
			locale: "zh-hans",
			revision: "rev-zh",
			cachedAt: now,
			lastCheckedAt: now,
		});

		const manager = new IndexCacheManager("https://javranking.cc");
		await manager.loadIndex("en");

		const newMeta = JSON.parse(storageMock[META_STORAGE_KEY] || "{}");
		expect(newMeta.locale).toBe("en");
	});

	it("purges cache and re-fetches when cached index lacks ranking data", async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes("manifest")) {
				return Promise.resolve({
					ok: true,
					status: 200,
					headers: new Headers({ "content-type": "application/json" }),
					json: () => Promise.resolve(sampleManifest),
				});
			}
			return Promise.resolve({
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				text: () => Promise.resolve(JSON.stringify(sampleIndex)),
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const now = Date.now();
		// Simulate old cache before rank was introduced
		const oldIndexWithoutRank = {
			schemaVersion: 2,
			videos: [
				{
					videoId: 99,
					code: "OLD-001",
					title: "Old Video Without Rank",
					score: 50,
					coverUrl: null,
					releaseDate: null,
					actorLinks: [],
					rankingAppearances: [],
					hasPreviewVideo: false,
				},
			],
		};

		storageMock[DATA_STORAGE_KEY] = JSON.stringify(oldIndexWithoutRank);
		storageMock[META_STORAGE_KEY] = JSON.stringify({
			schemaVersion: 2,
			locale: "zh-hans",
			revision: "rev-old",
			cachedAt: now - 1000,
			lastCheckedAt: now - 1000,
		});

		const manager = new IndexCacheManager("https://javranking.cc");
		const index = await manager.loadIndex("zh-hans");

		// Should have purged old cache and fetched fresh index
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(index.videos[0]?.code).toBe("ABP-123");
	});
});
