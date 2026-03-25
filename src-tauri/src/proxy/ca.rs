use std::fs;
use std::path::{Path, PathBuf};

use hudsucker::rcgen::{
    BasicConstraints, CertificateParams, DistinguishedName, DnType, IsCa, Issuer, KeyPair,
    KeyUsagePurpose,
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaStatus {
    pub exists: bool,
    pub trusted: bool,
    pub cert_path: String,
}

pub fn ca_dir() -> PathBuf {
    dirs::home_dir()
        .expect("could not resolve home directory")
        .join("Library/Application Support/apispy")
}

pub fn cert_path() -> PathBuf {
    ca_dir().join("ca.crt")
}

pub fn key_path() -> PathBuf {
    ca_dir().join("ca.key")
}

/// Generate a new CA certificate and key pair, write to disk.
pub fn generate_ca() -> Result<(String, String), Box<dyn std::error::Error>> {
    let mut params = CertificateParams::default();

    let mut dn = DistinguishedName::new();
    dn.push(DnType::CommonName, "APIspy Local CA");
    dn.push(DnType::OrganizationName, "APIspy");
    params.distinguished_name = dn;

    params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
    params.key_usages = vec![KeyUsagePurpose::KeyCertSign, KeyUsagePurpose::CrlSign];

    // 10-year validity
    let now = time::OffsetDateTime::now_utc();
    params.not_before = now;
    params.not_after = now + time::Duration::days(3650);

    let key_pair = KeyPair::generate()?;
    let cert = params.self_signed(&key_pair)?;

    let cert_pem = cert.pem();
    let key_pem = key_pair.serialize_pem();

    // Ensure directory exists
    let dir = ca_dir();
    fs::create_dir_all(&dir)?;

    // Write cert
    let cp = cert_path();
    fs::write(&cp, &cert_pem)?;

    // Write key with restricted permissions
    let kp = key_path();
    fs::write(&kp, &key_pem)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&kp, fs::Permissions::from_mode(0o600))?;
    }

    tracing::info!("Generated CA certificate at {}", cp.display());
    Ok((cert_pem, key_pem))
}

/// Ensure CA cert and key exist. Generate if missing. Return PEM strings.
pub fn ensure_ca() -> Result<(String, String), Box<dyn std::error::Error>> {
    let cp = cert_path();
    let kp = key_path();

    if cp.exists() && kp.exists() {
        let cert_pem = fs::read_to_string(&cp)?;
        let key_pem = fs::read_to_string(&kp)?;
        Ok((cert_pem, key_pem))
    } else {
        generate_ca()
    }
}

/// Build a hudsucker RcgenAuthority from the CA cert/key PEM strings.
pub fn build_authority(
    cert_pem: &str,
    key_pem: &str,
) -> Result<hudsucker::certificate_authority::RcgenAuthority, Box<dyn std::error::Error>> {
    let key_pair = KeyPair::from_pem(key_pem)?;
    let issuer = Issuer::from_ca_cert_pem(cert_pem, key_pair)?;
    let ca = hudsucker::certificate_authority::RcgenAuthority::new(
        issuer,
        1_000,
        hudsucker::rustls::crypto::aws_lc_rs::default_provider(),
    );
    Ok(ca)
}

/// Check if the CA certificate exists on disk.
pub fn ca_exists() -> bool {
    cert_path().exists() && key_path().exists()
}

/// Check if the CA certificate is trusted in the macOS System Keychain.
pub fn is_ca_trusted() -> bool {
    let output = std::process::Command::new("security")
        .args([
            "find-certificate",
            "-c",
            "APIspy Local CA",
            "/Library/Keychains/System.keychain",
        ])
        .output();

    match output {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

/// Get the current CA status.
pub fn get_ca_status() -> CaStatus {
    CaStatus {
        exists: ca_exists(),
        trusted: is_ca_trusted(),
        cert_path: cert_path().to_string_lossy().to_string(),
    }
}

/// Install the CA certificate into the macOS System Keychain.
/// This triggers an admin authentication dialog.
pub fn install_ca_cert() -> Result<(), Box<dyn std::error::Error>> {
    let cp = cert_path();
    if !cp.exists() {
        return Err("CA certificate does not exist — generate it first".into());
    }

    // Use osascript to trigger admin auth dialog on macOS Sonoma+
    let script = format!(
        "do shell script \"security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain '{}'\" with administrator privileges",
        cp.display()
    );

    let output = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output()?;

    if output.status.success() {
        tracing::info!("CA certificate installed to System Keychain");
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to install CA certificate: {stderr}").into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_ca_cert() {
        let dir = tempfile::tempdir().unwrap();
        // Override paths for testing by generating directly
        let mut params = CertificateParams::default();
        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, "Test CA");
        params.distinguished_name = dn;
        params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
        params.key_usages = vec![KeyUsagePurpose::KeyCertSign, KeyUsagePurpose::CrlSign];

        let key_pair = KeyPair::generate().unwrap();
        let cert = params.self_signed(&key_pair).unwrap();

        let cert_pem = cert.pem();
        let key_pem = key_pair.serialize_pem();

        // Write to tempdir
        let cert_file = dir.path().join("ca.crt");
        let key_file = dir.path().join("ca.key");
        fs::write(&cert_file, &cert_pem).unwrap();
        fs::write(&key_file, &key_pem).unwrap();

        // Verify PEM content
        assert!(cert_pem.contains("BEGIN CERTIFICATE"));
        assert!(key_pem.contains("BEGIN PRIVATE KEY"));

        // Verify we can build an authority from it
        let authority = build_authority(&cert_pem, &key_pem);
        assert!(
            authority.is_ok(),
            "Failed to build authority: {:?}",
            authority.err()
        );
    }

    #[test]
    fn test_pem_round_trip() {
        let key_pair = KeyPair::generate().unwrap();
        let pem = key_pair.serialize_pem();
        let loaded = KeyPair::from_pem(&pem);
        assert!(loaded.is_ok(), "PEM round-trip failed");
    }
}
