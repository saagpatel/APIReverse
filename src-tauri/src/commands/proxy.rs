use tauri::State;

use crate::commands::capture::ActiveCapture;
use crate::models::{FilterConfig, ProxyStatus};
use crate::proxy;
use crate::proxy::ca::{self, CaStatus};
use crate::DbPool;

#[tauri::command]
pub async fn start_proxy(
    db: State<'_, DbPool>,
    active: State<'_, ActiveCapture>,
    session_id: String,
) -> Result<ProxyStatus, String> {
    // Stop existing proxy if running
    {
        let mut capture = active.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut p) = capture.proxy {
            p.stop();
        }
    }

    // Get session filter config
    let filter_config = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let session =
            crate::db::queries::get_session(&conn, &session_id).map_err(|e| e.to_string())?;
        session
            .filter_config
            .as_ref()
            .and_then(|s| serde_json::from_str::<FilterConfig>(s).ok())
            .unwrap_or_default()
    };

    let db_clone = (*db).clone();
    let server = proxy::ProxyServer::start(db_clone, session_id, filter_config)
        .await
        .map_err(|e| e.to_string())?;

    let port = server.port;
    let ca_installed = ca::is_ca_trusted();

    {
        let mut capture = active.lock().map_err(|e| e.to_string())?;
        capture.proxy = Some(server);
    }

    Ok(ProxyStatus {
        running: true,
        port,
        ca_installed,
        ca_path: ca::cert_path().to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn stop_proxy(active: State<'_, ActiveCapture>) -> Result<(), String> {
    let mut capture = active.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut p) = capture.proxy {
        p.stop();
    }
    capture.proxy = None;
    Ok(())
}

#[tauri::command]
pub fn get_proxy_status(active: State<'_, ActiveCapture>) -> Result<ProxyStatus, String> {
    let capture = active.lock().map_err(|e| e.to_string())?;
    let running = capture.proxy.as_ref().map_or(false, |p| p.is_running());
    let port = capture.proxy.as_ref().map_or(8877, |p| p.port);

    Ok(ProxyStatus {
        running,
        port,
        ca_installed: ca::is_ca_trusted(),
        ca_path: ca::cert_path().to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn get_ca_status() -> Result<CaStatus, String> {
    Ok(ca::get_ca_status())
}

#[tauri::command]
pub fn install_ca() -> Result<(), String> {
    ca::install_ca_cert().map_err(|e| e.to_string())
}
