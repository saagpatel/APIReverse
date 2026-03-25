import { useCallback, useEffect, useState } from "react";
import {
	createSession,
	listSessions,
	startCapture,
	stopCapture,
} from "../lib/tauri";
import type { Session } from "../types";

export function useSession() {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [activeSession, setActiveSession] = useState<Session | null>(null);
	const [isCapturing, setIsCapturing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		listSessions()
			.then(setSessions)
			.catch((e: unknown) => setError(String(e)));
	}, []);

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
				await startCapture(target.id);
				setIsCapturing(true);
				setActiveSession(target);
			} catch (e: unknown) {
				setError(String(e));
			}
		},
		[activeSession],
	);

	const stop = useCallback(async () => {
		try {
			await stopCapture();
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
	}, [activeSession]);

	const selectSession = useCallback((session: Session) => {
		setActiveSession(session);
		setIsCapturing(false);
	}, []);

	return {
		sessions,
		activeSession,
		isCapturing,
		error,
		create,
		start,
		stop,
		selectSession,
		clearError: () => setError(null),
	};
}
