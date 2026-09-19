export type MarkStatus = "done" | "wish" | "none";

export interface VideoMark {
	videoCode: string;
	status: MarkStatus;
	markedAt: number;
	title?: string;
	coverUrl?: string;
}

export interface ChongStoreState {
	chongCode: string | null;
	lastSyncedAt: number;
	marks: Record<string, VideoMark>;
}

export const CHONG_STORAGE_KEY = "javranking_chong_store_v1";
export const API_BASE = "https://api.javranking.cc";

function getDefaultState(): ChongStoreState {
	return {
		chongCode: null,
		lastSyncedAt: 0,
		marks: {},
	};
}

function getStorage(): Storage | null {
	try {
		if (typeof localStorage !== "undefined") {
			return localStorage;
		}
		if (typeof window !== "undefined" && window.localStorage) {
			return window.localStorage;
		}
	} catch {
		// Ignore access errors
	}
	return null;
}

export function loadState(): ChongStoreState {
	const storage = getStorage();
	if (!storage) return getDefaultState();
	try {
		const raw = storage.getItem(CHONG_STORAGE_KEY);
		if (!raw) return getDefaultState();
		const parsed = JSON.parse(raw);
		return {
			chongCode:
				typeof parsed.chongCode === "string"
					? parsed.chongCode.trim().toLowerCase()
					: null,
			lastSyncedAt:
				typeof parsed.lastSyncedAt === "number" ? parsed.lastSyncedAt : 0,
			marks:
				typeof parsed.marks === "object" && parsed.marks !== null
					? parsed.marks
					: {},
		};
	} catch {
		return getDefaultState();
	}
}

export function saveState(state: ChongStoreState): void {
	const storage = getStorage();
	if (!storage) return;
	try {
		storage.setItem(CHONG_STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		console.warn("Failed to save chong store to localStorage", e);
	}
}

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function notifyChange(videoCode?: string, status?: MarkStatus) {
	if (typeof window === "undefined") return;
	const state = loadState();
	try {
		window.dispatchEvent(
			new CustomEvent("chong:change", {
				detail: { videoCode, status, state },
			}),
		);
	} catch {
		// CustomEvent may not be available in non-DOM contexts
	}

	// If chongCode is bound, auto sync with 300ms debounce
	if (state.chongCode) {
		if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
		syncDebounceTimer = setTimeout(() => {
			syncDebounceTimer = null;
			syncWithCloud().catch((err) => {
				console.warn("Auto sync failed:", err);
			});
		}, 300);
	}
}

// Flush pending sync when page/panel hides or unloads
if (typeof window !== "undefined") {
	const flushPendingSync = () => {
		if (syncDebounceTimer) {
			clearTimeout(syncDebounceTimer);
			syncDebounceTimer = null;
			syncWithCloud().catch(() => {});
		}
	};
	window.addEventListener("pagehide", flushPendingSync);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			flushPendingSync();
		}
	});
}


/**
 * Normalizes Chong Code to lower-case alphanumeric
 */
export function normalizeChongCode(code: string): string {
	return (code || "").trim().toLowerCase();
}

/**
 * Validates Chong Code format (6-16 characters alphanumeric)
 */
export function isValidChongCode(code: string): { valid: boolean; error?: string } {
	const normalized = normalizeChongCode(code);
	if (!normalized) {
		return { valid: false, error: "冲码不能为空" };
	}
	if (normalized.length < 6 || normalized.length > 16) {
		return { valid: false, error: "冲码长度必须在 6 至 16 个字符之间" };
	}
	if (!/^[a-z0-9]+$/.test(normalized)) {
		return { valid: false, error: "冲码仅支持英文字母与数字" };
	}
	return { valid: true };
}

/**
 * Get the marking status of a video code ('done' | 'wish' | null)
 */
export function getMark(videoCode: string): MarkStatus | null {
	if (!videoCode) return null;
	const code = videoCode.trim().toUpperCase();
	const state = loadState();
	const item = state.marks[code];
	if (!item || item.status === "none") return null;
	return item.status;
}

/**
 * Toggle mark status for a video code.
 * If targetStatus is already active, resets to 'none' (unmarked).
 */
export function toggleMark(
	videoCode: string,
	targetStatus: "done" | "wish",
	metadata?: { title?: string; coverUrl?: string },
): MarkStatus | null {
	if (!videoCode) return null;
	const code = videoCode.trim().toUpperCase();
	const state = loadState();
	const current = state.marks[code];
	const now = Math.floor(Date.now() / 1000);

	let newStatus: MarkStatus;
	if (current && current.status === targetStatus) {
		newStatus = "none";
	} else {
		newStatus = targetStatus;
	}

	state.marks[code] = {
		videoCode: code,
		status: newStatus,
		markedAt: now,
		title: metadata?.title || current?.title,
		coverUrl: metadata?.coverUrl || current?.coverUrl,
	};

	saveState(state);
	notifyChange(code, newStatus);
	return newStatus === "none" ? null : newStatus;
}

/**
 * Remove mark for a video code (sets status to 'none' for tombstone sync)
 */
export function removeMark(videoCode: string): void {
	if (!videoCode) return;
	const code = videoCode.trim().toUpperCase();
	const state = loadState();
	const now = Math.floor(Date.now() / 1000);
	const current = state.marks[code];
	state.marks[code] = {
		videoCode: code,
		status: "none",
		markedAt: now,
		title: current?.title,
		coverUrl: current?.coverUrl,
	};

	saveState(state);
	notifyChange(code, "none");
}

/**
 * Get count statistics: total, done, wish
 */
