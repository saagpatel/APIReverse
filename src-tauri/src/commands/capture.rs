use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::watch;

use crate::db::queries;
use crate::models::{CapturedRequest, Endpoint};
use crate::DbPool;

pub type ActiveCapture = Arc<Mutex<ActiveCaptureInner>>;

pub struct ActiveCaptureInner {
    pub session_id: Option<String>,
    pub cancel_tx: Option<watch::Sender<bool>>,
    pub proxy: Option<crate::proxy::ProxyServer>,
}

impl ActiveCaptureInner {
    pub fn new() -> Self {
        Self {
            session_id: None,
            cancel_tx: None,
            proxy: None,
        }
    }
}

#[tauri::command]
pub fn get_requests(
    db: State<'_, DbPool>,
    session_id: String,
    limit: i64,
    offset: i64,
) -> Result<Vec<CapturedRequest>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_requests(&conn, &session_id, limit, offset).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_endpoints(
    db: State<'_, DbPool>,
    session_id: String,
) -> Result<Vec<Endpoint>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_endpoints(&conn, &session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn start_capture(
    app: AppHandle,
    db: State<'_, DbPool>,
    active: State<'_, ActiveCapture>,
    session_id: String,
) -> Result<(), String> {
    let mut capture = active.lock().map_err(|e| e.to_string())?;

    // Stop existing capture if running
    if let Some(tx) = capture.cancel_tx.take() {
        let _ = tx.send(true);
    }

    // Update state.json with active session
    write_state_json(&session_id).map_err(|e| e.to_string())?;

    // Start polling task
    let (cancel_tx, cancel_rx) = watch::channel(false);
    capture.session_id = Some(session_id.clone());
    capture.cancel_tx = Some(cancel_tx);

    let db_clone = (*db).clone();
    let session_id_clone = session_id.clone();

    tauri::async_runtime::spawn(async move {
        poll_for_new_requests(app, db_clone, session_id_clone, cancel_rx).await;
    });

    Ok(())
}

#[tauri::command]
pub fn stop_capture(
    db: State<'_, DbPool>,
    active: State<'_, ActiveCapture>,
) -> Result<(), String> {
    let mut capture = active.lock().map_err(|e| e.to_string())?;

    if let Some(tx) = capture.cancel_tx.take() {
        let _ = tx.send(true);
    }

    if let Some(ref session_id) = capture.session_id {
        let conn = db.lock().map_err(|e| e.to_string())?;
        queries::update_session_status(&conn, session_id, "complete")
            .map_err(|e| e.to_string())?;
    }

    // Clear active session from state.json
    clear_state_json().map_err(|e| e.to_string())?;

    capture.session_id = None;
    Ok(())
}

async fn poll_for_new_requests(
    app_handle: AppHandle,
    db: DbPool,
    session_id: String,
    mut cancel_rx: watch::Receiver<bool>,
) {
    let mut last_id: i64 = 0;

    loop {
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_millis(500)) => {
                let new_requests = {
                    let conn = match db.lock() {
                        Ok(c) => c,
                        Err(_) => continue,
                    };
                    queries::get_requests_after(&conn, &session_id, last_id)
                };

                if let Ok(requests) = new_requests {
                    for req in &requests {
                        app_handle.emit("request:captured", req).ok();
                        last_id = last_id.max(req.id);
                    }

                    // Also emit updated endpoints periodically
                    if !requests.is_empty() {
                        let endpoints = {
                            let conn = match db.lock() {
                                Ok(c) => c,
                                Err(_) => continue,
                            };
                            queries::get_endpoints(&conn, &session_id)
                        };
                        if let Ok(eps) = endpoints {
                            app_handle.emit("endpoints:updated", &eps).ok();
                        }
                    }
                }
            }
            _ = cancel_rx.changed() => {
                tracing::info!("Capture polling stopped for session {session_id}");
                break;
            }
        }
    }
}

fn state_json_path() -> std::path::PathBuf {
    dirs::home_dir()
        .expect("could not resolve home directory")
        .join("Library/Application Support/apispy/state.json")
}

fn write_state_json(active_session_id: &str) -> Result<(), std::io::Error> {
    let db_path = dirs::home_dir()
        .expect("could not resolve home directory")
        .join("Library/Application Support/apispy/apispy.db");

    let state = serde_json::json!({
        "dbPath": db_path.to_string_lossy(),
        "activeSessionId": active_session_id,
    });

    std::fs::write(state_json_path(), state.to_string())
}

fn clear_state_json() -> Result<(), std::io::Error> {
    let db_path = dirs::home_dir()
        .expect("could not resolve home directory")
        .join("Library/Application Support/apispy/apispy.db");

    let state = serde_json::json!({
        "dbPath": db_path.to_string_lossy(),
    });

    std::fs::write(state_json_path(), state.to_string())
}
