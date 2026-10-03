# APIReverse

[![Rust](https://img.shields.io/badge/Rust-%23dea584?style=flat-square&logo=rust)](#) [![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript)](#) [![Status](https://img.shields.io/badge/status-v1.0.0-green?style=flat-square)](#)

> Intercept HTTP/S traffic, group endpoints by pattern, and export an AI-annotated Postman Collection — capture locally, annotate via the Anthropic API.

APIReverse captures live API traffic through a Chrome/Firefox browser extension or a built-in MITM HTTPS proxy, then deduplicates endpoint patterns (collapsing `/users/123` and `/users/456` into `/users/{id}`). Claude Sonnet annotates each endpoint with descriptions, parameter types, and auth requirements. Everything is exported as a valid Postman Collection v2.1 JSON file. App data is stored in `~/Library/Application Support/apispy/`; exports are saved to a user-selected path, and CA installation adds the certificate to the macOS System Keychain.

## Features

- **Two capture modes** — Browser extension (Chrome MV3 / Firefox MV2) or built-in MITM HTTPS proxy
- **Pattern deduplication** — Collapses parameterized paths into single endpoint entries
- **AI annotation** — Claude infers descriptions, parameter types, and auth requirements per endpoint
- **Postman export** — Valid Collection v2.1 JSON, ready to import
- **Session isolation** — Sessions are rows in a single SQLite database, with requests scoped by session ID and shared app settings

## Quick Start

```bash
git clone https://github.com/saagpatel/APIReverse.git
cd APIReverse
npm install
npm run tauri dev
```

For build prerequisites and local tests that do not launch capture or inference,
see [Local verification](CONTRIBUTING.md#local-verification).

On first launch, the onboarding modal walks you through CA certificate installation for HTTPS interception. Load the unpacked extension from `extension/chrome/` or `extension/firefox/`.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Tauri 2 |
| Proxy engine | Rust + hudsucker (MITM HTTPS) |
| Frontend | React 19, TypeScript 7, Tailwind CSS 4 |
| Storage | SQLite via rusqlite (one shared DB, sessions as rows) |
| AI inference | Claude Sonnet via `@anthropic-ai/sdk` |
| Export | Postman Collection v2.1 |

Set your Anthropic API key in the app's **Analysis** panel — stored locally in SQLite, never in environment variables.

## License

MIT
