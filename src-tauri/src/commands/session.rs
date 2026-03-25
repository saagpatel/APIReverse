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

#[tauri::command]
pub fn rename_session(
    db: State<'_, DbPool>,
    session_id: String,
    name: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::rename_session(&conn, &session_id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_session(db: State<'_, DbPool>, session_id: String) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::delete_session(&conn, &session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_filter_config(
    db: State<'_, DbPool>,
    session_id: String,
    filter_config: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::update_filter_config(&conn, &session_id, &filter_config).map_err(|e| e.to_string())
}
