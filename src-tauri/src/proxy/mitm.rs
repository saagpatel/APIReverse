use std::sync::{Arc, Mutex};
use std::time::Instant;

use bytes::Bytes;
use http_body_util::BodyExt;
use hudsucker::hyper::{Request, Response, Uri};
use hudsucker::{Body, HttpContext, HttpHandler, RequestOrResponse};

use crate::db::queries;
use crate::models::FilterConfig;
use crate::proxy::filter;
use crate::proxy::normalizer;
use crate::DbPool;

const MAX_BODY_SIZE: usize = 50 * 1024; // 50KB

/// State shared across clones of the handler (one clone per connection).
struct SharedState {
    db: DbPool,
    session_id: String,
    filter_config: FilterConfig,
}

#[derive(Clone)]
pub struct ApiSpyHandler {
    shared: Arc<SharedState>,
    /// Per-request start time, set in handle_request, read in handle_response.
    request_start: Arc<Mutex<Option<Instant>>>,
    /// Per-request metadata captured in handle_request.
    request_meta: Arc<Mutex<Option<RequestMeta>>>,
}

struct RequestMeta {
    method: String,
    url: String,
    host: String,
    path: String,
    query_params: Option<String>,
    request_headers: Option<String>,
    request_body: Option<String>,
    request_content_type: Option<String>,
}

impl ApiSpyHandler {
    pub fn new(db: DbPool, session_id: String, filter_config: FilterConfig) -> Self {
        Self {
            shared: Arc::new(SharedState {
                db,
                session_id,
                filter_config,
            }),
            request_start: Arc::new(Mutex::new(None)),
            request_meta: Arc::new(Mutex::new(None)),
        }
    }
}

impl HttpHandler for ApiSpyHandler {
    async fn handle_request(
        &mut self,
        _ctx: &HttpContext,
        req: Request<Body>,
    ) -> RequestOrResponse {
        // Record start time
        if let Ok(mut start) = self.request_start.lock() {
            *start = Some(Instant::now());
        }

        let method = req.method().to_string();
        let uri = req.uri().clone();
        let url = uri.to_string();

        let (host, path, query_params) = parse_uri(&uri);

        // Capture request headers as JSON
        let request_headers = {
            let mut map = serde_json::Map::new();
            for (name, value) in req.headers() {
                if let Ok(v) = value.to_str() {
                    map.insert(name.to_string(), serde_json::Value::String(v.to_string()));
                }
            }
            if map.is_empty() {
                None
            } else {
                Some(serde_json::to_string(&map).unwrap_or_default())
            }
        };

        let request_content_type = req
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .map(String::from);

        // Capture request body (consume and rebuild)
        let (parts, body) = req.into_parts();
        let body_bytes: Bytes = body
            .collect()
            .await
            .map(|collected| collected.to_bytes())
            .unwrap_or_default();
        let body_bytes = if body_bytes.is_empty() {
            None
        } else {
            Some(body_bytes)
        };

        let request_body = body_bytes.as_ref().and_then(|bytes| {
            if bytes.len() > MAX_BODY_SIZE {
                let truncated = &bytes[..MAX_BODY_SIZE];
                String::from_utf8(truncated.to_vec()).ok()
            } else {
                String::from_utf8(bytes.to_vec()).ok()
            }
        });

        // Rebuild the request with the body
        let new_body = match &body_bytes {
            Some(b) => Body::from(http_body_util::Full::new(b.clone())),
            None => Body::empty(),
        };
        let rebuilt = Request::from_parts(parts, new_body);

        // Store request metadata for handle_response
        if let Ok(mut meta) = self.request_meta.lock() {
            *meta = Some(RequestMeta {
                method,
                url,
                host,
                path,
                query_params,
                request_headers,
                request_body,
                request_content_type,
            });
        }

        rebuilt.into()
    }

