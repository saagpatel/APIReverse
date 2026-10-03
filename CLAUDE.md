# API Reverse Engineer (apispy)

A local Tauri 2 + React desktop app that intercepts HTTP/S traffic via two capture modes — a Chrome/Firefox browser extension and a hudsucker MITM SSL proxy — then groups requests by endpoint pattern and runs Claude Sonnet inference to produce an annotated Postman Collection v2.1 JSON export. Entirely local-first; inference sends endpoint metadata, sampled headers with selected auth headers stripped, and truncated body samples to the Anthropic API.

## Tech Stack
- **Tauri**: 2.x — desktop shell + Rust backend
- **React**: 19.x — hooks-based, no class components
- **TypeScript**: 7.x — strict mode throughout
- **Rust**: edition 2021 — proxy engine, SQLite, Tauri commands
- **hudsucker**: 0.24.x — pure-Rust async MITM HTTPS proxy
- **rcgen**: 0.14.x via hudsucker — per-install CA cert generation (direct dependency remains 0.13.x)
- **rusqlite**: 0.31.x — SQLite via bundled feature; sessions are rows in a single `apispy.db`
- **Tailwind CSS**: 4.x — dark theme, utility classes with custom CSS and inline styles

## Status
Core functionality from phases 0-4 is implemented:
- Phase 0: Tauri scaffold, SQLite schema, native host binary, Chrome extension manifest
- Phase 1: Browser extension capture, live request view, noise filtering
- Phase 2: MITM proxy engine, CA management, Firefox extension support
- Phase 3: Claude inference pipeline, Postman Collection export
- Phase 4: Session management, filter config, body capture, onboarding flow

## Build & Run
```bash
# Install dependencies
npm install

# Development
npm run tauri dev

# Production build
npm run tauri build
```

See [Local verification](CONTRIBUTING.md#local-verification) for prerequisites,
frontend checks, and focused/native tests. An Anthropic API key is needed only
for inference, set in the app's Analysis panel (stored in SQLite, never in env files).

## Architecture
- `src-tauri/src/` — Rust: MITM proxy (hudsucker), SQLite session storage, CA cert generation, Tauri commands
- `src/lib/tauri.ts` — all typed Tauri command wrappers (never call `invoke()` directly from components)
- `src/components/` — React UI: request list, session manager, inference panel, export controls
- Single SQLite database at `~/Library/Application Support/apispy/apispy.db`; each session is a row in the `sessions` table
- Chrome MV3 + Firefox MV2 extensions in `extension/` directory
- Claude inference runs sequentially (not parallelized) to avoid rate limits

## Known Issues
- Safari WebExtensions not supported (deferred from original scope)
- OpenAPI and Markdown export formats not implemented — Postman Collection v2.1 only
- Large text bodies are truncated; MITM capture stores response bodies only for text-like content types, and drops request bodies that are not valid UTF-8

<!-- portfolio-context:start -->
# Portfolio Context

## What This Project Is

APIReverse is an active local project in the ~/Projects portfolio.

## Current State

Core functionality from phases 0-4 is implemented:
- Phase 0: Tauri scaffold, SQLite schema, native host binary, Chrome extension manifest
- Phase 1: Browser extension capture, live request view, noise filtering
- Phase 2: MITM proxy engine, CA management, Firefox extension support
- Phase 3: Claude inference pipeline, Postman Collection export
- Phase 4: Session management, filter config, body capture, onboarding flow

## Stack

- **Tauri**: 2.x — desktop shell + Rust backend
- **React**: 19.x — hooks-based, no class components
- **TypeScript**: 7.x — strict mode throughout
- **Rust**: edition 2021 — proxy engine, SQLite, Tauri commands
- **hudsucker**: 0.24.x — pure-Rust async MITM HTTPS proxy
- **rcgen**: 0.14.x via hudsucker — per-install CA cert generation (direct dependency remains 0.13.x)
- **rusqlite**: 0.31.x — SQLite via bundled feature; sessions are rows in a single `apispy.db`
- **Tailwind CSS**: 4.x — dark theme, utility classes with custom CSS and inline styles

## How To Run

```bash
# Install dependencies
npm install

# Development
npm run tauri dev

# Production build
npm run tauri build
```

See [Local verification](CONTRIBUTING.md#local-verification) for prerequisites,
frontend checks, and focused/native tests. An Anthropic API key is needed only
for inference, set in the app's Analysis panel (stored in SQLite, never in env files).

## Known Risks

- Safari WebExtensions not supported (deferred from original scope)
- OpenAPI and Markdown export formats not implemented — Postman Collection v2.1 only
- Large text bodies are truncated; MITM capture stores response bodies only for text-like content types, and drops request bodies that are not valid UTF-8

## Next Recommended Move

Use this context plus the README and supporting docs to resume the next active task, then promote the repo beyond minimum-viable by capturing a dedicated handoff, roadmap, or discovery artifact.

<!-- portfolio-context:end -->
