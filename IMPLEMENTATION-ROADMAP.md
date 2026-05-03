# API Reverse Engineer (apispy) — Implementation Roadmap

## Architecture

### System Overview

```
[Chrome Extension]  ──── Native Messaging ────→ [native-host binary (Tauri sidecar)]
                                                          │
[Firefox Extension] ──── Native Messaging ────→          │
                                                          ↓
[hudsucker MITM Proxy] ── HTTP/S intercept ──→ [Tauri Rust Backend]
                                                    │           │
                                              [SQLite DB]  [Tauri Commands IPC]
                                         (one .db per session)  │
                                                           [React Frontend]
                                                  CaptureBar / RequestList / EndpointMap
                                                  InferencePanel / CollectionPreview
                                                           │
                                          [Anthropic API — claude-sonnet-4-6]
                                          (sequential batch, auth headers stripped)
                                                           │
                                               [postman-collection npm SDK]
                                                           │
                                               [Export: .postman_collection.json]
```

### File Structure

```
api-reverse-engineer/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                         # Tauri app entry, command registration, event setup
│   │   ├── commands/
│   │   │   ├── session.rs                  # create_session, list_sessions, delete_session, update_session
│   │   │   ├── capture.rs                  # get_requests, get_endpoints, clear_requests, save_inference_result
│   │   │   ├── proxy.rs                    # start_proxy, stop_proxy, get_proxy_status, get_ca_status, install_ca
│   │   │   └── export.rs                   # build_postman_collection (takes session_id, returns JSON string)
│   │   ├── proxy/
│   │   │   ├── mod.rs
│   │   │   ├── mitm.rs                     # hudsucker proxy setup, CA cert loading, request/response handler
│   │   │   ├── filter.rs                   # domain allow/deny logic, static asset extension filtering
│   │   │   └── normalizer.rs               # path param regex detection, URL normalization
│   │   ├── db/
│   │   │   ├── mod.rs                      # connection pool setup, migration runner
│   │   │   ├── migrations/
│   │   │   │   ├── 001_initial.sql         # sessions, requests, endpoints tables
│   │   │   │   └── 002_inference.sql       # inference_results table
│   │   │   └── queries.rs                  # all sqlx typed queries (no inline SQL elsewhere)
│   │   └── native_host/
│   │       └── main.rs                     # Standalone binary: Chrome/Firefox Native Messaging protocol
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── components/
│   │   ├── CaptureBar.tsx                  # Record/Stop, mode toggle (Extension/MITM), session name input
│   │   ├── RequestList.tsx                 # Live scrolling list: method badge, URL, status, timestamp
│   │   ├── EndpointMap.tsx                 # Grouped by normalized_path: method, count, auth indicator
│   │   ├── InferencePanel.tsx              # Run AI Analysis button, endpoint checkboxes, progress bar
│   │   ├── CollectionPreview.tsx           # Rendered Postman tree with inline schema editor
│   │   ├── FilterConfig.tsx                # Domain allowlist/denylist, noise presets, regex exclusions
│   │   ├── SessionManager.tsx              # List/open/rename/delete/export-zip past sessions
│   │   └── CASetupModal.tsx                # Guided CA cert installation flow for MITM mode
│   ├── hooks/
│   │   ├── useCapture.ts                   # Tauri event listener for `request:captured` stream
│   │   ├── useInference.ts                 # Sequential inference queue, progress state, SQLite writes
│   │   └── useSession.ts                   # Active session CRUD, session list state
│   ├── lib/
│   │   ├── tauri.ts                        # Typed invoke() wrappers for ALL Tauri commands
│   │   ├── inference.ts                    # Anthropic API fetch, prompt template, JSON parse + strip fences
│   │   ├── postman-builder.ts              # Constructs PostmanCollection from Endpoint[] + InferenceResult[]
│   │   └── normalizer.ts                   # Client-side URL normalization (mirrors Rust normalizer.rs)
│   ├── types/
│   │   └── index.ts                        # All shared TS interfaces (see Type Definitions below)
│   ├── App.tsx                             # Top-level layout, view router, session context provider
│   └── main.tsx                            # Vite entry point
├── extension/
│   ├── chrome/
│   │   ├── manifest.json                   # MV3, webRequest permission, nativeMessaging declaration
│   │   ├── background.js                   # Service worker: buffer queue, 500ms flush, sendNativeMessage
│   │   ├── content.js                      # (Phase 4) XHR/fetch monkey-patch for body capture (opt-in)
│   │   └── popup.html                      # Status indicator: Recording / Idle / Error
│   └── firefox/
│       ├── manifest.json                   # MV2, same permissions, browser_specific_settings
│       └── background.js                   # Firefox WebExtensions port of Chrome background.js
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CLAUDE.md
└── IMPLEMENTATION-ROADMAP.md
```

