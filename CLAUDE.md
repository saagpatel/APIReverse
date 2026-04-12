# API Reverse Engineer (apispy)

A local Tauri 2 + React desktop app that intercepts HTTP/S traffic via two capture modes — a Chrome/Firefox browser extension and a hudsucker MITM SSL proxy — then groups requests by endpoint pattern and runs Claude Sonnet inference to produce a fully annotated Postman Collection v2.1 JSON export. Entirely local-first; no captured data leaves the machine except payload fragments sent to the Anthropic API during inference.

## Tech Stack
- **Tauri**: 2.x — desktop shell + Rust backend
- **React**: 18.x — hooks-based, no class components
- **TypeScript**: 5.x — strict mode throughout
- **Rust**: stable 2024 — proxy engine, SQLite, Tauri commands
- **hudsucker**: 0.10.x — pure-Rust async MITM HTTPS proxy
- **rcgen**: 0.13.x — per-install CA cert generation
- **sqlx**: 0.7.x — typed SQLite queries, one DB file per session
- **postman-collection (npm)**: 4.x — Postman Collection v2.1 construction + validation
- **Tailwind CSS**: 3.x — dark theme, utility classes only

## Status
Phases 0-4 complete — all planned functionality shipped:
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

Requires Anthropic API key set in the app's settings panel (stored in SQLite, never in env files).

## Architecture
- `src-tauri/src/` — Rust: MITM proxy (hudsucker), SQLite session storage, CA cert generation, Tauri commands
- `src/lib/tauri.ts` — all typed Tauri command wrappers (never call `invoke()` directly from components)
- `src/components/` — React UI: request list, session manager, inference panel, export controls
- One SQLite `.db` file per session in `~/Library/Application Support/apispy/sessions/`
- Chrome MV3 + Firefox MV2 extensions in `extension/` directory
- Claude inference runs sequentially (not parallelized) to avoid rate limits

## Known Issues
- Safari WebExtensions not supported (deferred from original scope)
- OpenAPI and Markdown export formats not implemented — Postman Collection v2.1 only
- Body capture for large binary payloads may be truncated
