import { invoke } from "@tauri-apps/api/core";
import type {
	CapturedRequest,
	CaStatus,
	Endpoint,
	ProxyStatus,
	Session,
} from "../types";

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

export async function startProxy(sessionId: string): Promise<ProxyStatus> {
	return invoke<ProxyStatus>("start_proxy", { sessionId });
}

export async function stopProxy(): Promise<void> {
	return invoke("stop_proxy");
}

export async function getProxyStatus(): Promise<ProxyStatus> {
	return invoke<ProxyStatus>("get_proxy_status");
}

export async function getCaStatus(): Promise<CaStatus> {
	return invoke<CaStatus>("get_ca_status");
}

export async function installCa(): Promise<void> {
	return invoke("install_ca");
}
