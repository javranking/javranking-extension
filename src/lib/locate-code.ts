export interface LocateResult {
	found: boolean;
	matchIndex?: number;
	totalMatches?: number;
}

/**
 * Self-contained function executed in host page top-level document via scripting.executeScript.
 * Must not reference external closure variables.
 */
export function locateCodeInTab(targetCode: string): LocateResult {
	try {
		if (!targetCode || typeof targetCode !== "string" || !document.body) {
			return { found: false };
		}

		const cleanCode = targetCode.trim();
		if (!cleanCode) return { found: false };

		// Escape regex special chars: \ ^ $ * + ? . ( ) | [ ] { }
		const escaped = cleanCode.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
		let pattern: string;

		if (/^FC2/i.test(cleanCode)) {
			const numPart = cleanCode.replace(/^FC2[-_\s]*(?:PPV[-_\s]*)?/i, "");
			const escapedNum = numPart.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
			pattern = `FC2[-_\\s]*(?:PPV[-_\\s]*)?${escapedNum}`;
		} else {
			pattern = escaped.replace(/[-_\s]+/g, "[-_\\s]?");
		}

		let regex: RegExp;
		try {
			regex = new RegExp(`(?<![A-Za-z0-9])${pattern}(?![A-Za-z0-9])`, "gi");
		} catch {
			regex = new RegExp(`\\b${pattern}\\b`, "gi");
		}

		const isElementVisible = (el: HTMLElement | null): boolean => {
			if (!el) return false;
			if (typeof el.checkVisibility === "function") {
				return el.checkVisibility({
					checkOpacity: true,
					checkVisibilityCSS: true,
				});
			}
			const rects = el.getClientRects();
			if (rects.length === 0) return false;
			const style =
				window.getComputedStyle ? window.getComputedStyle(el) : null;
			if (style) {
				if (
					style.display === "none" ||
					style.visibility === "hidden" ||
					style.opacity === "0"
				) {
					return false;
				}
			}
			return true;
		};

		const walker = document.createTreeWalker(
			document.body,
			NodeFilter.SHOW_TEXT,
			{
				acceptNode(node) {
					const parent = node.parentElement;
					if (!parent) return NodeFilter.FILTER_REJECT;
					const tag = parent.tagName.toUpperCase();
					if (
						tag === "SCRIPT" ||
						tag === "STYLE" ||
						tag === "NOSCRIPT" ||
						tag === "TEXTAREA" ||
						tag === "INPUT"
					) {
						return NodeFilter.FILTER_REJECT;
					}
					if (!isElementVisible(parent)) {
						return NodeFilter.FILTER_REJECT;
					}
					return NodeFilter.FILTER_ACCEPT;
				},
			},
		);

		interface TextMatch {
			node: Node;
			index: number;
			length: number;
			range: Range;
		}

		const matches: TextMatch[] = [];
		let currentNode: Node | null = walker.nextNode();

		while (currentNode) {
			const text = currentNode.nodeValue || "";
			regex.lastIndex = 0;
			let match: RegExpExecArray | null;

			while ((match = regex.exec(text)) !== null) {
				const range = document.createRange();
				range.setStart(currentNode, match.index);
				range.setEnd(currentNode, match.index + match[0].length);

				matches.push({
					node: currentNode,
					index: match.index,
					length: match[0].length,
					range,
				});
			}

			currentNode = walker.nextNode();
		}

		if (matches.length === 0) {
			return { found: false };
		}

		// Handle cycling through multiple matches across repeated clicks
		const win = (typeof window !== "undefined" ? window : globalThis) as any;
		const stateKey = "__javranking_locate_state";
		const state = win[stateKey] || { code: "", index: -1 };
		const compKey = cleanCode.toUpperCase();
		let targetIndex = 0;

		if (state.code === compKey) {
			targetIndex = (state.index + 1) % matches.length;
		}
		win[stateKey] = {
			code: compKey,
			index: targetIndex,
		};

		const currentMatch = matches[targetIndex];
		if (!currentMatch) {
			return { found: false };
		}

		// Clean up any existing locate badges
		document.querySelectorAll(".javranking-locate-badge").forEach((el) => {
			const parent = el.parentNode;
			if (parent) {
				while (el.firstChild) {
					parent.insertBefore(el.firstChild, el);
				}
				parent.removeChild(el);
				parent.normalize();
			}
		});

		// Ensure pulse keyframe style is present
		if (!document.getElementById("javranking-locate-style")) {
			const styleEl = document.createElement("style");
			styleEl.id = "javranking-locate-style";
			styleEl.textContent = `
				@keyframes javranking-locate-pulse {
					0% { transform: scale(1); box-shadow: 0 0 0 3px #d97706, 0 0 12px rgba(245, 158, 11, 0.6); }
					50% { transform: scale(1.15); box-shadow: 0 0 0 5px #f59e0b, 0 0 28px rgba(245, 158, 11, 1); }
					100% { transform: scale(1); box-shadow: 0 0 0 3px #d97706, 0 0 12px rgba(245, 158, 11, 0.6); }
				}
			`;
			document.head.appendChild(styleEl);
		}

		// Wrap the exact matched characters with a prominent golden badge
		const mark = document.createElement("mark");
		mark.className = "javranking-locate-badge";
		mark.style.cssText = `
			background: #f59e0b !important;
			color: #000000 !important;
			font-weight: 800 !important;
			padding: 2px 6px !important;
			margin: 0 2px !important;
			border-radius: 4px !important;
			box-shadow: 0 0 0 3px #d97706, 0 0 24px rgba(245, 158, 11, 0.95) !important;
			display: inline-block !important;
			line-height: 1.2 !important;
			vertical-align: baseline !important;
			animation: javranking-locate-pulse 0.7s ease-in-out 3 !important;
			position: relative !important;
			z-index: 2147483640 !important;
			text-shadow: none !important;
		`;

		try {
			currentMatch.range.surroundContents(mark);
			mark.scrollIntoView({
				behavior: "smooth",
				block: "center",
				inline: "center",
			});
		} catch {
			// Fallback: scroll via getBoundingClientRect or parent
			const rect = currentMatch.range.getBoundingClientRect();
			const scrollTop =
				(typeof window !== "undefined" ? window.scrollY : 0) ||
				document.documentElement?.scrollTop ||
				0;
			if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
				window.scrollTo({
					top: Math.max(0, scrollTop + rect.top - (window.innerHeight || 600) / 2),
					behavior: "smooth",
				});
			} else if (currentMatch.node.parentElement) {
				currentMatch.node.parentElement.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});
			}
		}

		// Smoothly fade out and unwrap the badge after 2.6s
		setTimeout(() => {
			mark.style.transition = "opacity 0.4s ease";
			mark.style.opacity = "0";
			setTimeout(() => {
				const parent = mark.parentNode;
				if (parent) {
					while (mark.firstChild) {
						parent.insertBefore(mark.firstChild, mark);
					}
					parent.removeChild(mark);
					parent.normalize();
				}
			}, 400);
		}, 2600);

		return {
			found: true,
			matchIndex: targetIndex + 1,
			totalMatches: matches.length,
		};
	} catch {
		return { found: false };
	}
}

/**
 * Executes locateCodeInTab in the active browser tab via browser.scripting.
 */
export async function locateCodeInActiveTab(code: string): Promise<LocateResult> {
	try {
		let tabs = await browser.tabs.query({
			active: true,
			lastFocusedWindow: true,
		});
		if (!tabs || tabs.length === 0) {
			tabs = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
		}
		const activeTab = tabs && tabs.length > 0 ? tabs[0] : undefined;
		if (!activeTab || !activeTab.id) return { found: false };

		const results = await browser.scripting.executeScript({
			target: { tabId: activeTab.id },
			func: locateCodeInTab,
			args: [code],
		});

		const firstResult =
			results && results.length > 0 ? results[0]?.result : undefined;
		return (firstResult as LocateResult) || { found: false };
	} catch (err) {
		console.error("Failed to locate code in active tab:", err);
		return { found: false };
	}
}
