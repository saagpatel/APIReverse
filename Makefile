.PHONY: build test lint fmt-check clean check run

CARGO_MANIFEST := src-tauri/Cargo.toml

build:
	cargo build --manifest-path $(CARGO_MANIFEST) --locked --workspace --release

check:
	cargo check --manifest-path $(CARGO_MANIFEST) --locked --workspace

test:
	cargo test --manifest-path $(CARGO_MANIFEST) --locked --workspace

lint:
	cargo clippy --manifest-path $(CARGO_MANIFEST) --locked --workspace --all-targets -- -D warnings

fmt-check:
	cargo fmt --manifest-path $(CARGO_MANIFEST) --all -- --check

run:
	cargo run --manifest-path $(CARGO_MANIFEST) --locked -p apispy

clean:
	cargo clean --manifest-path $(CARGO_MANIFEST)
