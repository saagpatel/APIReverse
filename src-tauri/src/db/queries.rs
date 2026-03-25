use rusqlite::{params, Connection};

use crate::models::{CapturedRequest, Endpoint, Session};

pub fn insert_session(
    conn: &Connection,
    id: &str,
    name: &str,
    capture_mode: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO sessions (id, name, capture_mode) VALUES (?1, ?2, ?3)",
        params![id, name, capture_mode],
    )?;
    Ok(())
}

pub fn get_session(conn: &Connection, id: &str) -> Result<Session, rusqlite::Error> {
    conn.query_row(
        "SELECT id, name, target_domain, capture_mode, started_at, ended_at,
                request_count, filter_config, status
         FROM sessions WHERE id = ?1",
        params![id],
        |row| {
            Ok(Session {
                id: row.get(0)?,
                name: row.get(1)?,
                target_domain: row.get(2)?,
                capture_mode: row.get(3)?,
                started_at: row.get(4)?,
                ended_at: row.get(5)?,
                request_count: row.get(6)?,
                filter_config: row.get(7)?,
                status: row.get(8)?,
            })
        },
    )
}

pub fn list_sessions(conn: &Connection) -> Result<Vec<Session>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, target_domain, capture_mode, started_at, ended_at,
                request_count, filter_config, status
         FROM sessions ORDER BY started_at DESC",
    )?;
    let sessions = stmt
        .query_map([], |row| {
            Ok(Session {
                id: row.get(0)?,
                name: row.get(1)?,
                target_domain: row.get(2)?,
                capture_mode: row.get(3)?,
                started_at: row.get(4)?,
                ended_at: row.get(5)?,
                request_count: row.get(6)?,
                filter_config: row.get(7)?,
                status: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(sessions)
}

pub fn insert_request(
    conn: &Connection,
    session_id: &str,
    capture_source: &str,
    method: &str,
    url: &str,
    normalized_path: &str,
    host: &str,
    path: &str,
    query_params: Option<&str>,
    request_headers: Option<&str>,
    response_status: Option<i64>,
    response_headers: Option<&str>,
    duration_ms: Option<i64>,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO requests (session_id, capture_source, method, url, normalized_path, host, path,
                               query_params, request_headers, response_status, response_headers, duration_ms)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            session_id,
            capture_source,
            method,
            url,
            normalized_path,
            host,
            path,
            query_params,
            request_headers,
            response_status,
            response_headers,
            duration_ms,
        ],
    )?;

    // Update session request count
    conn.execute(
        "UPDATE sessions SET request_count = request_count + 1 WHERE id = ?1",
        params![session_id],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn upsert_endpoint(
    conn: &Connection,
    session_id: &str,
    method: &str,
    normalized_path: &str,
    host: &str,
    request_id: i64,
    auth_detected: Option<&str>,
) -> Result<(), rusqlite::Error> {
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
        params![session_id, method, normalized_path, host, request_id, auth_detected],
    )?;
    Ok(())
}

pub fn get_endpoints(
    conn: &Connection,
    session_id: &str,
) -> Result<Vec<Endpoint>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, method, normalized_path, host, request_count,
                first_seen, last_seen, sample_request_ids, auth_detected
         FROM endpoints WHERE session_id = ?1
         ORDER BY request_count DESC",
    )?;
    let endpoints = stmt
        .query_map(params![session_id], |row| {
            Ok(Endpoint {
                id: row.get(0)?,
                session_id: row.get(1)?,
                method: row.get(2)?,
                normalized_path: row.get(3)?,
                host: row.get(4)?,
                request_count: row.get(5)?,
                first_seen: row.get(6)?,
                last_seen: row.get(7)?,
                sample_request_ids: row.get(8)?,
                auth_detected: row.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(endpoints)
}

pub fn get_requests(
    conn: &Connection,
    session_id: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<CapturedRequest>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, capture_source, method, url, normalized_path, host, path,
                query_params, request_headers, request_body, request_content_type,
                response_status, response_headers, response_body, response_content_type,
                duration_ms, captured_at, is_noise, is_duplicate
         FROM requests WHERE session_id = ?1
         ORDER BY captured_at DESC
         LIMIT ?2 OFFSET ?3",
    )?;
    let requests = stmt
        .query_map(params![session_id, limit, offset], |row| {
            Ok(CapturedRequest {
                id: row.get(0)?,
                session_id: row.get(1)?,
                capture_source: row.get(2)?,
                method: row.get(3)?,
                url: row.get(4)?,
                normalized_path: row.get(5)?,
                host: row.get(6)?,
                path: row.get(7)?,
                query_params: row.get(8)?,
                request_headers: row.get(9)?,
                request_body: row.get(10)?,
                request_content_type: row.get(11)?,
                response_status: row.get(12)?,
                response_headers: row.get(13)?,
                response_body: row.get(14)?,
                response_content_type: row.get(15)?,
                duration_ms: row.get(16)?,
                captured_at: row.get(17)?,
                is_noise: row.get::<_, i64>(18)? != 0,
                is_duplicate: row.get::<_, i64>(19)? != 0,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(requests)
}

pub fn get_requests_after(
    conn: &Connection,
    session_id: &str,
    after_id: i64,
) -> Result<Vec<CapturedRequest>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, capture_source, method, url, normalized_path, host, path,
                query_params, request_headers, request_body, request_content_type,
                response_status, response_headers, response_body, response_content_type,
                duration_ms, captured_at, is_noise, is_duplicate
         FROM requests WHERE session_id = ?1 AND id > ?2
         ORDER BY id ASC",
    )?;
    let requests = stmt
        .query_map(params![session_id, after_id], |row| {
            Ok(CapturedRequest {
                id: row.get(0)?,
                session_id: row.get(1)?,
                capture_source: row.get(2)?,
                method: row.get(3)?,
                url: row.get(4)?,
                normalized_path: row.get(5)?,
                host: row.get(6)?,
                path: row.get(7)?,
                query_params: row.get(8)?,
                request_headers: row.get(9)?,
                request_body: row.get(10)?,
                request_content_type: row.get(11)?,
                response_status: row.get(12)?,
                response_headers: row.get(13)?,
                response_body: row.get(14)?,
                response_content_type: row.get(15)?,
                duration_ms: row.get(16)?,
                captured_at: row.get(17)?,
                is_noise: row.get::<_, i64>(18)? != 0,
                is_duplicate: row.get::<_, i64>(19)? != 0,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(requests)
}

pub fn update_session_status(
    conn: &Connection,
    session_id: &str,
    status: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE sessions SET status = ?2, ended_at = CASE WHEN ?2 = 'complete' THEN CURRENT_TIMESTAMP ELSE ended_at END WHERE id = ?1",
        params![session_id, status],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
        )
        .unwrap();
        db::schema::migrate_v1(&conn).unwrap();
        db::schema::migrate_v2(&conn).unwrap();
        conn
    }

    #[test]
    fn test_insert_and_get_session() {
        let conn = setup_test_db();
        insert_session(&conn, "test-id-1", "My Session", "extension").unwrap();

        let session = get_session(&conn, "test-id-1").unwrap();
        assert_eq!(session.name, "My Session");
        assert_eq!(session.capture_mode, "extension");
        assert_eq!(session.status, "active");
        assert_eq!(session.request_count, 0);
    }

    #[test]
    fn test_list_sessions() {
        let conn = setup_test_db();
        insert_session(&conn, "s1", "First", "extension").unwrap();
        insert_session(&conn, "s2", "Second", "mitm").unwrap();

        let sessions = list_sessions(&conn).unwrap();
        assert_eq!(sessions.len(), 2);
    }

    #[test]
    fn test_insert_request_and_upsert_endpoint() {
        let conn = setup_test_db();
        insert_session(&conn, "s1", "Test", "extension").unwrap();

        let req_id = insert_request(
            &conn,
            "s1",
            "extension",
            "GET",
            "https://api.example.com/users/123",
            "/users/{id}",
            "api.example.com",
            "/users/123",
            None,
            None,
            Some(200),
            None,
            Some(45),
        )
        .unwrap();

        upsert_endpoint(
            &conn,
            "s1",
            "GET",
            "/users/{id}",
            "api.example.com",
            req_id,
            Some("bearer"),
        )
        .unwrap();

        let endpoints = get_endpoints(&conn, "s1").unwrap();
        assert_eq!(endpoints.len(), 1);
        assert_eq!(endpoints[0].normalized_path, "/users/{id}");
        assert_eq!(endpoints[0].request_count, 1);
        assert_eq!(endpoints[0].auth_detected.as_deref(), Some("bearer"));

        // Insert another request for the same endpoint — count should increment
        let req_id2 = insert_request(
            &conn,
            "s1",
            "extension",
            "GET",
            "https://api.example.com/users/456",
            "/users/{id}",
            "api.example.com",
            "/users/456",
            None,
            None,
            Some(200),
            None,
            Some(32),
        )
        .unwrap();

        upsert_endpoint(
            &conn,
            "s1",
            "GET",
            "/users/{id}",
            "api.example.com",
            req_id2,
            Some("bearer"),
        )
        .unwrap();

        let endpoints = get_endpoints(&conn, "s1").unwrap();
        assert_eq!(endpoints.len(), 1);
        assert_eq!(endpoints[0].request_count, 2);

        // Verify session request_count updated
        let session = get_session(&conn, "s1").unwrap();
        assert_eq!(session.request_count, 2);
    }

    #[test]
    fn test_get_requests_pagination() {
        let conn = setup_test_db();
        insert_session(&conn, "s1", "Test", "extension").unwrap();

        for i in 0..5 {
            insert_request(
                &conn,
                "s1",
                "extension",
                "GET",
                &format!("https://api.example.com/items/{i}"),
                "/items/{id}",
                "api.example.com",
                &format!("/items/{i}"),
                None,
                None,
                Some(200),
                None,
                None,
            )
            .unwrap();
        }

        let page1 = get_requests(&conn, "s1", 2, 0).unwrap();
        assert_eq!(page1.len(), 2);

        let page2 = get_requests(&conn, "s1", 2, 2).unwrap();
        assert_eq!(page2.len(), 2);

        let page3 = get_requests(&conn, "s1", 2, 4).unwrap();
        assert_eq!(page3.len(), 1);
    }
}
