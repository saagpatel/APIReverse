# APIReverse (apispy)

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/saagpatel/APIReverse)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-orange)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-stable-orange)](https://www.rust-lang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

A local-first desktop app that intercepts HTTP/S traffic, groups requests by endpoint pattern, and uses Claude to produce a fully annotated Postman Collection export — all without sending captured data off your machine (except payload fragments during AI inference).

## What it does

APIReverse captures live API traffic through two modes — a Chrome/Firefox browser extension or a built-in MITM HTTPS proxy — then organizes requests by deduplicated endpoint patterns (collapsing `/users/123` and `/users/456` into `/users/:id`). From there, Claude Sonnet annotates each endpoint with inferred descriptions, parameter types, and auth requirements, and exports the result as a valid Postman Collection v2.1 JSON file.

Sessions are isolated SQLite databases stored locally in `~/Library/Application Support/apispy/sessions/`. Nothing persists outside that directory.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 |
| Frontend | React 18, TypeScript 5, Tailwind CSS 4 |
| Proxy engine | Rust + [hudsucker](https://github.com/omjadas/hudsucker) (MITM HTTPS) |
| CA cert generation | rcgen 0.13 |
| Storage | SQLite via rusqlite (one DB per session) |
| AI inference | Claude via `@anthropic-ai/sdk` (sequential, user-triggered) |
| Export | Postman Collection v2.1 via `postman-collection` npm SDK |
| Browser extension | Chrome MV3, Firefox MV2 |

## Prerequisites

- [Rust](https://rustup.rs) (stable toolchain)
- [Node.js](https://nodejs.org) 18+ and npm
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)
- An [Anthropic API key](https://console.anthropic.com) (required for AI inference)

## Getting Started

```bash
# Install frontend dependencies
npm install

# Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run in development mode
npm run tauri dev

# Build a production app bundle
npm run tauri build
```

### Browser Extension Setup

On first launch, apispy walks you through installing the local CA certificate so HTTPS interception works. Follow the onboarding modal, then load the unpacked extension from `extension/chrome/` (Chrome) or `extension/firefox/` (Firefox) via your browser's extension developer settings.

## Project Structure

```
APIReverse/
├── src/                     # React frontend
│   ├── components/          # UI components (CaptureBar, RequestList, EndpointMap, …)
│   ├── hooks/               # useCapture, useSession, useInference
│   ├── lib/                 # Typed Tauri command wrappers (invoke abstraction)
│   └── types/               # Shared TypeScript types
├── src-tauri/               # Rust backend
│   ├── src/                 # Tauri commands, proxy engine, SQLite layer
│   ├── native-host/         # Browser native messaging host binary
│   ├── capabilities/        # Tauri permission definitions
│   └── Cargo.toml
├── extension/
│   ├── chrome/              # Chrome MV3 extension
│   └── firefox/             # Firefox MV2 extension
└── scripts/
    └── setup-native-host.sh # Registers native messaging host with the browser
```

## Workflow

1. **Create a session** — name it and start capturing
2. **Capture tab** — live request list on the left, deduplicated endpoint map on the right
3. **Analysis tab** — run Claude inference to annotate endpoints (sequential, one click)
4. **Export tab** — preview and download the Postman Collection v2.1 JSON

Auth headers in exports are redacted by default (`{{bearer_token}}`); raw values are opt-in.

## Screenshot

> _Screenshot placeholder — add `docs/screenshot.png` and update this line._

## License

MIT — see [LICENSE](LICENSE).
