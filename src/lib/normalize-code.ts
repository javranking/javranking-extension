/**
 * Normalizes a video code string according to Section 7 of docs/browser-extension.md:
 * 1. Unicode NFKC normalization
 * 2. Trim
 * 3. Uppercase using locale-independent behavior
 * 4. Normalize dash, underscore, and whitespace runs
 */
export function normalizeCode(raw: string | null | undefined): string {
	if (!raw) return "";
	return raw
		.normalize("NFKC")
		.trim()
		.toUpperCase()
		.replace(/\bFC2[-_\s]*PPV[-_\s]*/gi, "FC2-")
		.replace(/[\s_—–-]+/g, "-");
}

/**
 * Produces a normalized comparison key that removes supported separators
 * without changing letters or digits.
 *
 * e.g. "ABP-123" -> "ABP123"
 *      "abp 123" -> "ABP123"
 *      "FC2 PPV 3061625" -> "FC23061625"
 *      "ＦＣ２－３０６１６２５" -> "FC23061625"
 */
export function toComparisonKey(raw: string | null | undefined): string {
	if (!raw) return "";
	return raw
		.normalize("NFKC")
		.trim()
		.toUpperCase()
		.replace(/\bFC2[-_\s]*PPV[-_\s]*/gi, "FC2-")
		.replace(/[\s_—–-]+/g, "");
}