### Data Model

```sql
-- 001_initial.sql

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,                      -- UUID v4
    name TEXT NOT NULL,
    target_domain TEXT,
    capture_mode TEXT NOT NULL CHECK(capture_mode IN ('extension', 'mitm', 'mixed')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    request_count INTEGER DEFAULT 0,
    filter_config TEXT,                       -- JSON: {allowlist: [], denylist: [], noisePresets: []}
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'complete', 'archived'))
);

CREATE TABLE requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    capture_source TEXT NOT NULL CHECK(capture_source IN ('extension', 'mitm')),
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    normalized_path TEXT NOT NULL,
    host TEXT NOT NULL,
    path TEXT NOT NULL,
    query_params TEXT,                        -- JSON object
    request_headers TEXT,                     -- JSON object
    request_body TEXT,                        -- NULL in extension mode (Phase 1); populated in MITM mode + Phase 4
    request_content_type TEXT,
    response_status INTEGER,
    response_headers TEXT,                    -- JSON object
    response_body TEXT,                       -- Truncated at 50KB
    response_content_type TEXT,
    duration_ms INTEGER,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_noise INTEGER DEFAULT 0,
    is_duplicate INTEGER DEFAULT 0
);
CREATE INDEX idx_requests_session ON requests(session_id);
CREATE INDEX idx_requests_normalized ON requests(session_id, normalized_path, method);
CREATE INDEX idx_requests_captured_at ON requests(captured_at);

CREATE TABLE endpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    normalized_path TEXT NOT NULL,
    host TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    sample_request_ids TEXT,                  -- JSON array of up to 3 request IDs for inference
    auth_detected TEXT CHECK(auth_detected IN ('bearer', 'basic', 'cookie', 'apikey', NULL)),
    UNIQUE(session_id, method, normalized_path, host)
);
CREATE INDEX idx_endpoints_session ON endpoints(session_id);

-- 002_inference.sql

CREATE TABLE inference_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint_id INTEGER NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    inferred_name TEXT,
    inferred_description TEXT,
    request_body_schema TEXT,                 -- JSON Schema object (stringified)
    response_body_schema TEXT,                -- JSON Schema object (stringified)
    path_params TEXT,                         -- JSON array: [{name, description, example}]
    query_param_descriptions TEXT,            -- JSON object: {param_name: description}
    auth_scheme TEXT CHECK(auth_scheme IN ('bearer', 'basic', 'apikey', 'none', NULL)),
    tags TEXT,                                -- JSON array of strings
    raw_claude_response TEXT,
    tokens_used INTEGER,
    inferred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    model_used TEXT DEFAULT 'claude-sonnet-4-6'
);
CREATE INDEX idx_inference_endpoint ON inference_results(endpoint_id);
CREATE INDEX idx_inference_session ON inference_results(session_id);
```

### Type Definitions

