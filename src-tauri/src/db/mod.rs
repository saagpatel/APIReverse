pub mod queries;
pub mod schema;

use std::path::Path;

use rusqlite::Connection;

pub fn init_db(path: &Path) -> Result<Connection, Box<dyn std::error::Error>> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA busy_timeout=5000;",
    )?;

    let version: u32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version < 1 {
        schema::migrate_v1(&conn)?;
        conn.execute_batch("PRAGMA user_version = 1;")?;
    }
    if version < 2 {
        schema::migrate_v2(&conn)?;
        conn.execute_batch("PRAGMA user_version = 2;")?;
    }
    if version < 3 {
        schema::migrate_v3(&conn)?;
        conn.execute_batch("PRAGMA user_version = 3;")?;
    }

    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_db_in_memory() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA foreign_keys=ON;
             PRAGMA busy_timeout=5000;",
        )
        .unwrap();

        let version: u32 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, 0);

        schema::migrate_v1(&conn).unwrap();
        conn.execute_batch("PRAGMA user_version = 1;").unwrap();
        schema::migrate_v2(&conn).unwrap();
        conn.execute_batch("PRAGMA user_version = 2;").unwrap();
        schema::migrate_v3(&conn).unwrap();
        conn.execute_batch("PRAGMA user_version = 3;").unwrap();

        let version: u32 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, 3);
    }

    #[test]
    fn test_init_db_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let conn1 = init_db(&db_path).unwrap();
        drop(conn1);

        let conn2 = init_db(&db_path).unwrap();
        let version: u32 = conn2
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, 3);
    }

    #[test]
    fn test_foreign_keys_enforced() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_db(&db_path).unwrap();

        let result = conn.execute(
            "INSERT INTO requests (session_id, capture_source, method, url, normalized_path, host, path)
             VALUES ('nonexistent', 'extension', 'GET', 'http://example.com', '/test', 'example.com', '/test')",
            [],
        );
        assert!(
            result.is_err(),
            "FK constraint should prevent insert with missing session"
        );
    }
}
