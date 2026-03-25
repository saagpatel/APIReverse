import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { getEndpoints, getRequests } from "../lib/tauri";
import type { CapturedRequest, Endpoint } from "../types";

export function useCapture(sessionId: string | null) {
	const [requests, setRequests] = useState<CapturedRequest[]>([]);
	const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
	const [loading, setLoading] = useState(false);
	const pendingCountRef = useRef(0);

	// Load initial data when session changes
	useEffect(() => {
		if (!sessionId) {
			setRequests([]);
			setEndpoints([]);
			return;
		}

		setLoading(true);
		Promise.all([getRequests(sessionId, 200, 0), getEndpoints(sessionId)])
			.then(([reqs, eps]) => {
				setRequests(reqs);
				setEndpoints(eps);
			})
			.catch((e: unknown) => {
				console.error("Failed to load capture data:", e);
			})
			.finally(() => setLoading(false));
	}, [sessionId]);

	// Listen for live request events
	useEffect(() => {
		if (!sessionId) return;

		const unlistenReq = listen<CapturedRequest>("request:captured", (event) => {
			setRequests((prev) => [event.payload, ...prev]);
			pendingCountRef.current++;
		});

		const unlistenEndpoints = listen<Endpoint[]>(
			"endpoints:updated",
			(event) => {
				setEndpoints(event.payload);
				pendingCountRef.current = 0;
			},
		);

		return () => {
			unlistenReq.then((fn) => fn());
			unlistenEndpoints.then((fn) => fn());
		};
	}, [sessionId]);

	const refreshEndpoints = useCallback(async () => {
		if (!sessionId) return;
		try {
			const eps = await getEndpoints(sessionId);
			setEndpoints(eps);
		} catch (e: unknown) {
			console.error("Failed to refresh endpoints:", e);
		}
	}, [sessionId]);

	const requestCount = requests.length;
	const endpointCount = endpoints.length;
	const nonNoiseRequests = requests.filter((r) => !r.isNoise);

	return {
		requests,
		nonNoiseRequests,
		endpoints,
		loading,
		requestCount,
		endpointCount,
		refreshEndpoints,
	};
}
