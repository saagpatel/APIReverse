use tauri::State;

use crate::db::queries;
use crate::models::{CapturedRequest, InferenceResult};
use crate::DbPool;

#[tauri::command]
pub fn save_inference_result(
    db: State<'_, DbPool>,
    endpoint_id: i64,
    session_id: String,
    inferred_name: Option<String>,
    inferred_description: Option<String>,
    request_body_schema: Option<String>,
    response_body_schema: Option<String>,
    path_params: Option<String>,
    query_param_descriptions: Option<String>,
    auth_scheme: Option<String>,
    tags: Option<String>,
    raw_claude_response: Option<String>,
    tokens_used: Option<i64>,
    model_used: Option<String>,
) -> Result<i64, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::save_inference_result(
        &conn,
        endpoint_id,
        &session_id,
        inferred_name.as_deref(),
        inferred_description.as_deref(),
        request_body_schema.as_deref(),
        response_body_schema.as_deref(),
        path_params.as_deref(),
        query_param_descriptions.as_deref(),
        auth_scheme.as_deref(),
        tags.as_deref(),
        raw_claude_response.as_deref(),
        tokens_used,
        model_used.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_inference_results(
    db: State<'_, DbPool>,
    session_id: String,
) -> Result<Vec<InferenceResult>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_inference_results(&conn, &session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_requests_by_ids(
    db: State<'_, DbPool>,
    ids: Vec<i64>,
) -> Result<Vec<CapturedRequest>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_requests_by_ids(&conn, &ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_setting(db: State<'_, DbPool>, key: String) -> Result<Option<String>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_setting(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(db: State<'_, DbPool>, key: String, value: String) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_inference_result(
    db: State<'_, DbPool>,
    id: i64,
    inferred_name: Option<String>,
    inferred_description: Option<String>,
    tags: Option<String>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::update_inference_result(
        &conn,
        id,
        inferred_name.as_deref(),
        inferred_description.as_deref(),
        tags.as_deref(),
    )
    .map_err(|e| e.to_string())
}
