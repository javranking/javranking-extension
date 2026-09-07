import type { ExtractionResult } from "./types";

export const MAX_SCAN_CHARS = 2 * 1024 * 1024; // 2 MiB
export const MAX_CANDIDATES = 500;
export const MAX_CANDIDATE_LENGTH = 64;

export const DEFAULT_CODE_REGEX = "\\b[A-Za-z]{3,6}[-—–\\s]+\\d{3,6}\\b";
export const CODE_REGEX = new RegExp(DEFAULT_CODE_REGEX, "gi");

export function isValidCodeCandidate(rawCandidate: string): boolean {
	const trimmed = rawCandidate.trim();
	if (!trimmed || trimmed.length > MAX_CANDIDATE_LENGTH) return false;

	// Reject URLs, protocol prefixes, and host prefixes
	if (/^(?:https?:\/\/|www\.)/i.test(trimmed)) return false;

	// Reject URL path separators, queries, and fragment characters
	if (/[/?&=#%\\]/.test(trimmed)) return false;

	// Reject common web domains and file extensions
	if (
		/\.(?:com|net|org|cn|tw|hk|jp|ws|top|io|tv|me|cc|xyz|html?|php|jsp|asp|json|png|jpg|jpeg|gif|webp|svg|mp4)$/i.test(
			trimmed,
		)
	) {
		return false;
	}

	// Must contain hyphen, underscore, or space separator (unless it strictly matches studio date pattern)
	const hasSeparator = /[-—–_\s]/.test(trimmed);
	const isStudioDate =
		/^[A-Za-z][A-Za-z0-9]*(?:\.\d{2,4}){2,3}$/i.test(trimmed);

	if (!hasSeparator && !isStudioDate) {
		return false;
	}

	// If candidate contains dots, it must strictly match studio date pattern (e.g. blacked.20.01.10)
	if (trimmed.includes(".")) {
		if (!isStudioDate) {
			return false;
		}
	}

	return true;
}

export function extractCandidatesFromText(
	text: string,
	customRegex?: string | RegExp,
): ExtractionResult {
	let truncated = false;
	let scanText = text;

	if (scanText.length > MAX_SCAN_CHARS) {
		scanText = scanText.slice(0, MAX_SCAN_CHARS);
		truncated = true;
	}

	const candidates: string[] = [];
	const seen = new Set<string>();

	let regex: RegExp;
	if (customRegex instanceof RegExp) {
		regex = new RegExp(customRegex.source, "gi");
	} else if (typeof customRegex === "string" && customRegex.trim()) {
		try {
			regex = new RegExp(customRegex.trim(), "gi");
		} catch {
			regex = new RegExp(DEFAULT_CODE_REGEX, "gi");
		}
	} else {
		regex = new RegExp(DEFAULT_CODE_REGEX, "gi");
	}

	let match: RegExpExecArray | null;
	regex.lastIndex = 0;
	while ((match = regex.exec(scanText)) !== null) {
		const rawCandidate = match[0].trim();
		if (!isValidCodeCandidate(rawCandidate)) {
			continue;
		}

		const upper = rawCandidate.toUpperCase();
		if (!seen.has(upper)) {
			seen.add(upper);
			candidates.push(rawCandidate);
			if (candidates.length >= MAX_CANDIDATES) {
				truncated = true;
				break;
			}
		}
	}

	return { candidates, truncated };
}

/**
 * Self-contained function executed in host page top-level document via scripting.executeScript.
 * Must not reference external closure variables.
 */
export function extractCandidatesInTab(
	customRegexPattern?: string,
): ExtractionResult {
	try {
		const bodyText = document.body ? document.body.innerText : "";
		const MAX_SCAN_CHARS = 2 * 1024 * 1024;
		const MAX_CANDIDATES = 500;
		const MAX_CANDIDATE_LENGTH = 64;

		let truncated = false;
		let scanText = bodyText;

		if (scanText.length > MAX_SCAN_CHARS) {
			scanText = scanText.slice(0, MAX_SCAN_CHARS);
			truncated = true;
		}

		const DEFAULT_PATTERN = "\\b[A-Za-z]{3,6}[-—–\\s]+\\d{3,6}\\b";
		let codeRegex: RegExp;
		if (typeof customRegexPattern === "string" && customRegexPattern.trim()) {
			try {
				codeRegex = new RegExp(customRegexPattern.trim(), "gi");
			} catch {
				codeRegex = new RegExp(DEFAULT_PATTERN, "gi");
			}
		} else {
			codeRegex = new RegExp(DEFAULT_PATTERN, "gi");
		}

		const isValid = (str: string): boolean => {
			const trimmed = str.trim();
			if (!trimmed || trimmed.length > MAX_CANDIDATE_LENGTH) return false;
			if (/^(?:https?:\/\/|www\.)/i.test(trimmed)) return false;
			if (/[/?&=#%\\]/.test(trimmed)) return false;
			if (
				/\.(?:com|net|org|cn|tw|hk|jp|ws|top|io|tv|me|cc|xyz|html?|php|jsp|asp|json|png|jpg|jpeg|gif|webp|svg|mp4)$/i.test(
					trimmed,
				)
			) {
				return false;
			}
			return true;
		};

		const candidates: string[] = [];
		const seen = new Set<string>();

		let match: RegExpExecArray | null;
		codeRegex.lastIndex = 0;
		while ((match = codeRegex.exec(scanText)) !== null) {
			const rawCandidate = match[0].trim();
			if (!isValid(rawCandidate)) {
				continue;
			}

			const upper = rawCandidate.toUpperCase();
			if (!seen.has(upper)) {
				seen.add(upper);
				candidates.push(rawCandidate);
				if (candidates.length >= MAX_CANDIDATES) {
					truncated = true;
					break;
				}
			}
		}

		return { candidates, truncated };
	} catch {
		return { candidates: [], truncated: false, unsupported: true };
	}
}
