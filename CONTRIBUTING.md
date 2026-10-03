# Contributing

This project is in early development. Contributions are welcome!

## Getting Started

See the README for current status and setup instructions.

## Local verification

Run these commands from the repository root. Use Node 22 (at least 22.12),
npm, stable Rust with rustfmt and Clippy, and the native build dependencies
for Tauri on your platform (Xcode Command Line Tools on macOS). The Rust
workspace manifest is `src-tauri/Cargo.toml`; there is no root Cargo manifest.

```bash
npm ci
npm run build             # TypeScript check and frontend production bundle

# Focused example: pure endpoint-normalization unit tests
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib proxy::normalizer::tests

# Broader native verification, including the native-host workspace member
make check
make test
make lint
make fmt-check            # Checks formatting without rewriting source
```

Choose the focused test filter for the Rust behavior you changed. Existing
native tests use in-memory databases or temporary directories; there is no
frontend test runner, ESLint, or frontend formatter script configured. The
frontend build does not launch Tauri or make an inference request. It updates
the tracked `tsconfig.tsbuildinfo`; keep that generated change out of a docs PR.
Native checks require platform libraries even when only a unit-test filter runs.

For UI changes, also launch `npm run tauri dev` in a disposable local session
and check the changed view with synthetic requests. `npm run dev` alone serves
the frontend and cannot verify Tauri IPC. Launching the desktop app can create
local app data. CA installation, live traffic capture, and Anthropic inference
are separate opt-in checks; they are not prerequisites for the commands above.
An API key is needed only for inference. Do not run `make run`, `make clean`,
or `npm run tauri build` as a verification shortcut: they launch the app,
remove build outputs, or package the desktop app respectively.

## How to Contribute

- **Bug reports**: Open a [GitHub Issue](../../issues/new)
- **Feature ideas**: Open an issue to discuss before implementing
- **Pull requests**: Fork, branch, and submit — keep changes focused

## Questions?

Open an issue on GitHub.
