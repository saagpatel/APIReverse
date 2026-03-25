use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterConfig {
    #[serde(default)]
    pub allowlist: Vec<String>,
    #[serde(default)]
    pub denylist: Vec<String>,
    #[serde(default)]
    pub noise_presets: Vec<String>,
    #[serde(default)]
    pub path_exclude_patterns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub name: String,
    pub target_domain: Option<String>,
    pub capture_mode: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub request_count: i64,
    pub filter_config: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedRequest {
    pub id: i64,
    pub session_id: String,
    pub capture_source: String,
    pub method: String,
    pub url: String,
    pub normalized_path: String,
    pub host: String,
    pub path: String,
    pub query_params: Option<String>,
    pub request_headers: Option<String>,
    pub request_body: Option<String>,
    pub request_content_type: Option<String>,
    pub response_status: Option<i64>,
    pub response_headers: Option<String>,
    pub response_body: Option<String>,
    pub response_content_type: Option<String>,
    pub duration_ms: Option<i64>,
    pub captured_at: String,
    pub is_noise: bool,
    pub is_duplicate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Endpoint {
    pub id: i64,
    pub session_id: String,
    pub method: String,
    pub normalized_path: String,
    pub host: String,
    pub request_count: i64,
    pub first_seen: String,
    pub last_seen: String,
    pub sample_request_ids: Option<String>,
    pub auth_detected: Option<String>,
}