```typescript
// src/types/index.ts

export interface Session {
  id: string;
  name: string;
  targetDomain?: string;
  captureMode: 'extension' | 'mitm' | 'mixed';
  startedAt: string;
  endedAt?: string;
  requestCount: number;
  filterConfig?: FilterConfig;
  status: 'active' | 'complete' | 'archived';
}

export interface FilterConfig {
  allowlist: string[];         // domains to capture; empty = capture all
  denylist: string[];          // domains to always ignore
  noisePresets: NoisePreset[];
  pathExcludePatterns: string[]; // regex strings
}

export type NoisePreset = 'analytics' | 'cdn' | 'social' | 'fonts';

export interface CapturedRequest {
  id: number;
  sessionId: string;
  captureSource: 'extension' | 'mitm';
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
  authDetected?: 'bearer' | 'basic' | 'cookie' | 'apikey';
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
  authScheme?: 'bearer' | 'basic' | 'apikey' | 'none';
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

export interface InferencePromptPayload {
  method: string;
  path: string;
  host: string;
  samples: {
    requestBody?: string;
    requestHeaders?: Record<string, string>;  // auth headers stripped before sending
    responseStatus: number;
    responseBody?: string;                    // truncated to 3,000 chars
    responseHeaders?: Record<string, string>;
  }[];
}

export interface ProxyStatus {
  running: boolean;
  port: number;
  caInstalled: boolean;
  caPath: string;
  requestsIntercepted: number;
}

// Postman Collection v2.1 shapes
export interface PostmanCollection {
  info: {
    name: string;
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
    description?: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
}

export interface PostmanItem {
  name: string;
  request: {
    method: string;
    url: { raw: string; host: string[]; path: string[]; query?: PostmanQueryParam[] };
    header?: PostmanHeader[];
    body?: { mode: 'raw'; raw: string; options?: { raw: { language: 'json' } } };
    description?: string;
  };
  response?: unknown[];
}

export interface PostmanHeader { key: string; value: string; description?: string; }
export interface PostmanQueryParam { key: string; value: string; description?: string; }
export interface PostmanVariable { key: string; value: string; description?: string; }
```

### API Contracts

**Anthropic API (inference calls):**
| Field | Value |
|-------|-------|
| Endpoint | `https://api.anthropic.com/v1/messages` |
| Method | POST |
| Auth | Handled by Claude.ai artifact proxy (no key in code) |
| Model | `claude-sonnet-4-6` |
| max_tokens | 1000 |
| Rate limit | Sequential calls only — no parallel inference |
| Payload size | Max 6,000 tokens per request; response body truncated to 3,000 chars before sending |
| Response | JSON object matching `InferenceResult` shape — strip markdown fences before `JSON.parse()` |

**Inference prompt template** (in `src/lib/inference.ts`):
```
System: You are an API documentation assistant. Analyze captured HTTP traffic for a single endpoint and respond ONLY with a valid JSON object. Do not include markdown fences or any text outside the JSON.

User: Analyze this endpoint and return a JSON object with these fields:
- inferredName (string): short human-readable name e.g. "Get User Profile"
- inferredDescription (string): one sentence
- requestBodySchema (JSON Schema object or null)
- responseBodySchema (JSON Schema object or null)
- pathParams (array of {name, description, example})
- queryParamDescriptions (object: {paramName: description})
- authScheme ("bearer" | "basic" | "apikey" | "none")
- tags (array of 1-3 category strings)

Endpoint data:
${JSON.stringify(payload)}
```

### Dependencies

```bash
# Frontend
npm install postman-collection@4 postman-collection-transformer@4
npm install @tauri-apps/api@2 @tauri-apps/plugin-dialog@2 @tauri-apps/plugin-fs@2
npm install -D typescript@5 vite@5 @vitejs/plugin-react tailwindcss autoprefixer postcss

# Rust — add to src-tauri/Cargo.toml
# hudsucker = "0.10"
# rcgen = { version = "0.13", features = ["pem"] }
# tokio = { version = "1", features = ["full"] }
# sqlx = { version = "0.7", features = ["sqlite", "runtime-tokio-rustls", "chrono", "uuid"] }
# serde = { version = "1", features = ["derive"] }
# serde_json = "1"
# uuid = { version = "1", features = ["v4"] }
# regex = "1"
# tracing = "0.1"
# tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Scaffold command
npm create tauri-app@latest api-reverse-engineer -- --template react-ts
```

