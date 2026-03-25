#!/bin/bash
# Registers the apispy-native-host binary with Chrome's Native Messaging system.
# Run this after building: cargo build -p apispy-native-host

set -euo pipefail

BINARY_PATH="$(cd "$(dirname "$0")/.." && pwd)/src-tauri/target/debug/apispy-native-host"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_PATH="$MANIFEST_DIR/com.apispy.host.json"

if [ ! -f "$BINARY_PATH" ]; then
  echo "Error: native host binary not found at $BINARY_PATH"
  echo "Run: cargo build -p apispy-native-host"
  exit 1
fi

mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_PATH" <<EOF
{
  "name": "com.apispy.host",
  "description": "APIspy native messaging host for capturing HTTP traffic",
  "path": "$BINARY_PATH",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://*/"]
}
EOF

echo "Native host manifest written to: $MANIFEST_PATH"
echo "Binary path: $BINARY_PATH"
echo ""
echo "Note: For production, update allowed_origins to your specific extension ID."
