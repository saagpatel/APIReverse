import { invoke } from "@tauri-apps/api/core";
import type { CapturedRequest, Endpoint, Session } from "../types";

export async function createSession(
	name: string,
	captureMode: "extension" | "mitm" | "mixed",
): Promise<Session> {
	return invoke<Session>("create_session", {
		name,
		captureMode,
	});
}

export async function listSessions(): Promise<Session[]> {
	return invoke<Session[]>("list_sessions");
}

export async function getRequests(
	sessionId: string,
	limit: number,
	offset: number,
): Promise<CapturedRequest[]> {
	return invoke<CapturedRequest[]>("get_requests", {
		sessionId,
		limit,
		offset,
	});
}

export async function getEndpoints(sessionId: string): Promise<Endpoint[]> {
	return invoke<Endpoint[]>("get_endpoints", { sessionId });
}

export async function startCapture(sessionId: string): Promise<void> {
	return invoke("start_capture", { sessionId });
}

export async function stopCapture(): Promise<void> {
	return invoke("stop_capture");
}
