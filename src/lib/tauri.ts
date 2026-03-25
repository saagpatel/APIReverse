import { invoke } from "@tauri-apps/api/core";
import type { Session } from "../types";

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