---

## Scope Boundaries

**In scope:**
- Chrome MV3 + Firefox MV2 browser extension capture (headers, URL, method, status; bodies in Phase 4)
- hudsucker MITM proxy for full system HTTPS capture including bodies
- Per-install CA cert generation and guided macOS System keychain installation
- URL normalization and endpoint deduplication (path param collapsing)
- Domain allow/denylist filtering + noise preset filters
- Claude Sonnet 4 inference: name, description, JSON Schema, path params, auth scheme, tags
- Postman Collection v2.1 export with auth header redaction by default
- Session management: create, list, rename, delete, export-to-zip

**Out of scope (do not build):**
- OpenAPI 3.x YAML/JSON export
- TypeScript SDK stub generation
- Markdown documentation export
- Safari WebExtensions support
- SQLCipher encryption at rest
- Windows or Linux support
- Mobile traffic capture (iOS simulator proxy config is user-configured)
- Cloud sync or shared sessions

**Deferred to Phase 5+:**
- OpenAPI export
- Windows build
- SQLCipher encryption option
- Webhook/GraphQL specialized parsing

---

## Security & Credentials

- **CA private key** (`ca.key`): `~/Library/Application Support/apispy/ca.key`, permissions `0600`. Never logged, never exported, never transmitted.
- **Captured auth headers**: stored in SQLite as-is for local use. Stripped from all Anthropic API inference payloads. Replaced with `{{bearer_token}}` / `{{api_key}}` in Postman export by default.
- **Data leaving the machine**: only truncated request/response body fragments (max 3,000 chars per body) with auth headers removed, sent to `api.anthropic.com` during inference. Zero capture data transmitted otherwise.
- **Proxy binding**: hudsucker binds to `127.0.0.1:8877` only. Not LAN-accessible.
- **CA scope**: installed to macOS System keychain via `security add-trusted-cert -d -r trustRoot`. Document clearly in CASetupModal — user must understand what they're installing.
- **SQLite DB files**: plaintext, stored in `~/Library/Application Support/apispy/sessions/`. Users capturing internal API traffic should be aware of this.

---

## Phase 0: Foundation (Week 1)

**Objective:** Tauri 2 project scaffolded, SQLite schema applied, native host binary compiling, Chrome extension manifest registered.

**Tasks:**

1. Scaffold with `npm create tauri-app@latest api-reverse-engineer -- --template react-ts`. Add Tailwind CSS. Verify dev server starts.
   **Acceptance:** `npm run tauri dev` opens Tauri window with no errors in terminal or browser console.

2. Write `001_initial.sql` and `002_inference.sql`. Wire `sqlx` connection pool in `db/mod.rs` with `sqlx::migrate!()`. Implement `create_session` and `list_sessions` commands in `commands/session.rs`.
   **Acceptance:** `invoke('create_session', { name: 'test', captureMode: 'extension' })` returns a session object with UUID; `invoke('list_sessions')` returns it in an array.

3. Write `native_host/main.rs`: reads 4-byte LE length-prefixed JSON from stdin (Chrome Native Messaging framing), parses the request object, inserts a row into `requests` and upserts `endpoints` via the SQLite connection.
   **Acceptance:** `echo` a framed JSON message to the binary via stdin; verify row inserted in SQLite using `sqlite3 test.db "SELECT * FROM requests"`.

4. Create `extension/chrome/manifest.json` (MV3) with `webRequest`, `nativeMessaging`, and `<all_urls>` permissions. Register native host manifest at `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.apispy.host.json` pointing to compiled binary path.
   **Acceptance:** Load extension in Chrome developer mode (Extensions → Load unpacked). Service worker console shows no errors.

