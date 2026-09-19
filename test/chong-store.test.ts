import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearChongCode,
	getChongCode,
	getCounts,
	getMark,
	isValidChongCode,
	loadState,
	normalizeChongCode,
	removeMark,
	setChongCode,
	toggleMark,
} from "../src/lib/chong-store";

describe("chong-store", () => {
	let storageMock: Record<string, string> = {};

	beforeEach(() => {
		storageMock = {};
		vi.stubGlobal("localStorage", {
			getItem: vi.fn((key: string) => storageMock[key] ?? null),
			setItem: vi.fn((key: string, val: string) => {
				storageMock[key] = val;
			}),
			removeItem: vi.fn((key: string) => {
				delete storageMock[key];
			}),
			clear: vi.fn(() => {
				storageMock = {};
			}),
		});
	});

	it("normalizes chong code correctly", () => {
		expect(normalizeChongCode("  Asimov88  ")).toBe("asimov88");
		expect(normalizeChongCode("")).toBe("");
	});

	it("validates chong code constraints", () => {
		expect(isValidChongCode("").valid).toBe(false);
		expect(isValidChongCode("12345").valid).toBe(false); // < 6
		expect(isValidChongCode("12345678901234567").valid).toBe(false); // > 16
		expect(isValidChongCode("abc-123").valid).toBe(false); // special character
		expect(isValidChongCode("asimov88").valid).toBe(true);
		expect(isValidChongCode("K7M2PX89").valid).toBe(true);
	});

	it("binds, gets, and clears chong code", () => {
		expect(getChongCode()).toBe(null);
		setChongCode("K7M2PX89");
		expect(getChongCode()).toBe("k7m2px89");
		clearChongCode();
		expect(getChongCode()).toBe(null);
	});

	it("toggles mark status and counts correctly", () => {
		expect(getMark("SSIS-123")).toBe(null);
		expect(getCounts()).toEqual({ total: 0, done: 0, wish: 0 });

		// Mark as done
		const res1 = toggleMark("SSIS-123", "done", { title: "Test Title" });
		expect(res1).toBe("done");
		expect(getMark("SSIS-123")).toBe("done");
		expect(getCounts()).toEqual({ total: 1, done: 1, wish: 0 });

		// Switch to wish
		const res2 = toggleMark("SSIS-123", "wish");
		expect(res2).toBe("wish");
		expect(getMark("SSIS-123")).toBe("wish");
		expect(getCounts()).toEqual({ total: 1, done: 0, wish: 1 });

		// Toggle again -> resets to null (none)
		const res3 = toggleMark("SSIS-123", "wish");
		expect(res3).toBe(null);
		expect(getMark("SSIS-123")).toBe(null);
		expect(getCounts()).toEqual({ total: 0, done: 0, wish: 0 });

		// Test removeMark
		toggleMark("IPX-888", "done");
		expect(getMark("IPX-888")).toBe("done");
		removeMark("IPX-888");
		expect(getMark("IPX-888")).toBe(null);
	});

	it("bindExistingChongCode validates and syncs", async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes("/api/chong-code/check?code=testcode")) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ exists: true, available: false }),
				});
			}
			if (url.includes("/sync")) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ code: "testcode", syncedAt: 12345, items: [] }),
				});
			}
			return Promise.resolve({
				ok: true,
				json: async () => ({ exists: false }),
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const resInvalid = await (await import("../src/lib/chong-store")).bindExistingChongCode("123");
		expect(resInvalid.success).toBe(false);

		const resValid = await (await import("../src/lib/chong-store")).bindExistingChongCode("testcode");
		expect(resValid.success).toBe(true);
		expect(getChongCode()).toBe("testcode");
	});
});

