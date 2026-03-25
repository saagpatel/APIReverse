mod commands;
mod db;
mod models;
mod proxy;

use std::sync::{Arc, Mutex};
use tauri::Manager;

pub type DbPool = Arc<Mutex<rusqlite::Connection>>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter("apispy=info")
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::session::create_session,
            commands::session::list_sessions,
        ])
        .setup(|app| {
            let data_dir = dirs::home_dir()
                .expect("could not resolve home directory")
                .join("Library/Application Support/apispy");
            std::fs::create_dir_all(&data_dir)?;

            let db_path = data_dir.join("apispy.db");
            tracing::info!("Opening database at {}", db_path.display());
            let conn =
                db::init_db(&db_path).map_err(|e| format!("Failed to init database: {e}"))?;

            // Write state.json for native host to discover DB path
            let state = serde_json::json!({
                "dbPath": db_path.to_string_lossy()
            });
            let state_path = data_dir.join("state.json");
            std::fs::write(&state_path, state.to_string())?;
            tracing::info!("Wrote state.json to {}", state_path.display());

            app.manage(Arc::new(Mutex::new(conn)) as DbPool);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
