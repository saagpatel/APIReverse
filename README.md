# APIReverse

[![Rust](https://img.shields.io/badge/Rust-%23dea584?style=flat-square&logo=rust)](#) [![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript)](#) [![Status](https://img.shields.io/badge/status-WIP-yellow?style=flat-square)](#)

> Intercept HTTP/S traffic, group endpoints by pattern, and export an AI-annotated Postman Collection — all locally.

APIReverse captures live API traffic through a Chrome/Firefox browser extension or a built-in MITM HTTPS proxy, then deduplicates endpoint patterns (collapsing `/users/123` and `/users/456` into `/users/:id`). Claude Sonnet annotates each endpoint with descriptions, parameter types, and auth requirements. Everything is exported as a valid Postman Collection v2.1 JSON file. Nothing persists outside `~/Library/Application Support/apispy/`.

## Features

- **Two capture modes** — Browser extension (Chrome MV3 / Firefox MV2) or built-in MITM HTTPS proxy
- **Pattern deduplication** — Collapses parameterized paths into single endpoint entries
- **AI annotation** — Claude infers descriptions, parameter types, and auth requirements per endpoint
- **Postman export** — Valid Collection v2.1 JSON, ready to import
- **Session isolation** — Each session is a separate SQLite database; nothing shared between captures

## Quick Start

```bash
git clone https://github.com/saagpatel/APIReverse.git
cd APIReverse
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm run tauri dev
```

On first launch, the onboarding modal walks you through CA certificate installation for HTTPS interception. Load the unpacked extension from `extension/chrome/` or `extension/firefox/`.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Tauri 2 |
| Proxy engine | Rust + hudsucker (MITM HTTPS) |
| Frontend | React 18, TypeScript 5, Tailwind CSS 4 |
| Storage | SQLite via rusqlite (one DB per session) |
| AI inference | Claude via `@anthropic-ai/sdk` |
| Export | Postman Collection v2.1 |

> **Status: Work in Progress** — Capture, deduplication, and Postman export functional. AI annotation integration in progress.

## License

MIT