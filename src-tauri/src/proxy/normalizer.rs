use regex::Regex;
use std::sync::LazyLock;

static RE_INTEGER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d+$").unwrap());
static RE_UUID: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$").unwrap()
});
static RE_HEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[a-f0-9]{8,}$").unwrap());
static RE_VERSION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^v\d+$").unwrap());

/// Returns true if a path segment looks like a dynamic ID and should be replaced with `{id}`.
fn is_dynamic_segment(segment: &str) -> bool {
    if segment.is_empty() {
        return false;
    }

    // Preserve version segments like v1, v2, v10
    if RE_VERSION.is_match(segment) {
        return false;
    }

    let lower = segment.to_ascii_lowercase();

    // Pure integer
    if RE_INTEGER.is_match(&lower) {
        return true;
    }

    // UUID
    if RE_UUID.is_match(&lower) {
        return true;
    }

    // Hex string >= 8 chars (checked after UUID to avoid double-match)
    if RE_HEX.is_match(&lower) {
        return true;
    }

    // Mixed alphanumeric >= 10 chars with at least one letter and one digit
    if segment.len() >= 10
        && segment.chars().all(|c| c.is_ascii_alphanumeric())
        && segment.chars().any(|c| c.is_ascii_alphabetic())
        && segment.chars().any(|c| c.is_ascii_digit())
    {
        return true;
    }

    false
}

/// Normalizes a URL path by replacing dynamic segments (IDs, UUIDs, hex strings) with `{id}`.
///
/// Preserves version segments like `/v1/`, `/v2/`.
/// Strips query strings before normalizing.
pub fn normalize_path(path: &str) -> String {
    // Strip query string if present
    let path = path.split('?').next().unwrap_or(path);

    // Handle root path
    if path.is_empty() || path == "/" {
        return "/".to_string();
    }

    let segments: Vec<&str> = path.split('/').collect();
    let normalized: Vec<String> = segments
        .iter()
        .map(|s| {
            if is_dynamic_segment(s) {
                "{id}".to_string()
            } else {
                s.to_string()
            }
        })
        .collect();

    let result = normalized.join("/");
    if result.is_empty() {
        "/".to_string()
    } else {
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_integer_ids() {
        assert_eq!(normalize_path("/users/123"), "/users/{id}");
        assert_eq!(normalize_path("/users/0"), "/users/{id}");
        assert_eq!(normalize_path("/posts/999999"), "/posts/{id}");
    }

    #[test]
    fn test_uuid_ids() {
        assert_eq!(
            normalize_path("/items/a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
            "/items/{id}"
        );
        assert_eq!(
            normalize_path("/users/550e8400-e29b-41d4-a716-446655440000"),
            "/users/{id}"
        );
    }

    #[test]
    fn test_multiple_dynamic_segments() {
        assert_eq!(
            normalize_path("/api/v2/posts/456/comments/789"),
            "/api/v2/posts/{id}/comments/{id}"
        );
    }

    #[test]
    fn test_version_segments_preserved() {
        assert_eq!(normalize_path("/api/v1"), "/api/v1");
        assert_eq!(normalize_path("/api/v2/users"), "/api/v2/users");
        assert_eq!(normalize_path("/v10/data"), "/v10/data");
    }

    #[test]
    fn test_hex_strings() {
        // >= 8 hex chars → replaced
        assert_eq!(normalize_path("/commits/abcdef01"), "/commits/{id}");
        assert_eq!(normalize_path("/objects/deadbeefcafebabe"), "/objects/{id}");

        // < 8 hex chars → preserved
        assert_eq!(normalize_path("/api/abc"), "/api/abc");
        assert_eq!(normalize_path("/api/abcdef0"), "/api/abcdef0");
    }

    #[test]
    fn test_mixed_alphanumeric() {
        // >= 10 chars, mixed letters + digits → replaced
        assert_eq!(normalize_path("/tokens/abc123def456"), "/tokens/{id}");
        assert_eq!(normalize_path("/keys/A1b2C3d4E5f6"), "/keys/{id}");

        // < 10 chars → preserved
        assert_eq!(normalize_path("/api/abc12"), "/api/abc12");

        // All letters, no digits → preserved
        assert_eq!(normalize_path("/api/abcdefghij"), "/api/abcdefghij");
    }

    #[test]
    fn test_edge_cases() {
        assert_eq!(normalize_path("/"), "/");
        assert_eq!(normalize_path(""), "/");
        assert_eq!(normalize_path("/api"), "/api");
        assert_eq!(normalize_path("/api/"), "/api/");
    }

    #[test]
    fn test_query_string_stripped() {
        assert_eq!(normalize_path("/users/123?page=1&limit=10"), "/users/{id}");
    }

    #[test]
    fn test_static_segments_preserved() {
        assert_eq!(
            normalize_path("/api/v1/users/search"),
            "/api/v1/users/search"
        );
        assert_eq!(normalize_path("/health/ready"), "/health/ready");
    }

    #[test]
    fn test_case_insensitive_hex_and_uuid() {
        assert_eq!(
            normalize_path("/items/A1B2C3D4-E5F6-7890-ABCD-EF1234567890"),
            "/items/{id}"
        );
        assert_eq!(normalize_path("/commits/ABCDEF01"), "/commits/{id}");
    }
}
