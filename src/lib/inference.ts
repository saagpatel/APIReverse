import Anthropic from "@anthropic-ai/sdk";
import type { CapturedRequest, Endpoint } from "../types";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1000;
const MAX_BODY_CHARS = 3000;

const SYSTEM_PROMPT = `You are an API documentation assistant. Analyze captured HTTP traffic for a single endpoint and respond ONLY with a valid JSON object. Do not include markdown fences or any text outside the JSON.`;

const USER_PROMPT_TEMPLATE = `Analyze this endpoint and return a JSON object with these fields:
- inferredName (string): short human-readable name e.g. "Get User Profile"
- inferredDescription (string): one sentence
- requestBodySchema (JSON Schema object or null)
- responseBodySchema (JSON Schema object or null)
- pathParams (array of {name, description, example})
- queryParamDescriptions (object: {paramName: description})
- authScheme ("bearer" | "basic" | "apikey" | "none")
- tags (array of 1-3 category strings)

Response may be truncated; infer schema from visible fields only.

Endpoint data:
`;

const AUTH_HEADERS_TO_STRIP = new Set([
	"authorization",
	"cookie",
	"x-api-key",
	"api-key",
	"set-cookie",
]);

interface InferencePromptPayload {
	method: string;
	path: string;
	host: string;
	samples: {
		requestBody?: string;
		requestHeaders?: Record<string, string>;
		responseStatus: number;
		responseBody?: string;
		responseHeaders?: Record<string, string>;
	}[];
}

function stripAuthHeaders(
	headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
	if (!headers) return undefined;
	const cleaned: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		if (!AUTH_HEADERS_TO_STRIP.has(key.toLowerCase())) {
			cleaned[key] = value;
		}
	}
	return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function truncateBody(
	body: string | undefined,
	max: number,
): string | undefined {
	if (!body) return undefined;
	return body.length > max ? body.slice(0, max) : body;
}

function toHeaderRecord(
	raw: Record<string, string> | string | undefined,
): Record<string, string> | undefined {
	if (!raw) return undefined;
	if (typeof raw === "object") return raw;
	try {
		return JSON.parse(raw) as Record<string, string>;
	} catch {
		return undefined;
	}
}

function buildPayload(
	endpoint: Endpoint,
	samples: CapturedRequest[],
): InferencePromptPayload {
	return {
		method: endpoint.method,
		path: endpoint.normalizedPath,
		host: endpoint.host,
		samples: samples.slice(0, 3).map((req) => ({
			requestBody: truncateBody(req.requestBody ?? undefined, MAX_BODY_CHARS),
			requestHeaders: stripAuthHeaders(toHeaderRecord(req.requestHeaders)),
			responseStatus: req.responseStatus ?? 0,
			responseBody: truncateBody(req.responseBody ?? undefined, MAX_BODY_CHARS),
			responseHeaders: stripAuthHeaders(toHeaderRecord(req.responseHeaders)),
		})),
	};
}

function stripMarkdownFences(text: string): string {
	let cleaned = text.trim();
	// Remove opening fence
	if (cleaned.startsWith("```json")) {
		cleaned = cleaned.slice(7);
	} else if (cleaned.startsWith("```")) {
		cleaned = cleaned.slice(3);
	}
	// Remove closing fence
	if (cleaned.endsWith("```")) {
		cleaned = cleaned.slice(0, -3);
	}
	return cleaned.trim();
}

export interface InferenceResponse {
	inferredName: string;
	inferredDescription: string;
	requestBodySchema: unknown | null;
	responseBodySchema: unknown | null;
	pathParams: { name: string; description: string; example: string }[];
	queryParamDescriptions: Record<string, string>;
	authScheme: "bearer" | "basic" | "apikey" | "none";
	tags: string[];
}

export async function runInference(
	endpoint: Endpoint,
	sampleRequests: CapturedRequest[],
	apiKey: string,
): Promise<{
	result: Partial<InferenceResponse>;
	rawResponse: string;
	tokensUsed: number;
}> {
	const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
	const payload = buildPayload(endpoint, sampleRequests);

	const message = await client.messages.create({
		model: MODEL,
		max_tokens: MAX_TOKENS,
		system: SYSTEM_PROMPT,
		messages: [
			{
				role: "user",
				content: USER_PROMPT_TEMPLATE + JSON.stringify(payload, null, 2),
			},
		],
	});

	const rawText =
		message.content[0]?.type === "text" ? message.content[0].text : "";

	const tokensUsed =
		(message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0);

	const cleaned = stripMarkdownFences(rawText);

	try {
		const parsed = JSON.parse(cleaned) as InferenceResponse;
		return { result: parsed, rawResponse: rawText, tokensUsed };
	} catch {
		// Return partial result with raw response for debugging
		return {
			result: {},
			rawResponse: rawText,
			tokensUsed,
		};
	}
}

export interface SaveInferencePayload {
	endpointId: number;
	sessionId: string;
	inferredName: string | null;
	inferredDescription: string | null;
	requestBodySchema: string | null;
	responseBodySchema: string | null;
	pathParams: string | null;
	queryParamDescriptions: string | null;
	authScheme: string | null;
	tags: string | null;
	rawClaudeResponse: string | null;
	tokensUsed: number;
	modelUsed: string;
}

export function inferenceResultToSavePayload(
	endpointId: number,
	sessionId: string,
	response: {
		result: Partial<InferenceResponse>;
		rawResponse: string;
		tokensUsed: number;
	},
): SaveInferencePayload {
	const r = response.result;
	return {
		endpointId,
		sessionId,
		inferredName: r.inferredName ?? null,
		inferredDescription: r.inferredDescription ?? null,
		requestBodySchema: r.requestBodySchema
			? JSON.stringify(r.requestBodySchema)
			: null,
		responseBodySchema: r.responseBodySchema
			? JSON.stringify(r.responseBodySchema)
			: null,
		pathParams: r.pathParams ? JSON.stringify(r.pathParams) : null,
		queryParamDescriptions: r.queryParamDescriptions
			? JSON.stringify(r.queryParamDescriptions)
			: null,
		authScheme: r.authScheme ?? null,
		tags: r.tags ? JSON.stringify(r.tags) : null,
		rawClaudeResponse: response.rawResponse,
		tokensUsed: response.tokensUsed,
		modelUsed: MODEL,
	};
}
