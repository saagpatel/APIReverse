use crate::models::FilterConfig;

const DEFAULT_DENYLIST: &[&str] = &[
    "google-analytics.com",
    "googletagmanager.com",
    "doubleclick.net",
    "facebook.net",
    "hotjar.com",
    "segment.io",
    "mixpanel.com",
    "amplitude.com",
    "clarity.ms",
    "sentry.io",
];

const NOISE_EXTENSIONS: &[&str] = &[
    ".js", ".css", ".woff", ".woff2", ".ttf", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".map", ".br",
];

const PRESET_ANALYTICS: &[&str] = &[
    "google-analytics.com",
    "googletagmanager.com",
    "amplitude.com",
    "mixpanel.com",
    "segment.io",
    "segment.com",
    "hotjar.com",
    "clarity.ms",
    "plausible.io",
];

const PRESET_CDN: &[&str] = &[
    "cdn.jsdelivr.net",
    "cdnjs.cloudflare.com",
    "unpkg.com",
    "ajax.googleapis.com",
];

const PRESET_SOCIAL: &[&str] = &[
    "facebook.net",
    "connect.facebook.net",
    "platform.twitter.com",
    "apis.google.com",
];

const PRESET_FONTS: &[&str] = &[
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "use.typekit.net",
];

fn domain_matches(host: &str, pattern: &str) -> bool {
    let host = host.to_ascii_lowercase();
    let pattern = pattern.to_ascii_lowercase();
    host == pattern || host.ends_with(&format!(".{pattern}"))
}

fn has_noise_extension(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    // Strip query string first
    let path_only = lower.split('?').next().unwrap_or(&lower);
    NOISE_EXTENSIONS.iter().any(|ext| path_only.ends_with(ext))
}

fn preset_domains(preset: &str) -> &'static [&'static str] {
    match preset {
        "analytics" => PRESET_ANALYTICS,
        "cdn" => PRESET_CDN,
        "social" => PRESET_SOCIAL,
        "fonts" => PRESET_FONTS,
        _ => &[],
    }
}

/// Returns `true` if the request should be marked as noise.
pub fn is_noise(host: &str, path: &str, config: &FilterConfig) -> bool {
    // If allowlist is non-empty, only those domains pass through — everything else is noise
    if !config.allowlist.is_empty() {
        let allowed = config.allowlist.iter().any(|a| domain_matches(host, a));
        if !allowed {
            return true;
        }
    }

    // Check user denylist
    if config.denylist.iter().any(|d| domain_matches(host, d)) {
        return true;
    }

    // Check default denylist
    if DEFAULT_DENYLIST.iter().any(|d| domain_matches(host, d)) {
        return true;
    }

    // Check preset domains
    for preset in &config.noise_presets {
        let domains = preset_domains(preset);
        if domains.iter().any(|d| domain_matches(host, d)) {
            return true;
        }
    }

    // Check static asset extensions
    if has_noise_extension(path) {
        return true;
    }

    false
}

/// Returns a reason string if the request is noise, `None` otherwise.
pub fn detect_noise_reason(host: &str, path: &str, config: &FilterConfig) -> Option<&'static str> {
    if !config.allowlist.is_empty() {
        let allowed = config.allowlist.iter().any(|a| domain_matches(host, a));
        if !allowed {
            return Some("not in allowlist");
        }
    }

    if config.denylist.iter().any(|d| domain_matches(host, d)) {
        return Some("user denylist");
    }

    if DEFAULT_DENYLIST.iter().any(|d| domain_matches(host, d)) {
        return Some("default denylist");
    }

    for preset in &config.noise_presets {
        let domains = preset_domains(preset);
        if domains.iter().any(|d| domain_matches(host, d)) {
            return Some("noise preset");
        }
    }

    if has_noise_extension(path) {
        return Some("static asset");
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_config() -> FilterConfig {
        FilterConfig::default()
    }

    #[test]
    fn test_default_denylist() {
        let config = default_config();
        assert!(is_noise("google-analytics.com", "/collect", &config));
        assert!(is_noise("www.google-analytics.com", "/collect", &config));
        assert!(is_noise("sentry.io", "/api/store", &config));
    }

    #[test]
    fn test_clean_api_request() {
        let config = default_config();
        assert!(!is_noise("api.example.com", "/v1/users", &config));
        assert!(!is_noise(
            "jsonplaceholder.typicode.com",
            "/posts/1",
            &config
        ));
    }

    #[test]
    fn test_static_asset_extension() {
        let config = default_config();
        assert!(is_noise("api.example.com", "/bundle.js", &config));
        assert!(is_noise("cdn.example.com", "/styles.css", &config));
        assert!(is_noise("api.example.com", "/logo.png", &config));
        assert!(is_noise("api.example.com", "/font.woff2", &config));
    }

    #[test]
    fn test_extension_with_query_string() {
        let config = default_config();
        assert!(is_noise("cdn.example.com", "/app.js?v=123", &config));
    }

    #[test]
    fn test_user_denylist() {
        let config = FilterConfig {
            denylist: vec!["internal-tracking.mycompany.com".to_string()],
            ..Default::default()
        };
        assert!(is_noise(
            "internal-tracking.mycompany.com",
            "/event",
            &config
        ));
    }

    #[test]
    fn test_allowlist_overrides() {
        let config = FilterConfig {
            allowlist: vec!["api.example.com".to_string()],
            ..Default::default()
        };
        // Allowed domain passes
        assert!(!is_noise("api.example.com", "/v1/users", &config));
        // Non-allowed domain is noise
        assert!(is_noise("other-api.com", "/v1/data", &config));
        // Note: static assets on allowed domain still pass (allowlist takes precedence for domain)
    }

    #[test]
    fn test_noise_presets() {
        let config = FilterConfig {
            noise_presets: vec!["cdn".to_string(), "fonts".to_string()],
            ..Default::default()
        };
        assert!(is_noise("cdn.jsdelivr.net", "/npm/react", &config));
        assert!(is_noise("fonts.googleapis.com", "/css2", &config));
        assert!(!is_noise("api.example.com", "/data", &config));
    }

    #[test]
    fn test_case_insensitivity() {
        let config = default_config();
        assert!(is_noise("Google-Analytics.COM", "/collect", &config));
        assert!(is_noise("api.example.com", "/bundle.JS", &config));
    }

    #[test]
    fn test_subdomain_matching() {
        let config = default_config();
        assert!(is_noise(
            "tracker.google-analytics.com",
            "/collect",
            &config
        ));
        assert!(is_noise("sub.hotjar.com", "/api", &config));
    }

    #[test]
    fn test_detect_noise_reason() {
        let config = default_config();
        assert_eq!(
            detect_noise_reason("google-analytics.com", "/collect", &config),
            Some("default denylist")
        );
        assert_eq!(
            detect_noise_reason("api.example.com", "/bundle.js", &config),
            Some("static asset")
        );
        assert_eq!(
            detect_noise_reason("api.example.com", "/v1/users", &config),
            None
        );
    }
}
