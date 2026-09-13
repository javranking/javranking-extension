import { describe, expect, it } from "vitest";
import { buildJavRankingUrl } from "../src/lib/url";

describe("buildJavRankingUrl", () => {
	it("adds utm parameters to root path", () => {
		const url = buildJavRankingUrl("/zh-hans/");
		expect(url).toBe(
			"https://javranking.cc/zh-hans/?utm_source=javranking-extension&utm_medium=popup",
		);
	});

	it("adds utm parameters and optional campaign", () => {
		const url = buildJavRankingUrl("/zh-hans/", { campaign: "header" });
		expect(url).toBe(
			"https://javranking.cc/zh-hans/?utm_source=javranking-extension&utm_medium=popup&utm_campaign=header",
		);
	});

	it("correctly places query params before hash fragment", () => {
		const url = buildJavRankingUrl("/zh-hans/videos/123/", {
			hash: "preview",
			campaign: "preview",
		});
		expect(url).toBe(
			"https://javranking.cc/zh-hans/videos/123/?utm_source=javranking-extension&utm_medium=popup&utm_campaign=preview#preview",
		);
	});

	it("handles path without leading slash", () => {
		const url = buildJavRankingUrl("en/videos/456/");
		expect(url).toBe(
			"https://javranking.cc/en/videos/456/?utm_source=javranking-extension&utm_medium=popup",
		);
	});
});
