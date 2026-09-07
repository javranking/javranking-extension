import React, { useEffect, useState } from "react";
import { checkForUpdate, type AvailableUpdate } from "../../src/lib/release";
import type { LocaleMessages } from "../../src/lib/locales";

interface UpdateNoticeProps {
	t: LocaleMessages;
}

export const UpdateNotice: React.FC<UpdateNoticeProps> = ({ t }) => {
	const [update, setUpdate] = useState<AvailableUpdate | null>(null);

	useEffect(() => {
		let isDisposed = false;

		void checkForUpdate().then((availableUpdate) => {
			if (!isDisposed) setUpdate(availableUpdate);
		});

		return () => {
			isDisposed = true;
		};
	}, []);

	if (!update) return null;

	return (
		<div className="popup-update-notice" role="status" aria-live="polite">
			<a
				href={update.url}
				target="_blank"
				rel="noopener noreferrer"
				className="popup-update-notice__link"
				aria-label={t.updateAvailableAria(update.version)}
			>
				<svg
					className="popup-update-notice__icon"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path d="M10 1.75a.75.75 0 01.75.75v8.69l2.72-2.72a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 011.06-1.06l2.72 2.72V2.5a.75.75 0 01.75-.75zM3.5 14.75a.75.75 0 01.75.75v.5c0 .414.336.75.75.75h10a.75.75 0 00.75-.75v-.5a.75.75 0 011.5 0v.5a2.25 2.25 0 01-2.25 2.25H5A2.25 2.25 0 012.75 16v-.5a.75.75 0 01.75-.75z" />
				</svg>
				<span className="popup-update-notice__copy">
					<strong>{t.updateAvailableTitle(update.version)}</strong>
					<span>{t.updateAvailableDesc}</span>
				</span>
				<span className="popup-update-notice__action">{t.updateNow}</span>
			</a>
		</div>
	);
};