5. Implement `proxy/normalizer.rs` with regex-based path parameter detection. Path segment rules: pure integers → `{id}`, UUIDs (`[a-f0-9-]{36}`) → `{id}`, hex strings ≥8 chars → `{id}`, alphanumeric ≥10 chars with mixed case → `{id}`.
   **Acceptance:** `cargo test` — all normalizer unit tests pass:
   - `/users/123` → `/users/{id}`
   - `/items/a1b2c3d4-e5f6-7890-abcd-ef1234567890` → `/items/{id}`
   - `/api/v2/posts/456/comments/789` → `/api/v2/posts/{id}/comments/{id}`
   - `/api/v1` → `/api/v1` (version segment preserved)

**Verification checklist:**
- [ ] `cargo test` in `src-tauri/` → all normalizer tests pass
- [ ] `npm run tauri dev` → window opens, zero console errors
- [ ] `invoke('create_session')` → returns session with UUID
- [ ] `invoke('list_sessions')` → returns array containing the session
- [ ] Chrome extension loads with no service worker errors
- [ ] Native host binary accepts framed JSON on stdin and writes to SQLite

**Risks:**
- `sqlx` offline mode requires `DATABASE_URL` set for compile-time query checking → set `DATABASE_URL=sqlite:./dev.db` in `.env` for local dev; add `.env` to `.gitignore`.
- Native messaging host manifest path differs between Chrome stable, beta, and dev channels → detect channel in the Rust install command and write to the correct path; log which path was used.

---

## Phase 1: Extension Capture + Live Request View (Week 2)

**Objective:** Chrome extension captures XHR/fetch requests and streams them live into the React frontend. EndpointMap correctly deduplicates by normalized path.

**Tasks:**

1. Implement `extension/chrome/background.js` service worker: subscribe to `chrome.webRequest.onCompleted` (headers, URL, method, status, timing). Buffer incoming requests in an in-memory array, flush every 500ms via `chrome.runtime.sendNativeMessage`. Add 20-second keepalive ping to prevent MV3 service worker termination.
   **Acceptance:** Navigate to `jsonplaceholder.typicode.com/posts` while extension recording → native host receives ≥5 request objects with correct method/URL/status within 2 seconds.

2. Implement `commands/capture.rs`: `get_requests(session_id, limit, offset)` → paginated `CapturedRequest[]`; `get_endpoints(session_id)` → `Endpoint[]` from the endpoints table.
   **Acceptance:** After capturing 10 requests to JSONPlaceholder, `invoke('get_endpoints')` returns deduplicated list where `/posts/1`, `/posts/2`, `/posts/3` collapse to single `/posts/{id}` entry with `request_count: 3`.

3. Wire Tauri event emitter: emit `request:captured` event (carrying the `CapturedRequest` payload) from Rust on every SQLite insert. Implement `useCapture` hook in React using `listen('request:captured', handler)`.
   **Acceptance:** New requests appear in the React UI within 1 second of browser navigation — no manual refresh.

4. Build `RequestList.tsx`: virtualized scroll (use windowing if >500 rows), method badge (color-coded: GET=blue, POST=green, PUT=amber, DELETE=red), URL, response status, relative timestamp. Build `EndpointMap.tsx`: grouped by `normalized_path`, shows method badges, `request_count`, auth detected icon.
   **Acceptance:** Visual inspection with 20 captured requests — endpoint map correctly groups by pattern, method colors correct, no obvious miscategorizations.

5. Implement domain noise filtering in `proxy/filter.rs`. Default denylist includes: `google-analytics.com`, `googletagmanager.com`, `doubleclick.net`, `facebook.net`, `hotjar.com`, `segment.io`, `mixpanel.com`, `amplitude.com`, `clarity.ms`, `sentry.io`. Static asset extension filter: `.js .css .woff .woff2 .ttf .png .jpg .svg .ico .map .br`.
   **Acceptance:** Capture a real SPA (e.g., `app.netlify.com`) — noise filter drops analytics/CDN requests from EndpointMap display; they remain in DB with `is_noise=1`.

