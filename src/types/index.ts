export interface Session {
	id: string;
	name: string;
	targetDomain?: string;
	captureMode: "extension" | "mitm" | "mixed";
	startedAt: string;
	endedAt?: string;
	requestCount: number;
	filterConfig?: FilterConfig;
	status: "active" | "complete" | "archived";
}

export interface FilterConfig {
	allowlist: string[];
	denylist: string[];
	noisePresets: NoisePreset[];
	pathExcludePatterns: string[];
}

export type NoisePreset = "analytics" | "cdn" | "social" | "fonts";

export interface CapturedRequest {
	id: number;
	sessionId: string;
	captureSource: "extension" | "mitm";
	method: string;
	url: string;
	normalizedPath: string;
	host: string;
	path: string;
	queryParams?: Record<string, string>;
	requestHeaders?: Record<string, string>;
	requestBody?: string;
	requestContentType?: string;
	responseStatus?: number;
	responseHeaders?: Record<string, string>;
	responseBody?: string;
	responseContentType?: string;
	durationMs?: number;
	capturedAt: string;
	isNoise: boolean;
	isDuplicate: boolean;
}

export interface Endpoint {
	id: number;
	sessionId: string;
	method: string;
	normalizedPath: string;
	host: string;
	requestCount: number;
	firstSeen: string;
	lastSeen: string;
	sampleRequestIds: number[];
	authDetected?: "bearer" | "basic" | "cookie" | "apikey";
}

export interface InferenceResult {
	id: number;
	endpointId: number;
	sessionId: string;
	inferredName?: string;
	inferredDescription?: string;
	requestBodySchema?: JsonSchema;
	responseBodySchema?: JsonSchema;
	pathParams?: PathParam[];
	queryParamDescriptions?: Record<string, string>;
	authScheme?: "bearer" | "basic" | "apikey" | "none";
	tags?: string[];
	tokensUsed?: number;
	inferredAt: string;
}

export interface PathParam {
	name: string;
	description: string;
	example: string;
}

export interface JsonSchema {
	type: string;
	properties?: Record<string, JsonSchema>;
	items?: JsonSchema;
	description?: string;
	example?: unknown;
	nullable?: boolean;
	required?: string[];
}

export interface ProxyStatus {
	running: boolean;
	port: number;
	caInstalled: boolean;
	caPath: string;
	requestsIntercepted: number;
}