export function getCounts(): { total: number; done: number; wish: number } {
	const state = loadState();
	let done = 0;
	let wish = 0;
	for (const mark of Object.values(state.marks)) {
		if (mark.status === "done") done++;
		else if (mark.status === "wish") wish++;
	}
	return { total: done + wish, done, wish };
}

/**
 * Get currently bound Chong Code
 */
export function getChongCode(): string | null {
	return loadState().chongCode;
}

/**
 * Bind or change Chong Code
 */
export function setChongCode(code: string | null): void {
	const state = loadState();
	state.chongCode = code ? normalizeChongCode(code) : null;
	saveState(state);
	notifyChange();
}

/**
 * Clear / unbind Chong Code
 */
export function clearChongCode(): void {
	setChongCode(null);
}

/**
 * Check if a Chong Code exists on the server
 */
export async function checkChongCodeOnServer(code: string): Promise<{
	exists: boolean;
	available: boolean;
	error?: string;
}> {
	const normalized = normalizeChongCode(code);
	const validity = isValidChongCode(normalized);
	if (!validity.valid) {
		return { exists: false, available: false, error: validity.error };
	}

	try {
		const res = await fetch(
			`${API_BASE}/api/chong-code/check?code=${encodeURIComponent(normalized)}`,
		);
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: "网络请求失败" }));
			return {
				exists: false,
				available: false,
				error: (err as { error?: string }).error || `状态码 ${res.status}`,
			};
		}
		const data = (await res.json()) as { exists: boolean; available: boolean };
		return { exists: data.exists, available: data.available };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		return { exists: false, available: false, error: msg };
	}
}

/**
 * Create a new Chong Code on the server (custom or random 8-char)
 */
export async function createChongCodeOnServer(customCode?: string): Promise<{
	success: boolean;
	code?: string;
	error?: string;
}> {
	try {
		const payload: { code?: string } = {};
		if (customCode && customCode.trim()) {
			const normalized = normalizeChongCode(customCode);
			const validity = isValidChongCode(normalized);
			if (!validity.valid) {
				return { success: false, error: validity.error };
			}
			payload.code = normalized;
		}

		const res = await fetch(`${API_BASE}/api/chong-code/create`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: "创建失败" }));
			return {
				success: false,
				error: (err as { error?: string }).error || `创建失败 (${res.status})`,
			};
		}

		const data = (await res.json()) as { code: string; createdAt: number };
		return { success: true, code: data.code };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		return { success: false, error: msg };
	}
}

let inFlightSync: Promise<{ success: boolean; error?: string; count?: number }> | null = null;

/**
 * Perform incremental bidirectional sync with Cloudflare D1
 */
export async function syncWithCloud(): Promise<{
	success: boolean;
	error?: string;
	count?: number;
}> {
	if (inFlightSync) return inFlightSync;

	inFlightSync = (async () => {
		const state = loadState();
		if (!state.chongCode) {
			return { success: false, error: "未绑定冲码" };
		}

		const changes = Object.values(state.marks).map((m) => ({
			videoCode: m.videoCode,
			status: m.status,
			markedAt: m.markedAt,
		}));

		try {
			const res = await fetch(
				`${API_BASE}/api/chong-code/${encodeURIComponent(state.chongCode)}/sync`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					keepalive: true,
					body: JSON.stringify({
						since: Math.max(0, (state.lastSyncedAt || 0) - 30),
						changes,
					}),
				},
			);

			if (!res.ok) {
				const err = await res.json().catch(() => ({ error: "网络同步失败" }));
				return {
					success: false,
					error: (err as { error?: string }).error || `状态码 ${res.status}`,
				};
			}

			const data = (await res.json()) as {
				code: string;
				syncedAt: number;
				items: Array<{ videoCode: string; status: MarkStatus; markedAt: number }>;
			};

			// Merge remote changes (Last-Write-Wins)
			for (const item of data.items || []) {
				const vCode = item.videoCode.trim().toUpperCase();
				const local = state.marks[vCode];
				if (!local || item.markedAt >= local.markedAt) {
					state.marks[vCode] = {
						videoCode: vCode,
						status: item.status,
						markedAt: item.markedAt,
						title: local?.title,
						coverUrl: local?.coverUrl,
					};
				}
			}

			state.lastSyncedAt = data.syncedAt;
			saveState(state);

			if (typeof window !== "undefined") {
				try {
					window.dispatchEvent(
						new CustomEvent("chong:synced", {
							detail: { syncedAt: data.syncedAt },
						}),
					);
				} catch {
					// Ignore
				}
			}

			return { success: true, count: Object.keys(state.marks).length };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { success: false, error: message };
		} finally {
			inFlightSync = null;
		}
	})();

	return inFlightSync;
}


/**
 * Validate, bind existing Chong Code and perform initial sync
 */
export async function bindExistingChongCode(code: string): Promise<{
	success: boolean;
	error?: string;
}> {
	const normalized = normalizeChongCode(code);
	const validity = isValidChongCode(normalized);
	if (!validity.valid) {
		return { success: false, error: validity.error };
	}

	const check = await checkChongCodeOnServer(normalized);
	if (!check.exists) {
		return {
			success: false,
			error: check.error || "该冲码不存在，请核对输入",
		};
	}

	setChongCode(normalized);
	await syncWithCloud();
	return { success: true };
}

/**
 * Request creation of new Chong Code, bind it, and sync
 */
export async function createCloudChongCode(customCode?: string): Promise<{
	success: boolean;
	code?: string;
	error?: string;
}> {
	const res = await createChongCodeOnServer(customCode);
	if (res.success && res.code) {
		setChongCode(res.code);
		await syncWithCloud();
		return { success: true, code: res.code };
	}
	return { success: false, error: res.error || "创建冲码失败" };
}

