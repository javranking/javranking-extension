import { describe, expect, it } from "vitest";
import {
	MAX_CANDIDATES,
	MAX_SCAN_CHARS,
	extractCandidatesFromText,
} from "../src/lib/extract-codes";

describe("extractCandidatesFromText", () => {
	it("extracts multiple standard codes with hyphen or space in occurrence order", () => {
		const text = `
			Welcome to the site. Featured today:
			1. Check out ABP-123 and abp-123 (duplicate should not repeat).
			2. Next is SNIS-456, then IPX 534.
			3. FSDSS-111 and PRED 00222.
		`;

		const { candidates, truncated } = extractCandidatesFromText(text);

		expect(truncated).toBe(false);
		expect(candidates).toContain("ABP-123");
		expect(candidates).toContain("SNIS-456");
		expect(candidates).toContain("IPX 534");
		expect(candidates).toContain("FSDSS-111");
		expect(candidates).toContain("PRED 00222");
	});

	it("deduplicates candidates case-insensitively while preserving first occurrence", () => {
		const text = "ssni-123 is great, SSNI-123 is the same, SsNi-123 again.";
		const { candidates } = extractCandidatesFromText(text);

		expect(candidates).toEqual(["ssni-123"]);
	});

	it("caps maximum unique candidates at 500 and flags truncated", () => {
		let text = "";
		for (let i = 100; i < 700; i++) {
			text += `ABC-${i} `;
		}

		const { candidates, truncated } = extractCandidatesFromText(text);

		expect(candidates.length).toBe(MAX_CANDIDATES);
		expect(truncated).toBe(true);
	});

	it("caps maximum text scan at 2 MiB and flags truncated", () => {
		const prefix = "ABP-999 ";
		const hugePadding = "x".repeat(MAX_SCAN_CHARS + 100);
		const suffix = "SNIS-888";

		const { candidates, truncated } = extractCandidatesFromText(
			prefix + hugePadding + suffix,
		);

		expect(candidates).toContain("ABP-999");
		expect(candidates).not.toContain("SNIS-888");
		expect(truncated).toBe(true);
	});

	it("filters out domain names, URLs, and file names while keeping valid codes", () => {
		const text = `
			Visit https://www.javbus.com/forum/ABP-123 or www.javbus.com or javbus.com
			Also check cdn.jsdelivr.net and missav.ws and page.html and video.mp4
			Valid codes are SSIS-567 and STARS 888.
		`;

		const { candidates } = extractCandidatesFromText(text);

		expect(candidates).toContain("ABP-123");
		expect(candidates).toContain("SSIS-567");
		expect(candidates).toContain("STARS 888");

		expect(candidates).not.toContain("www.javbus.com");
		expect(candidates).not.toContain("javbus.com");
		expect(candidates).not.toContain("cdn.jsdelivr.net");
		expect(candidates).not.toContain("missav.ws");
		expect(candidates).not.toContain("page.html");
		expect(candidates).not.toContain("video.mp4");
	});

	it("strictly enforces 3-6 letters on left and 3-6 digits on right", () => {
		const text = `
			Valid: ABP-123, SSIS-001, FSDSS-12345, ABCDEF-123456
			Invalid letter length: AB-123 (2 letters), ABCDEFG-123 (7 letters)
			Invalid digit length: ABC-12 (2 digits), ABC-1234567 (7 digits)
			Unspaced: SSIS001, LIUJIAYI1111, KAKA233333
			Non-letter prefix: FC2-1234567, 259LUXU-123
		`;

		const { candidates } = extractCandidatesFromText(text);

		expect(candidates).toContain("ABP-123");
		expect(candidates).toContain("SSIS-001");
		expect(candidates).toContain("FSDSS-12345");
		expect(candidates).toContain("ABCDEF-123456");

		expect(candidates).not.toContain("AB-123");
		expect(candidates).not.toContain("ABCDEFG-123");
		expect(candidates).not.toContain("ABC-12");
		expect(candidates).not.toContain("ABC-1234567");
		expect(candidates).not.toContain("SSIS001");
		expect(candidates).not.toContain("LIUJIAYI1111");
		expect(candidates).not.toContain("KAKA233333");
		expect(candidates).not.toContain("FC2-1234567");
		expect(candidates).not.toContain("259LUXU-123");
	});

	it("supports custom regex override", () => {
		const text = `
			Checking custom regex:
			FC2-PPV-1234567 and AB-12
		`;

		const customRegex = "\\b(?:FC2[-_\\s]+(?:PPV[-_\\s]+)?\\d+|[A-Za-z]{2}-\\d{2})\\b";
		const { candidates } = extractCandidatesFromText(text, customRegex);

		expect(candidates).toContain("FC2-PPV-1234567");
		expect(candidates).toContain("AB-12");
	});
});
