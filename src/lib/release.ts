export const EXTENSION_VERSION = "1.0.1";
export const LATEST_RELEASE_API_URL =
	"https://api.github.com/repos/aizhimou/javranking-extension/releases/latest";
export const LATEST_RELEASE_PAGE_URL =
	"https://github.com/aizhimou/javranking-extension/releases/latest";

export interface AvailableUpdate {
	version: string;
	url: string;
}

interface ReleaseFetchResponse {
	ok: boolean;
	json(): Promise<unknown>;
}

export type ReleaseFetch = (
	input: string,
	init?: RequestInit,
) => Promise<ReleaseFetchResponse>;

function parseVersion(version: string): number[] | null {
	const match = version.trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/i);
	if (!match) return null;

	return [
		Number(match[1]),
		Number(match[2] ?? 0),
		Number(match[3] ?? 0),
	];
}

export function isNewerVersion(candidate: string, current = EXTENSION_VERSION): boolean {
	const candidateParts = parseVersion(candidate);
	const currentParts = parseVersion(current);
	if (!candidateParts || !currentParts) return false;

	for (let index = 0; index < candidateParts.length; index += 1) {
		const candidatePart = candidateParts[index] ?? 0;
		const currentPart = currentParts[index] ?? 0;
		if (candidatePart !== currentPart) return candidatePart > currentPart;
	}

	return false;
}

export async function checkForUpdate(
	fetchImpl: ReleaseFetch = fetch,
): Promise<AvailableUpdate | null> {
	try {
		const response = await fetchImpl(LATEST_RELEASE_API_URL, {
			headers: { Accept: "application/vnd.github+json" },
			cache: "no-store",
		});
		if (!response.ok) return null;

		const payload = await response.json();
		if (!payload || typeof payload !== "object") return null;
		const tagName = (payload as { tag_name?: unknown }).tag_name;
		if (typeof tagName !== "string" || !isNewerVersion(tagName)) {
			return null;
		}

		return { version: tagName.replace(/^v/i, ""), url: LATEST_RELEASE_PAGE_URL };
	} catch {
		return null;
	}
}
