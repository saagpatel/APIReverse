import type { Endpoint, InferenceResult } from "../types";

interface PostmanCollection {
	info: {
		name: string;
		schema: string;
		description?: string;
	};
	item: PostmanFolder[];
	variable: PostmanVariable[];
}

interface PostmanFolder {
	name: string;
	item: PostmanItem[];
}

interface PostmanItem {
	name: string;
	request: {
		method: string;
		url: {
			raw: string;
			host: string[];
			path: string[];
			query?: PostmanQuery[];
		};
		header?: PostmanHeader[];
		body?: {
			mode: "raw";
			raw: string;
			options?: { raw: { language: "json" } };
		};
		description?: string;
	};
}

interface PostmanHeader {
	key: string;
	value: string;
	description?: string;
}

interface PostmanQuery {
	key: string;
	value: string;
	description?: string;
}

interface PostmanVariable {
	key: string;
	value: string;
	description?: string;
}

function safeJsonParse<T>(json: string | null | undefined): T | null {
	if (!json) return null;
	try {
		return JSON.parse(json) as T;
	} catch {
		return null;
	}
}

function replacePathParams(
	path: string,
	pathParams: { name: string; description: string; example: string }[] | null,
): string {
	if (!pathParams || pathParams.length === 0) return path;

	let result = path;
	// Replace {id} placeholders with named Postman variables
	let paramIndex = 0;
	result = result.replace(/\{id\}/g, () => {
		const param = pathParams[paramIndex];
		paramIndex++;
		if (param) {
			return `{{${param.name}}}`;
		}
		return "{{id}}";
	});

	return result;
}

function replaceAuthInHeaders(
	headers: Record<string, string> | undefined,
	authScheme: string | null | undefined,
): PostmanHeader[] {
	const result: PostmanHeader[] = [];

	if (headers) {
		for (const [key, value] of Object.entries(headers)) {
			const lower = key.toLowerCase();
			if (lower === "authorization") {
				if (authScheme === "bearer") {
					result.push({
						key,
						value: "Bearer {{bearer_token}}",
						description: "Auth token",
					});
				} else if (authScheme === "basic") {
					result.push({
						key,
						value: "Basic {{basic_auth}}",
						description: "Basic auth",
					});
				} else {
					result.push({ key, value: "{{auth_value}}" });
				}
			} else if (lower === "x-api-key" || lower === "api-key") {
				result.push({ key, value: "{{api_key}}", description: "API key" });
			} else if (lower === "cookie" || lower === "set-cookie") {
				// Skip cookies in export
			} else {
				result.push({ key, value });
			}
		}
	}

	return result;
}

function schemaToExampleJson(schema: unknown): string {
	if (!schema || typeof schema !== "object") return "{}";

	const s = schema as Record<string, unknown>;
	if (s.type === "object" && s.properties) {
		const example: Record<string, unknown> = {};
		const props = s.properties as Record<string, Record<string, unknown>>;
		for (const [key, prop] of Object.entries(props)) {
			if (prop.example !== undefined) {
				example[key] = prop.example;
			} else if (prop.type === "string") {
				example[key] = "";
			} else if (prop.type === "number" || prop.type === "integer") {
				example[key] = 0;
			} else if (prop.type === "boolean") {
				example[key] = false;
			} else if (prop.type === "array") {
				example[key] = [];
			} else {
				example[key] = null;
			}
		}
		return JSON.stringify(example, null, 2);
	}

	return "{}";
}

export function buildPostmanCollection(
	sessionName: string,
	endpoints: Endpoint[],
	inferenceResults: InferenceResult[],
): PostmanCollection {
	// Build a map of endpoint_id → inference result
	const resultMap = new Map<number, InferenceResult>();
	for (const r of inferenceResults) {
		resultMap.set(r.endpointId, r);
	}

	// Group endpoints by first tag
	const groups = new Map<
		string,
		{ endpoint: Endpoint; inference: InferenceResult | undefined }[]
	>();

	for (const ep of endpoints) {
		const inf = resultMap.get(ep.id);
		const tags = inf?.tags ? safeJsonParse<string[]>(inf.tags) : null;
		const folder = tags?.[0] ?? "Ungrouped";

		const existing = groups.get(folder);
		if (existing) {
			existing.push({ endpoint: ep, inference: inf });
		} else {
			groups.set(folder, [{ endpoint: ep, inference: inf }]);
		}
	}

	// Build Postman folders
	const folders: PostmanFolder[] = [];
	const host = endpoints[0]?.host ?? "api.example.com";

	for (const [folderName, items] of groups) {
		const postmanItems: PostmanItem[] = items.map(
			({ endpoint: ep, inference: inf }) => {
				const pathParams = inf?.pathParams
					? safeJsonParse<
							{ name: string; description: string; example: string }[]
						>(inf.pathParams)
					: null;

				const postmanPath = replacePathParams(ep.normalizedPath, pathParams);
				const pathSegments = postmanPath.split("/").filter(Boolean);

				const requestBodySchema = inf?.requestBodySchema
					? safeJsonParse(inf.requestBodySchema)
					: null;

				const hasBody = ["POST", "PUT", "PATCH"].includes(ep.method);

				const headers: PostmanHeader[] = [
					{ key: "Content-Type", value: "application/json" },
					...replaceAuthInHeaders(undefined, inf?.authScheme),
				];

				const item: PostmanItem = {
					name: inf?.inferredName ?? `${ep.method} ${ep.normalizedPath}`,
					request: {
						method: ep.method,
						url: {
							raw: `{{base_url}}${postmanPath}`,
							host: ["{{base_url}}"],
							path: pathSegments,
						},
						header: headers,
						description: inf?.inferredDescription ?? undefined,
					},
				};

				if (hasBody && requestBodySchema) {
					item.request.body = {
						mode: "raw",
						raw: schemaToExampleJson(requestBodySchema),
						options: { raw: { language: "json" } },
					};
				}

				return item;
			},
		);

		folders.push({ name: folderName, item: postmanItems });
	}

	// Build collection
	const collection: PostmanCollection = {
		info: {
			name: sessionName,
			schema:
				"https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
			description: `API collection generated by APIspy from session "${sessionName}"`,
		},
		item: folders,
		variable: [
			{ key: "base_url", value: `https://${host}`, description: "Base URL" },
			{
				key: "bearer_token",
				value: "",
				description: "Bearer authentication token",
			},
			{ key: "api_key", value: "", description: "API key" },
		],
	};

	return collection;
}

export function collectionToJson(collection: PostmanCollection): string {
	return JSON.stringify(collection, null, 2);
}