    async fn handle_response(
        &mut self,
        _ctx: &HttpContext,
        res: Response<Body>,
    ) -> Response<Body> {
        let duration_ms = self
            .request_start
            .lock()
            .ok()
            .and_then(|mut s| s.take())
            .map(|start| start.elapsed().as_millis() as i64);

        let meta = self.request_meta.lock().ok().and_then(|mut m| m.take());
        let meta = match meta {
            Some(m) => m,
            None => return res, // No metadata — shouldn't happen, but don't block traffic
        };

        let response_status = Some(res.status().as_u16() as i64);

        // Capture response headers
        let response_headers = {
            let mut map = serde_json::Map::new();
            for (name, value) in res.headers() {
                if let Ok(v) = value.to_str() {
                    map.insert(name.to_string(), serde_json::Value::String(v.to_string()));
                }
            }
            if map.is_empty() {
                None
            } else {
                Some(serde_json::to_string(&map).unwrap_or_default())
            }
        };

        let response_content_type = res
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .map(String::from);

        // Capture response body (consume and rebuild)
        let (parts, body) = res.into_parts();
        let body_bytes: Bytes = body
            .collect()
            .await
            .map(|collected| collected.to_bytes())
            .unwrap_or_default();

        let response_body = if body_bytes.is_empty() {
            None
        } else if should_capture_body(response_content_type.as_deref()) {
            let truncated = if body_bytes.len() > MAX_BODY_SIZE {
                &body_bytes[..MAX_BODY_SIZE]
            } else {
                &body_bytes[..]
            };
            String::from_utf8(truncated.to_vec()).ok()
        } else {
            None
        };

        // Rebuild response
        let new_body = Body::from(http_body_util::Full::new(body_bytes.clone()));
        let rebuilt = Response::from_parts(parts, new_body);

        // Write to database (non-blocking — don't slow down the proxy)
        let normalized = normalizer::normalize_path(&meta.path);
        let is_noise = filter::is_noise(&meta.host, &meta.path, &self.shared.filter_config);
        let auth_detected = detect_auth(&meta.request_headers);

        if let Ok(conn) = self.shared.db.lock() {
            let insert_result = conn.execute(
                "INSERT INTO requests (session_id, capture_source, method, url, normalized_path, host, path,
                                       query_params, request_headers, request_body, request_content_type,
                                       response_status, response_headers, response_body, response_content_type,
                                       duration_ms, is_noise)
                 VALUES (?1, 'mitm', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
                rusqlite::params![
                    self.shared.session_id,
                    meta.method,
                    meta.url,
                    normalized,
                    meta.host,
                    meta.path,
                    meta.query_params,
                    meta.request_headers,
                    meta.request_body,
                    meta.request_content_type,
                    response_status,
                    response_headers,
                    response_body,
                    response_content_type,
                    duration_ms,
                    is_noise as i64,
                ],
            );

            match insert_result {
                Ok(_) => {
                    let request_id = conn.last_insert_rowid();

                    // Update session request count
                    let _ = conn.execute(
                        "UPDATE sessions SET request_count = request_count + 1 WHERE id = ?1",
                        rusqlite::params![self.shared.session_id],
                    );

                    // Upsert endpoint
                    let _ = queries::upsert_endpoint(
                        &conn,
                        &self.shared.session_id,
                        &meta.method,
                        &normalized,
                        &meta.host,
                        request_id,
                        auth_detected.as_deref(),
                    );
                }
                Err(e) => {
                    tracing::warn!("Failed to insert MITM request: {e}");
                }
            }
        }

        rebuilt
    }
}

fn parse_uri(uri: &Uri) -> (String, String, Option<String>) {
    let host = uri
        .host()
        .unwrap_or("unknown")
        .to_string();
    let path = uri.path().to_string();
    let query_params = uri.query().map(|q| {
        let mut map = serde_json::Map::new();
        for pair in q.split('&') {
            let mut parts = pair.splitn(2, '=');
            if let Some(key) = parts.next() {
                let value = parts.next().unwrap_or("");
                map.insert(key.to_string(), serde_json::Value::String(value.to_string()));
            }
        }
        serde_json::to_string(&map).unwrap_or_default()
    });
    (host, path, query_params)
}

fn should_capture_body(content_type: Option<&str>) -> bool {
    match content_type {
        None => true, // Capture if no content-type (might be text)
        Some(ct) => {
            let ct = ct.to_ascii_lowercase();
            ct.contains("json")
                || ct.contains("text")
                || ct.contains("xml")
                || ct.contains("html")
                || ct.contains("javascript")
                || ct.contains("form-urlencoded")
        }
    }
}

fn detect_auth(headers_json: &Option<String>) -> Option<String> {
    let headers_str = headers_json.as_ref()?;
    let headers: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(headers_str).ok()?;

    for (key, value) in &headers {
        let lower_key = key.to_ascii_lowercase();
        let val_str = value.as_str().unwrap_or_default().to_ascii_lowercase();

        if lower_key == "authorization" {
            if val_str.starts_with("bearer ") {
                return Some("bearer".to_string());
            }
            if val_str.starts_with("basic ") {
                return Some("basic".to_string());
            }
        }
        if lower_key == "x-api-key" || lower_key == "api-key" {
            return Some("apikey".to_string());
        }
        if lower_key == "cookie" {
            return Some("cookie".to_string());
        }
    }

    None
}
