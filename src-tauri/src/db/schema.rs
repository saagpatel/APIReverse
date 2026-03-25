use rusqlite::Connection;

pub fn migrate_v1(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            target_domain TEXT,
            capture_mode TEXT NOT NULL CHECK(capture_mode IN ('extension', 'mitm', 'mixed')),
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ended_at DATETIME,
            request_count INTEGER DEFAULT 0,
            filter_config TEXT,
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
            query_params TEXT,
            request_headers TEXT,
            request_body TEXT,
            request_content_type TEXT,
            response_status INTEGER,
            response_headers TEXT,
            response_body TEXT,
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
            sample_request_ids TEXT,
            auth_detected TEXT CHECK(auth_detected IN ('bearer', 'basic', 'cookie', 'apikey', NULL)),
            UNIQUE(session_id, method, normalized_path, host)
        );
        CREATE INDEX idx_endpoints_session ON endpoints(session_id);",
    )
}

pub fn migrate_v2(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE inference_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            endpoint_id INTEGER NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
            session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            inferred_name TEXT,
            inferred_description TEXT,
            request_body_schema TEXT,
            response_body_schema TEXT,
            path_params TEXT,
            query_param_descriptions TEXT,
            auth_scheme TEXT CHECK(auth_scheme IN ('bearer', 'basic', 'apikey', 'none', NULL)),
            tags TEXT,
            raw_claude_response TEXT,
            tokens_used INTEGER,
            inferred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            model_used TEXT DEFAULT 'claude-sonnet-4-20250514'
        );
        CREATE INDEX idx_inference_endpoint ON inference_results(endpoint_id);
        CREATE INDEX idx_inference_session ON inference_results(session_id);",
    )
}
