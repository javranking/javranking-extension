import { beforeEach, describe, expect, it, vi } from "vitest";
import { locateCodeInTab } from "../src/lib/locate-code";

describe("locateCodeInTab", () => {
	beforeEach(() => {
		// Set up NodeFilter global if not defined
		if (typeof globalThis.NodeFilter === "undefined") {
			(globalThis as any).NodeFilter = {
				FILTER_ACCEPT: 1,
				FILTER_REJECT: 2,
				FILTER_SKIP: 3,
				SHOW_TEXT: 4,
			};
		}
	});

	function createMockDom(
		nodes: Array<{ text: string; tag?: string; isVisible?: boolean }>,
	) {
		const createdElements: any[] = [];
		const markElements: any[] = [];

		const textNodes = nodes.map((item) => {
			const scrollIntoView = vi.fn();
			const el: any = {
				tagName: item.tag || "SPAN",
				style: {
					outline: "",
					outlineOffset: "",
					boxShadow: "",
					backgroundColor: "",
					transition: "",
				},
				offsetWidth: item.isVisible !== false ? 100 : 0,
				offsetHeight: item.isVisible !== false ? 20 : 0,
				getClientRects: () =>
					item.isVisible !== false ? [{ width: 100, height: 20 }] : [],
				scrollIntoView,
				checkVisibility: () => item.isVisible !== false,
			};
			createdElements.push(el);

			return {
				nodeValue: item.text,
				parentElement: el,
				parentNode: el,
			};
		});

		(globalThis as any).document = {
			body: {
				tagName: "BODY",
			},
			head: {
				appendChild: vi.fn(),
			},
			getElementById: vi.fn(() => null),
			querySelectorAll: vi.fn(() => []),
			createElement: (tagName: string) => {
				const el: any = {
					tagName: tagName.toUpperCase(),
					className: "",
					style: {},
					scrollIntoView: vi.fn(),
					appendChild: vi.fn(),
					insertBefore: vi.fn(),
					removeChild: vi.fn(),
					firstChild: null,
				};
				if (tagName.toLowerCase() === "mark") {
					markElements.push(el);
				}
				return el;
			},
			createRange: () => {
				return {
					setStart: vi.fn(),
					setEnd: vi.fn(),
					surroundContents: (wrapper: any) => {
						// Simulate wrapping: mark element gets wrapped around the content
						wrapper.firstChild = { nodeValue: "dummy" };
					},
					getBoundingClientRect: () => ({
						top: 100,
						left: 50,
						width: 60,
						height: 18,
					}),
				};
			},
			createTreeWalker: (
				_root: any,
				_whatToShow: number,
				filter: { acceptNode: (node: any) => number },
			) => {
				let index = -1;
				return {
					nextNode: () => {
						index++;
						while (index < textNodes.length) {
							const node = textNodes[index];
							if (filter.acceptNode(node) === 1) {
								return node;
							}
							index++;
						}
						return null;
					},
				};
			},
		};

		return { createdElements, markElements };
	}

	it("returns { found: false } for invalid or empty code inputs", () => {
		createMockDom([{ text: "Some text with ABP-123" }]);
		expect(locateCodeInTab("").found).toBe(false);
		expect(locateCodeInTab("   ").found).toBe(false);
		expect(locateCodeInTab(null as any).found).toBe(false);
	});

	it("locates standard video code, creates exact mark badge, and scrolls the mark into view", () => {
		const { markElements } = createMockDom([
			{ text: "Intro paragraph" },
			{ text: "Here is the video: abp-123 released today." },
		]);

		const result = locateCodeInTab("ABP-123");
		expect(result.found).toBe(true);
		expect(result.matchIndex).toBe(1);
		expect(result.totalMatches).toBe(1);

		expect(markElements.length).toBe(1);
		const mark = markElements[0];
		expect(mark.className).toBe("javranking-locate-badge");
		expect(mark.scrollIntoView).toHaveBeenCalledWith({
			behavior: "smooth",
			block: "center",
			inline: "center",
		});
	});

	it("precisely locates two different codes inside the same post container to their distinct marks", () => {
		// Simulates a forum post with multiple codes in a single <TD> container
		const { markElements } = createMockDom([
			{
				text: "Post title: Check out ABP-123 and also IPX-456 in this same thread.",
				tag: "TD",
			},
		]);

		// 1. Locate ABP-123
		const res1 = locateCodeInTab("ABP-123");
		expect(res1.found).toBe(true);
		expect(markElements.length).toBe(1);
		expect(markElements[0].scrollIntoView).toHaveBeenCalled();

		// 2. Locate IPX-456
		const res2 = locateCodeInTab("IPX-456");
		expect(res2.found).toBe(true);
		expect(markElements.length).toBe(2);
		expect(markElements[1].scrollIntoView).toHaveBeenCalled();

		// Two distinct mark elements were created and scrolled independently
		expect(markElements[0]).not.toBe(markElements[1]);
	});

	it("cycles through multiple occurrences of the same code on repeated clicks", () => {
		createMockDom([
			{ text: "Header mention of ABP-123" },
			{ text: "Middle paragraph mention of ABP-123" },
		]);

		// First click -> match 1 of 2
		const res1 = locateCodeInTab("ABP-123");
		expect(res1.found).toBe(true);
		expect(res1.matchIndex).toBe(1);
		expect(res1.totalMatches).toBe(2);

		// Second click -> match 2 of 2
		const res2 = locateCodeInTab("ABP-123");
		expect(res2.found).toBe(true);
		expect(res2.matchIndex).toBe(2);
		expect(res2.totalMatches).toBe(2);

		// Third click -> cycles back to match 1 of 2
		const res3 = locateCodeInTab("ABP-123");
		expect(res3.found).toBe(true);
		expect(res3.matchIndex).toBe(1);
		expect(res3.totalMatches).toBe(2);
	});

	it("locates FC2 codes with PPV variation", () => {
		const { markElements } = createMockDom([
			{ text: "Check out FC2 PPV 1234567 on this page" },
		]);

		const result = locateCodeInTab("FC2-1234567");
		expect(result.found).toBe(true);
		expect(markElements.length).toBe(1);
		expect(markElements[0].scrollIntoView).toHaveBeenCalled();
	});

	it("does not false-match when target code is a substring of another code", () => {
		const { markElements } = createMockDom([
			{ text: "Other code FABP-1234 is here" },
		]);

		const result = locateCodeInTab("ABP-123");
		expect(result.found).toBe(false);
		expect(markElements.length).toBe(0);
	});

	it("skips invisible elements", () => {
		const { markElements } = createMockDom([
			{ text: "Hidden modal ABP-123", isVisible: false },
			{ text: "Visible post ABP-123", isVisible: true },
		]);

		const result = locateCodeInTab("ABP-123");
		expect(result.found).toBe(true);
		expect(result.totalMatches).toBe(1); // Only the visible one is matched
		expect(markElements.length).toBe(1);
	});
});
