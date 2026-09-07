export default defineBackground(() => {
	// Enable opening the side panel on extension action click in supported Chromium browsers
	const chromium = globalThis as typeof globalThis & {
		chrome?: {
			sidePanel?: {
				setPanelBehavior?: (options: {
					openPanelOnActionClick: boolean;
				}) => Promise<void>;
			};
		};
	};
	const sidePanel = chromium.chrome?.sidePanel;

	if (sidePanel?.setPanelBehavior) {
		sidePanel
			.setPanelBehavior({ openPanelOnActionClick: true })
			.catch((error: unknown) => {
				console.warn("Failed to set openPanelOnActionClick:", error);
			});
	}
});
