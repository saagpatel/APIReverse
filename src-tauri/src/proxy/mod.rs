pub mod ca;
pub mod filter;
pub mod mitm;
pub mod normalizer;

use std::net::SocketAddr;

use hudsucker::Proxy;
use tokio::sync::oneshot;

use crate::models::FilterConfig;
use crate::DbPool;

pub struct ProxyServer {
    pub port: u16,
    shutdown_tx: Option<oneshot::Sender<()>>,
}

impl ProxyServer {
    pub async fn start(
        db: DbPool,
        session_id: String,
        filter_config: FilterConfig,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // Ensure CA cert exists
        let (cert_pem, key_pem) = ca::ensure_ca()
            .map_err(|e| format!("CA cert error: {e}"))?;

        let authority = ca::build_authority(&cert_pem, &key_pem)
            .map_err(|e| format!("Failed to build CA authority: {e}"))?;

        let handler = mitm::ApiSpyHandler::new(db, session_id, filter_config);

        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

        // Try port 8877, fall back to OS-assigned
        let addr = SocketAddr::from(([127, 0, 0, 1], 8877));

        let proxy = Proxy::builder()
            .with_addr(addr)
            .with_ca(authority)
            .with_rustls_connector(hudsucker::rustls::crypto::aws_lc_rs::default_provider())
            .with_http_handler(handler)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .build()
            .map_err(|e| format!("Failed to build proxy: {e}"))?;

        let port = 8877; // hudsucker binds to the specified addr

        tokio::spawn(async move {
            if let Err(e) = proxy.start().await {
                tracing::error!("Proxy error: {e}");
            }
        });

        tracing::info!("MITM proxy started on 127.0.0.1:{port}");

        Ok(Self {
            port,
            shutdown_tx: Some(shutdown_tx),
        })
    }

    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
            tracing::info!("MITM proxy stopped");
        }
    }

    pub fn is_running(&self) -> bool {
        self.shutdown_tx.is_some()
    }
}
