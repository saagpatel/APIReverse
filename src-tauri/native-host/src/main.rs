use std::io::{self, Read, Write};
use std::path::PathBuf;

use regex::Regex;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;

// --- Normalizer (duplicated from proxy/normalizer.rs for standalone binary) ---

static RE_INTEGER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d+$").unwrap());
static RE_UUID: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$").unwrap()
});
static RE_HEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[a-f0-9]{8,}$").unwrap());
static RE_VERSION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^v\d+$").unwrap());

fn is_dynamic_segment(segment: &str) -> bool {
    if segment.is_empty() {
        return false;
    }
    if RE_VERSION.is_match(segment) {
        return false;
    }

    let lower = segment.to_ascii_lowercase();

    if RE_INTEGER.is_match(&lower) {
        return true;
    }
    if RE_UUID.is_match(&lower) {
        return true;
    }
    if RE_HEX.is_match(&lower) {
        return true;
    }
    if segment.len() >= 10
        && segment.chars().all(|c| c.is_ascii_alphanumeric())
        && segment.chars().any(|c| c.is_ascii_alphabetic())
        && segment.chars().any(|c| c.is_ascii_digit())
    {
        return true;
    }

    false
}

fn normalize_path(path: &str) -> String {
    let path = path.split('?').next().unwrap_or(path);
    if path.is_empty() || path == "/" {
        return "/".to_string();
    }

    let segments: Vec<&str> = path.split('/').collect();
    let normalized: Vec<String> = segments
        .iter()
        .map(|s| {
            if is_dynamic_segment(s) {
                "{id}".to_string()
            } else {
                s.to_string()
            }
        })
        .collect();

    let result = normalized.join("/");
    if result.is_empty() {
        "/".to_string()
    } else {
        result
    }
}

// --- Chrome Native Messaging types ---

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IncomingRequest {
    method: String,
    url: String,
    #[serde(default)]
    request_headers: Option<serde_json::Value>,
    #[serde(default)]
    response_status: Option<i64>,
    #[serde(default)]
    response_headers: Option<serde_json::Value>,
    #[serde(default)]
    duration_ms: Option<i64>,
    #[serde(default)]
    session_id: Option<String>,
}

#[derive(Serialize)]
struct NativeResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    request_id: Option<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppState {
    db_path: String,
    #[serde(default)]
    active_session_id: Option<String>,
}

// --- Native Messaging framing ---

fn read_message(stdin: &mut impl Read) -> io::Result<Option<Vec<u8>>> {
    let mut len_buf = [0u8; 4];
    match stdin.read_exact(&mut len_buf) {
        Ok(()) => {}
        Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let len = u32::from_le_bytes(len_buf) as usize;

    if len > 1_048_576 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "message exceeds 1MB limit",
        ));
    }

    let mut buf = vec![0u8; len];
    stdin.read_exact(&mut buf)?;
    Ok(Some(buf))
}

fn write_message(stdout: &mut impl Write, data: &[u8]) -> io::Result<()> {
    let len = (data.len() as u32).to_le_bytes();
    stdout.write_all(&len)?;
    stdout.write_all(data)?;
    stdout.flush()?;
    Ok(())
}

fn send_response(stdout: &mut impl Write, response: &NativeResponse) -> io::Result<()> {
    let json = serde_json::to_vec(response).map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
    write_message(stdout, &json)
}

// --- Auth detection ---

fn detect_auth(headers: &Option<serde_json::Value>) -> Option<String> {
    let headers = headers.as_ref()?.as_object()?;

    for (key, value) in headers {
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

// --- Main loop ---

fn main() {
    let state_path = dirs::home_dir()
        .expect("could not resolve home directory")
        .join("Library/Application Support/apispy/state.json");

    let state_json = match std::fs::read_to_string(&state_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("apispy-native-host: could not read state.json: {e}");
            std::process::exit(1);
        }
    };

    let state: AppState = match serde_json::from_str(&state_json) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("apispy-native-host: invalid state.json: {e}");
            std::process::exit(1);
        }
    };

    let db_path = PathBuf::from(&state.db_path);
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("apispy-native-host: could not open database: {e}");
            std::process::exit(1);
        }
    };

    conn.execute_batch(
        "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    )
    .expect("could not set PRAGMAs");

    let mut stdin = io::stdin().lock();
    let mut stdout = io::stdout().lock();

    loop {
        let msg = match read_message(&mut stdin) {
            Ok(Some(data)) => data,
            Ok(None) => break, // stdin closed
            Err(e) => {
                eprintln!("apispy-native-host: read error: {e}");
                break;
            }
        };

        let request: IncomingRequest = match serde_json::from_slice(&msg) {
            Ok(r) => r,
            Err(e) => {
                let _ = send_response(
                    &mut stdout,
                    &NativeResponse {
                        success: false,
                        error: Some(format!("invalid JSON: {e}")),
                        request_id: None,
                    },
                );
                continue;
            }
        };

        let result = process_request(&conn, &request, &state);
        match result {
            Ok(request_id) => {
                let _ = send_response(
                    &mut stdout,
                    &NativeResponse {
                        success: true,
                        error: None,
                        request_id: Some(request_id),
                    },
                );
            }
            Err(e) => {
                let _ = send_response(
                    &mut stdout,
                    &NativeResponse {
                        success: false,
                        error: Some(e),
                        request_id: None,
                    },
                );
            }
        }
    }
}