**Verification checklist:**
- [ ] 30-second capture of `jsonplaceholder.typicode.com` → ≥15 requests captured, ≥5 unique endpoints
- [ ] `/posts/{id}` shown as single endpoint with correct count (not separate rows per ID)
- [ ] Live `request:captured` events appear within 1 second
- [ ] Noise filter: Google Analytics requests marked `is_noise=1`, hidden from EndpointMap
- [ ] RequestList renders 100+ rows without layout breaking

**Risks:**
- Chrome MV3 service workers terminate after 30 seconds of idle → keepalive ping in background.js sends a dummy `chrome.runtime.getPlatformInfo()` call every 20 seconds during recording. Test with a 5-minute idle recording session.
- `webRequest.onCompleted` does NOT provide request or response bodies in extension mode → display "Body: captured in MITM mode" placeholder in request detail view for Phase 1.

---

## Phase 2: MITM Proxy Mode (Weeks 3–4)

**Objective:** hudsucker proxy running as a Tauri-managed async task, intercepting HTTPS from any macOS process, bodies included.

**Tasks:**

1. Implement `proxy/mitm.rs`: spin up hudsucker on `127.0.0.1:8877` as a Tokio async task. Implement request/response handler that captures method, URL, all headers, request body, response status, response body (truncated at 50KB), duration. Emit same `request:captured` Tauri event.
   **Acceptance:** `curl -x http://localhost:8877 https://httpbin.org/get` → row in SQLite with full headers and non-null response body containing `"url": "https://httpbin.org/get"`.

2. Implement CA cert generation in `proxy/mitm.rs`: on first proxy start, if `~/Library/Application Support/apispy/ca.crt` does not exist, generate a self-signed CA using `rcgen` (2048-bit RSA, 10-year validity, marked as CA). Write cert to `.crt` and key to `.key` with `0600` permissions. Return cert path via `get_ca_status()` Tauri command.
   **Acceptance:** After first proxy start, `openssl x509 -in ~/Library/Application\ Support/apispy/ca.crt -text -noout` shows `CA:TRUE` in Basic Constraints.

3. Build `CASetupModal.tsx`: displayed when MITM mode is toggled on and CA is not yet trusted. Shows: what the cert is, why it's needed, what the install command does. "Install CA Certificate" button calls `install_ca` Tauri command which runs `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain [ca_path]` via `std::process::Command`. Shows system auth dialog.
   **Acceptance:** Click "Install CA Certificate" → macOS auth dialog appears → cert installed → `security find-certificate -c "APIspy Local CA"` succeeds in Terminal.

4. Implement `start_proxy` / `stop_proxy` commands. Wire to `CaptureBar.tsx` mode toggle. Show proxy status badge: port number, running indicator, request count. Proxy stops cleanly when Tauri app window closes (register `on_window_event` handler).
   **Acceptance:** Toggle MITM on → proxy starts, status shows "Running on :8877". Toggle off → proxy stops within 2 seconds, no orphaned process in `ps aux`.

5. Implement Firefox extension: copy `extension/chrome/background.js`, adapt for Firefox WebExtensions API (replace `chrome.` with `browser.` where needed). Create `extension/firefox/manifest.json` (MV2) with `browser_specific_settings.gecko.id`.
   **Acceptance:** Load Firefox extension in about:debugging → same 30-second capture test as Phase 1 passes in Firefox 120+.

**Verification checklist:**
- [ ] `curl -x http://localhost:8877 https://httpbin.org/post -d '{"test":1}'` → request_body stored as `{"test":1}` in SQLite
- [ ] `curl -x http://localhost:8877 https://httpbin.org/get` → response_body stored, not NULL
- [ ] CA cert installs via modal without opening Terminal
- [ ] `openssl x509 -in ca.crt -text` shows `CA:TRUE`
- [ ] Proxy process absent from `ps aux` within 3 seconds of app close
- [ ] Firefox extension captures ≥10 requests in 30-second test

