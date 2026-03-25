use tauri::State;

use crate::db::queries;
use crate::models::Session;
use crate::DbPool;

#[tauri::command]
pub fn create_session(
    db: State<'_, DbPool>,
    name: String,
    capture_mode: String,
) -> Result<Session, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::insert_session(&conn, &id, &name, &capture_mode).map_err(|e| e.to_string())?;
    queries::get_session(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_sessions(db: State<'_, DbPool>) -> Result<Vec<Session>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::list_sessions(&conn).map_err(|e| e.to_string())
}
