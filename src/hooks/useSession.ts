import { useCallback, useEffect, useRef, useState } from "react";
import {
	createSession,
	getCaStatus,
	getProxyStatus,
	listSessions,
	startCapture,
	startProxy,
	stopCapture,
	stopProxy,
} from "../lib/tauri";
import type { ProxyStatus, Session } from "../types";

type CaptureMode = "extension" | "mitm" | "mixed";

export function useSession() {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [activeSession, setActiveSession] = useState<Session | null>(null);
	const [isCapturing, setIsCapturing] = useState(false);
	const [captureMode, setCaptureMode] = useState<CaptureMode>("extension");
	const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
	const [showCaModal, setShowCaModal] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const proxyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		listSessions()
			.then(setSessions)
			.catch((e: unknown) => setError(String(e)));
	}, []);

	// Poll proxy status while capturing with MITM
	useEffect(() => {
		if (isCapturing && (captureMode === "mitm" || captureMode === "mixed")) {
			proxyPollRef.current = setInterval(() => {
				getProxyStatus()
					.then(setProxyStatus)
					.catch(() => {});
			}, 2000);
		}
		return () => {
			if (proxyPollRef.current) {
				clearInterval(proxyPollRef.current);
				proxyPollRef.current = null;
			}
		};
	}, [isCapturing, captureMode]);

	const create = useCallback(async (name: string) => {
		try {
			const session = await createSession(name, "extension");
			setSessions((prev) => [session, ...prev]);
			setActiveSession(session);
			return session;
		} catch (e: unknown) {
			setError(String(e));
			return null;
		}
	}, []);

	const start = useCallback(
		async (session?: Session) => {
			const target = session ?? activeSession;
			if (!target) return;

			try {
				// Check CA status for MITM mode
				if (captureMode === "mitm" || captureMode === "mixed") {
					const caStatus = await getCaStatus();
					if (!caStatus.trusted) {
						setShowCaModal(true);
						// Don't block — user can install CA and try again
					}
				}

				// Start extension capture (polling task) for all modes
				// The polling task picks up rows from both extension and MITM sources
				await startCapture(target.id);

				// Start proxy for MITM/mixed modes
				if (captureMode === "mitm" || captureMode === "mixed") {
					const status = await startProxy(target.id);
					setProxyStatus(status);
				}

				setIsCapturing(true);
				setActiveSession(target);
			} catch (e: unknown) {
				setError(String(e));
			}
		},
		[activeSession, captureMode],
	);

	const stop = useCallback(async () => {
		try {
			await stopCapture();

			if (captureMode === "mitm" || captureMode === "mixed") {
				await stopProxy();
				setProxyStatus(null);
			}

			setIsCapturing(false);
			if (activeSession) {
				setActiveSession((prev) =>
					prev ? { ...prev, status: "complete" } : null,
				);
				setSessions((prev) =>
					prev.map((s) =>
						s.id === activeSession.id
							? { ...s, status: "complete" as const }
							: s,
					),
				);
			}
		} catch (e: unknown) {
			setError(String(e));
		}
	}, [activeSession, captureMode]);

	const selectSession = useCallback((session: Session) => {
		setActiveSession(session);
		setIsCapturing(false);
	}, []);

	return {
		sessions,
		activeSession,
		isCapturing,
		captureMode,
		proxyStatus,
		showCaModal,
		error,
		create,
		start,
		stop,
		selectSession,
		setCaptureMode,
		setShowCaModal,
		clearError: () => setError(null),
	};
}