**Risks:**
- `security add-trusted-cert` requires admin privileges on macOS 14+ Sonoma → Tauri's `Command` must use `runas` / `AuthorizationExecuteWithPrivileges` approach. Test on macOS 14 specifically — behavior changed in Sonoma.
- Some Electron apps and apps with certificate pinning will fail MITM → document as known limitation in the app. Show a "Certificate pinning detected" indicator when a connection fails with SSL errors.
- hudsucker 0.10.x API may shift → pin exact version in `Cargo.lock`, write smoke test that compiles and runs a basic proxy in CI.

---

## Phase 3: Claude Inference Pipeline + Postman Export (Week 5)

**Objective:** Selected endpoints processed by Claude Sonnet 4 and exported as a valid, importable Postman Collection v2.1.

**Tasks:**

1. Implement `src/lib/inference.ts`: builds `InferencePromptPayload` from endpoint + sampled requests (strip `Authorization`, `Cookie`, `X-API-Key` headers; truncate response body to 3,000 chars; merge up to 3 samples). Calls Anthropic API. Strips markdown fences from response. Parses JSON. Returns `InferenceResult`.
   **Acceptance:** Manual test — call `runInference(endpoint, requests)` in browser console with a real JSONPlaceholder endpoint; returns valid `InferenceResult` with no parse errors and non-empty `inferredName`.

2. Implement `useInference.ts` hook: maintains queue of `Endpoint[]` to process, calls `runInference` sequentially (one at a time), updates progress state `{completed: N, total: N, currentEndpoint: string, tokensUsed: N}`, writes each result to SQLite via `invoke('save_inference_result', result)`. Handles errors per-endpoint without aborting the queue.
   **Acceptance:** Process 10 JSONPlaceholder endpoints; all 10 complete within 60 seconds; 10 rows in `inference_results`; UI shows progress per endpoint; a single 429 error retries after 5 seconds without crashing the queue.

3. Build `InferencePanel.tsx`: "Run AI Analysis" button, endpoint selection checkboxes (all non-noise selected by default), progress bar with `{completed}/{total}` and current endpoint name, estimated time remaining (based on avg tokens/sec), cumulative token count displayed after completion.
   **Acceptance:** Visual inspection — panel shows per-endpoint progress; no UI thread blocking; button disabled during inference run; shows summary (10 endpoints, ~N tokens) on completion.

4. Implement `src/lib/postman-builder.ts` using the `postman-collection` npm SDK: constructs `PostmanCollection` from `Endpoint[]` + `InferenceResult[]` + session name. Path params become `{{param_name}}` variables. Auth headers replaced with `{{bearer_token}}` / `{{api_key}}` variables added to collection-level `variable[]`. Groups endpoints by inferred `tags[0]` into Postman folders.
   **Acceptance:** Run `postman-collection-transformer validate` on the output → 0 errors for a 10-endpoint session.

5. Wire export: "Export Collection" button → `invoke('build_postman_collection', sessionId)` → Tauri `save_dialog` (default filename: `{session_name}.postman_collection.json`) → write to selected path → success toast with file path + "Open in Finder" action.
   **Acceptance:** Exported file imports into Postman Desktop 11 with 0 validation errors; all endpoints visible with correct names and descriptions.

**Verification checklist:**
- [ ] Inference on 10 endpoints completes within 60 seconds
- [ ] All 10 `inference_results` rows in SQLite with non-null `inferred_name`
- [ ] Token count displayed post-run matches Anthropic API usage
- [ ] Postman collection imports into Postman Desktop 11 with zero errors
- [ ] Auth headers NOT present in exported JSON (replaced with `{{variables}}`)
- [ ] Path params use `{{variable}}` syntax in exported collection URLs

**Risks:**
- Claude returns markdown fences despite system prompt instructions → `inference.ts` always strips ` ```json ` and ` ``` ` before `JSON.parse()`. If parse still fails, store `raw_claude_response` in DB and mark endpoint as `inference_failed` — show retry option in UI.
- Paginated list endpoints return 100-item arrays → response body truncation to 3,000 chars may cut mid-object → note in prompt: "Response may be truncated; infer schema from visible fields only."

