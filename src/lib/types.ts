export type SupportedLocale = "zh-hans" | "zh-hant" | "en";

export interface EntityLink {
	slug: string;
	name: string;
	gender?: string | null;
}

export interface RankingAppearance {
	slug: string;
	name: string;
	source?: string;
	scope?: string | null;
	year?: number | null;
	position: number;
}

export interface SearchVideo {
	videoId: number;
	code: string | null;
	title: string;
	score: number;
	rank?: number;
	coverUrl: string | null;
	releaseDate: string | null;
	actorLinks: EntityLink[];
	rankingAppearances: RankingAppearance[];
	hasPreviewVideo: boolean;
}

export interface SearchIndex {
	schemaVersion: 2;
	videos: SearchVideo[];
	entities?: unknown[];
}

export interface SearchIndexManifest {
	schemaVersion: 2;
	locale: string;
	revision: string;
	generatedAt: string;
	videoCount: number;
	byteLength: number;
}

export interface IndexCacheMeta {
	schemaVersion: 2;
	locale: SupportedLocale;
	revision: string;
	cachedAt: number;
	lastCheckedAt: number;
}

export interface ExtractionResult {
	candidates: string[];
	truncated: boolean;
	unsupported?: boolean;
}

export interface MatchedResult {
	candidate: string;
	comparisonKey: string;
	video: SearchVideo;
}

export type PopupStatus =
	| "loading"
	| "results"
	| "no_candidates"
	| "no_confirmed_matches"
	| "unsupported_page"
	| "excluded_site"
	| "error";
