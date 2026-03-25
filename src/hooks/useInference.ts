import { useCallback, useEffect, useRef, useState } from "react";
import { inferenceResultToSavePayload, runInference } from "../lib/inference";
import {
	getEndpoints,
	getInferenceResults,
	getRequestsByIds,
	getSetting,
	saveInferenceResult,
} from "../lib/tauri";
import type { Endpoint, InferenceResult } from "../types";

export interface InferenceProgress {
	status: "idle" | "running" | "complete" | "error";
	completed: number;
	total: number;
	currentEndpoint: string | null;
	tokensUsed: number;
	errors: { endpointId: number; error: string }[];
}

const INITIAL_PROGRESS: InferenceProgress = {
	status: "idle",
	completed: 0,
	total: 0,
	currentEndpoint: null,
	tokensUsed: 0,
	errors: [],
};

export function useInference(sessionId: string | null) {
	const [results, setResults] = useState<InferenceResult[]>([]);
	const [progress, setProgress] = useState<InferenceProgress>(INITIAL_PROGRESS);
	const [loading, setLoading] = useState(false);
	const cancelRef = useRef(false);

	// Load existing results when session changes
	useEffect(() => {
		if (!sessionId) {
			setResults([]);
			return;
		}
		setLoading(true);
		getInferenceResults(sessionId)
			.then(setResults)
			.catch((e: unknown) =>
				console.error("Failed to load inference results:", e),
			)
			.finally(() => setLoading(false));
	}, [sessionId]);

	const run = useCallback(
		async (endpoints: Endpoint[]) => {
			if (!sessionId || endpoints.length === 0) return;

			cancelRef.current = false;

			const apiKey = await getSetting("anthropic_api_key");
			if (!apiKey) {
				setProgress((p) => ({
					...p,
					status: "error",
					errors: [{ endpointId: 0, error: "No API key configured" }],
				}));
				return;
			}

			setProgress({
				status: "running",
				completed: 0,
				total: endpoints.length,
				currentEndpoint: null,
				tokensUsed: 0,
				errors: [],
			});

			const newResults: InferenceResult[] = [];
			let totalTokens = 0;
			const errors: { endpointId: number; error: string }[] = [];

			for (let i = 0; i < endpoints.length; i++) {
				if (cancelRef.current) break;

				const endpoint = endpoints[i];
				const epLabel = `${endpoint.method} ${endpoint.normalizedPath}`;

				setProgress((p) => ({
					...p,
					completed: i,
					currentEndpoint: epLabel,
				}));

				try {
					// Fetch sample requests for this endpoint
					const sampleIds = endpoint.sampleRequestIds ?? [];
					const sampleRequests =
						sampleIds.length > 0 ? await getRequestsByIds(sampleIds) : [];

					// Run inference with retry logic for 429s
					let response = null;
					let retries = 0;
					const maxRetries = 3;

					while (retries <= maxRetries) {
						try {
							response = await runInference(endpoint, sampleRequests, apiKey);
							break;
						} catch (e: unknown) {
							const msg = String(e);
							if (msg.includes("429") && retries < maxRetries) {
								retries++;
								await sleep(5000 * retries);
								continue;
							}
							throw e;
						}
					}

					if (!response) {
						errors.push({
							endpointId: endpoint.id,
							error: "No response after retries",
						});
						continue;
					}

					totalTokens += response.tokensUsed;

					// Save to SQLite
					const payload = inferenceResultToSavePayload(
						endpoint.id,
						sessionId,
						response,
					);

					const savedId = await saveInferenceResult(payload);

					const saved: InferenceResult = {
						id: savedId,
						endpointId: endpoint.id,
						sessionId,
						inferredName: payload.inferredName ?? undefined,
						inferredDescription: payload.inferredDescription ?? undefined,
						requestBodySchema: payload.requestBodySchema ?? undefined,
						responseBodySchema: payload.responseBodySchema ?? undefined,
						pathParams: payload.pathParams ?? undefined,
						queryParamDescriptions: payload.queryParamDescriptions ?? undefined,
						authScheme: payload.authScheme ?? undefined,
						tags: payload.tags ?? undefined,
						rawClaudeResponse: payload.rawClaudeResponse ?? undefined,
						tokensUsed: payload.tokensUsed,
						inferredAt: new Date().toISOString(),
						modelUsed: payload.modelUsed,
					};

					newResults.push(saved);

					setProgress((p) => ({
						...p,
						completed: i + 1,
						tokensUsed: totalTokens,
					}));
				} catch (e: unknown) {
					errors.push({ endpointId: endpoint.id, error: String(e) });
				}
			}

			setResults((prev) => [...prev, ...newResults]);
			setProgress((p) => ({
				...p,
				status:
					errors.length > 0 && newResults.length === 0 ? "error" : "complete",
				completed: endpoints.length,
				currentEndpoint: null,
				tokensUsed: totalTokens,
				errors,
			}));
		},
		[sessionId],
	);

	const cancel = useCallback(() => {
		cancelRef.current = true;
	}, []);

	const loadEndpoints = useCallback(async (): Promise<Endpoint[]> => {
		if (!sessionId) return [];
		return getEndpoints(sessionId);
	}, [sessionId]);

	return {
		results,
		progress,
		loading,
		run,
		cancel,
		loadEndpoints,
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