fn process_request(
    conn: &Connection,
    req: &IncomingRequest,
    state: &AppState,
) -> Result<i64, String> {
    let session_id = req
        .session_id
        .as_deref()
        .or(state.active_session_id.as_deref())
        .ok_or_else(|| "no active session".to_string())?;

    // Parse URL components
    let url_parsed =
        url_parse(&req.url).ok_or_else(|| format!("could not parse URL: {}", req.url))?;

    let normalized = normalize_path(&url_parsed.path);
    let auth_detected = detect_auth(&req.request_headers);

    let headers_json = req
        .request_headers
        .as_ref()
        .map(|h| serde_json::to_string(h).unwrap_or_default());

    let response_headers_json = req
        .response_headers
        .as_ref()
        .map(|h| serde_json::to_string(h).unwrap_or_default());

    let query_params = if url_parsed.query.is_empty() {
        None
    } else {
        Some(serde_json::to_string(&url_parsed.query).unwrap_or_default())
    };

    // Insert request
    conn.execute(
        "INSERT INTO requests (session_id, capture_source, method, url, normalized_path, host, path,
                               query_params, request_headers, response_status, response_headers, duration_ms)
         VALUES (?1, 'extension', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            session_id,
            req.method,
            req.url,
            normalized,
            url_parsed.host,
            url_parsed.path,
            query_params,
            headers_json,
            req.response_status,
            response_headers_json,
            req.duration_ms,
        ],
    )
    .map_err(|e| format!("insert request failed: {e}"))?;

    let request_id = conn.last_insert_rowid();

    // Update session request count
    conn.execute(
        "UPDATE sessions SET request_count = request_count + 1 WHERE id = ?1",
        params![session_id],
    )
    .map_err(|e| format!("update session count failed: {e}"))?;

    // Upsert endpoint
    conn.execute(
        "INSERT INTO endpoints (session_id, method, normalized_path, host, request_count, sample_request_ids, auth_detected)
         VALUES (?1, ?2, ?3, ?4, 1, json_array(?5), ?6)
         ON CONFLICT(session_id, method, normalized_path, host) DO UPDATE SET
           request_count = request_count + 1,
           last_seen = CURRENT_TIMESTAMP,
           sample_request_ids = CASE
             WHEN json_array_length(sample_request_ids) < 3
             THEN json_insert(sample_request_ids, '$[#]', ?5)
             ELSE sample_request_ids
           END",
        params![
            session_id,
            req.method,
            normalized,
            url_parsed.host,
            request_id,
            auth_detected,
        ],
    )
    .map_err(|e| format!("upsert endpoint failed: {e}"))?;

    Ok(request_id)
}

// --- Simple URL parser (no external dependency) ---

struct ParsedUrl {
    host: String,
    path: String,
    query: std::collections::HashMap<String, String>,
}

fn url_parse(url: &str) -> Option<ParsedUrl> {
    // Strip scheme
    let after_scheme = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))?;

    // Split host from path
    let (host_port, path_and_query) = match after_scheme.find('/') {
        Some(idx) => (&after_scheme[..idx], &after_scheme[idx..]),
        None => (after_scheme, "/"),
    };

    // Strip port from host
    let host = host_port.split(':').next().unwrap_or(host_port).to_string();

    // Split path from query
    let (path, query_string) = match path_and_query.find('?') {
        Some(idx) => (&path_and_query[..idx], &path_and_query[idx + 1..]),
        None => (path_and_query, ""),
    };

    let mut query = std::collections::HashMap::new();
    if !query_string.is_empty() {
        for pair in query_string.split('&') {
            let mut parts = pair.splitn(2, '=');
            if let Some(key) = parts.next() {
                let value = parts.next().unwrap_or("");
                query.insert(key.to_string(), value.to_string());
            }
        }
    }

    Some(ParsedUrl {
        host,
        path: path.to_string(),
        query,
    })
}
