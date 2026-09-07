export function buildJavRankingUrl(
	path: string,
	options?: { hash?: string; campaign?: string },
): string {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	const url = new URL(`https://javranking.top${normalizedPath}`);
	url.searchParams.set("utm_source", "javranking-extension");
	url.searchParams.set("utm_medium", "popup");
	if (options?.campaign) {
		url.searchParams.set("utm_campaign", options.campaign);
	}
	if (options?.hash) {
		url.hash = options.hash.startsWith("#")
			? options.hash.slice(1)
			: options.hash;
	}
	return url.toString();
}