---

## Phase 4: Polish & Session Management (Week 6)

**Objective:** Sessions are manageable, filter config is user-editable, inline schema edits persist, body capture works in extension mode.

**Tasks:**

1. Build `SessionManager.tsx`: grid/list of past sessions with name, date, capture mode badge, request count, status. Actions: open (load session into main view), rename (inline edit), delete (with confirmation → removes SQLite file from disk), export-to-zip (bundles `.db` + `.postman_collection.json`).
   **Acceptance:** Create 3 sessions, all appear in list with correct metadata. Delete one → list shows 2, DB file removed from `~/Library/Application Support/apispy/sessions/`.

2. Build `FilterConfig.tsx`: domain allowlist/denylist text input with tag-style chips. Noise preset toggles (analytics/CDN/social/fonts). Regex path exclusion rules (add/remove). Config saved to `filter_config` JSON column in session row on every change.
   **Acceptance:** Add `sentry.io` to denylist → new capture session: all Sentry requests have `is_noise=1`, hidden from EndpointMap. Config persists after app restart.

3. Add inline schema editor to `CollectionPreview.tsx`: click any field name or description in the rendered collection tree to edit inline. Changes call `invoke('update_inference_result', {id, field, value})`. Re-export reflects edits.
   **Acceptance:** Edit `inferredDescription` for one endpoint → re-export → updated description in Postman import.

4. Implement content script body capture (`extension/chrome/content.js`): patches `window.XMLHttpRequest.prototype.send` and `window.fetch` to intercept request bodies; monkey-patches `Response.prototype.json` and `.text` to capture response bodies; posts to background via `chrome.runtime.sendMessage`. Opt-in: requires user to grant host permission for the target domain. Shows permission prompt in `CaptureBar.tsx`.
   **Acceptance:** Enable body capture on `reqres.in` → POST to `/api/users` with `{"name":"John"}` → `request_body` stored as `{"name":"John"}` in SQLite.

5. First-run onboarding modal (shown once, stored in session/app-level SQLite flag): Step 1 — install Chrome extension (link to Chrome Web Store or sideload instructions); Step 2 — optionally install CA for MITM (links to `CASetupModal`); Step 3 — name and create first session.
   **Acceptance:** Fresh app launch (no sessions in DB) → onboarding modal appears. Completable in under 3 minutes without reading docs. After completion, modal never shows again.

**Verification checklist:**
- [ ] Session list renders 10 sessions with correct metadata
- [ ] Delete session removes DB file from disk (verify with `ls ~/Library/Application\ Support/apispy/sessions/`)
- [ ] Filter config survives app restart
- [ ] Inline schema edit → re-export → edit present in Postman
- [ ] Content script: POST request body captured and stored for fetch-based API call on `httpbin.org/post`
- [ ] Onboarding: fresh launch triggers modal; completion suppresses future display

---

## Regression Checklist (run before any release)

- [ ] Extension capture: 30-second session on `jsonplaceholder.typicode.com` → ≥10 unique endpoints, ≥0 message drops
- [ ] MITM capture: `curl -x localhost:8877 https://httpbin.org/post -d '{"key":"val"}'` → `request_body` and `response_body` stored, not NULL
- [ ] Normalizer: `/users/123/posts/456` → `/users/{id}/posts/{id}` (confirm via endpoint map)
- [ ] Noise filter: Google Analytics requests → `is_noise=1`, hidden from EndpointMap
- [ ] Inference: 5-endpoint run on JSONPlaceholder → all 5 complete, no parse errors, non-empty `inferred_name`
- [ ] Export: import into Postman Desktop 11 → 0 validation errors, auth headers absent from export
- [ ] Session delete: DB file removed from disk
- [ ] Proxy cleanup: no `hudsucker` process in `ps aux` after app closes
