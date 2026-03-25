# API Reverse Engineer (apispy)

## Overview
A local Tauri 2 + React + TypeScript desktop app that intercepts HTTP/S traffic via two capture modes — a Chrome/Firefox browser extension and a hudsucker MITM SSL proxy — then groups requests by endpoint pattern and runs Claude Sonnet 4 inference to produce a fully annotated Postman Collection v2.1 JSON export. Entirely local-first; no captured data leaves the machine except payload fragments sent to the Anthropic API during inference.

## Tech Stack
- **Tauri**: 2.x — desktop shell + Rust backend
- **React**: 18.x — hooks-based, no class components
- **TypeScript**: 5.x — strict mode throughout
- **Rust**: stable 2024 — proxy engine, SQLite, Tauri commands
- **hudsucker**: 0.10.x — pure-Rust async MITM HTTPS proxy (pinned in Cargo.lock)
- **rcgen**: 0.13.x — per-install CA cert generation
- **sqlx**: 0.7.x — typed SQLite queries, one DB file per session
- **postman-collection (npm)**: 4.x — Postman Collection v2.1 construction + validation
- **Tailwind CSS**: 3.x — dark theme, utility classes only

## Development Conventions
- TypeScript strict mode — no `any` types, no `as unknown` casts
- kebab-case for files, PascalCase for React components, snake_case in Rust
- All Tauri commands typed in `src/lib/tauri.ts` — never call `invoke()` directly from components
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`
- Rust: `cargo test` must pass before committing any `src-tauri/` changes
- All storage operations (SQLite via Tauri commands) wrapped in try/catch with user-visible error feedback

## Current Phase
**Phase 0: Foundation**
Tauri scaffold + SQLite schema + native host binary + Chrome extension manifest registration.
See IMPLEMENTATION-ROADMAP.md for full phase details and acceptance criteria.

## Key Decisions
| Decision | Choice | Why |
|----------|--------|-----|
| MITM proxy engine | `hudsucker` Rust crate | No Python runtime dependency; pure Rust, stays in src-tauri |
| Path param detection | Regex heuristics (integers, UUIDs, hex IDs) | Covers 95% of REST APIs; configurable per session |
| Session storage | One SQLite `.db` file per session in `~/Library/Application Support/apispy/sessions/` | Isolated, portable, independently deletable |
| Claude model | `claude-sonnet-4-20250514` | Speed + quality balance for batch endpoint annotation |
| Postman output | Collection v2.1 via `postman-collection` npm SDK | Official SDK guarantees schema correctness |
| Extension scope | Chrome MV3 + Firefox MV2 only | Safari WebExtensions deferred |
| Auth headers in export | Redacted by default (`{{bearer_token}}`) | Opt-in to include raw values |

## Do NOT
- Do not add features not in the current phase of IMPLEMENTATION-ROADMAP.md
- Do not store credentials, CA private key, or auth headers in logs, `.env` files, or anywhere outside the SQLite DB and `~/Library/Application Support/apispy/`
- Do not run inference calls in `useEffect` or on render — always gate behind explicit user action (button click)
- Do not call `invoke()` directly from components — use typed wrappers in `src/lib/tauri.ts`
- Do not implement OpenAPI or markdown export — Postman Collection v2.1 is the only output format until Phase 5
- Do not parallelize Claude inference calls — sequential only to avoid rate limits
- Do not use `localStorage` or `sessionStorage` — all persistence goes through Tauri commands to SQLite
