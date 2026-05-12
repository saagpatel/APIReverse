# APIReverse — Portfolio Disposition

**Status:** Release Frozen — Tauri 2 + Rust + React 18 MITM HTTPS
proxy + AI-annotated Postman Collection exporter at **v1.0.0** on
`origin/main`, with .dmg distribution build dependencies, full Tauri
icon set, CSP hardened Tauri webview, baseline Rust tests for proxy
normalizer / filter / DB queries, Anthropic SDK integration migrated
to the current model ID, and **a Chrome MV3 / Firefox MV2 browser
extension on canonical main as a secondary capture surface** that
co-exists with the built-in MITM proxy. Joins the signing cluster as
the **23rd member** — and is the first portfolio member to
demonstrate a **hybrid distribution shape** (primary: Tauri DMG;
secondary: browser extension as alternate capture mode).

> Disposition uses strict `origin/main` verification.
> **First hybrid signing+extension shape** — extension is a
> capture-mode sub-shape, not a separate cluster slot.

---

## Verification posture

This repo has **only `origin`** (`saagpatel/APIReverse`) — no
`legacy-origin` remote. Clean migration state. Local clone's `main`
is tracking `origin/main` correctly.

Specifically verified on `origin/main`:

- Tip: `d4c8c70` chore: migrate to current Anthropic model ID (#12)
- **v1.0.0 release cadence**:
  - `aa5c068` chore: bump version to 1.0.0
  - `a253deb` chore: update Cargo.lock for version 1.0.0
  - `995bb8a` chore: update build dependencies for .dmg distribution
  - `ae15099` chore: regenerate full Tauri icon set
  - `838df63` test: add baseline Rust tests for proxy normalizer,
    filter, and db queries
  - `a4328ff` fix(security): add Content Security Policy to Tauri
    webview
  - `d4c8c70` chore: migrate to current Anthropic model ID (#12)
- **Repo tree on canonical main**:
  - `src-tauri/` (Rust Tauri 2 backend + hudsucker proxy engine)
  - `src/` (React 18 + TypeScript frontend)
  - `extension/` (Chrome MV3 / Firefox MV2 browser extension —
    alternate capture mode)
  - `package.json`, `vite.config.ts`, `tsconfig.json`
  - `CLAUDE.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
    `IMPLEMENTATION-ROADMAP.md`, `LICENSE`, `Makefile`, `SECURITY.md`,
    `CHANGELOG.md`
  - `.env.example`
- Default branch: `main`

---

## Current state in one paragraph

APIReverse intercepts live HTTP/S API traffic via either a built-in
MITM HTTPS proxy (Rust + **hudsucker**) **or** a browser extension
(Chrome MV3 / Firefox MV2). The capture pipeline groups endpoints by
pattern (collapsing `/users/123` and `/users/456` into
`/users/:id`), deduplicates parameterized paths, and persists into a
session-scoped SQLite database (one DB per session, isolated under
`~/Library/Application Support/apispy/`). Claude Sonnet annotates
each endpoint with descriptions, parameter types, and auth
requirements via the `@anthropic-ai/sdk`. Output is a valid Postman
Collection v2.1 JSON. Tauri 2 desktop shell + React 18 frontend +
Tailwind CSS 4. Per memory: Phases 0-4 complete. README status badge
shows "WIP" but the canonical commit history shows v1.0.0 bump,
Cargo.lock at 1.0.0, .dmg build deps wired, full icon set
regenerated, baseline Rust tests landed, and CSP hardened — the v1.0
gate is closed.

For full detail see:
- `README.md` on `origin/main`
- `IMPLEMENTATION-ROADMAP.md`
- `CHANGELOG.md`

---

## Why "Release Frozen" (signing cluster) — NOT Active

- **v1.0.0 cadence is explicit and complete on canonical main** —
  version bump, Cargo.lock update, .dmg build deps, full icon set,
  baseline tests, CSP hardening, current Anthropic model ID. This is
  a v1 release closeout sequence, not an active arc.
- **The "WIP" README badge is stale.** It predates the v1.0.0 bump
  commits. The operator should refresh README in a v1.1 polish PR if
  it's important; for disposition purposes, canonical commit cadence
  beats README copy.
- **The "AI annotation in progress" README claim is also stale** —
  `d4c8c70` migrates the Anthropic model ID, which presumes the
  integration is operational.
- **Active** is wrong — no in-flight feature arc is visible on
  canonical main since v1.0.0.
- **Cold Storage / Archived** is wrong — recent v1.0.0 + model ID
  migration is too fresh.

Joins the signing cluster as **member #23** alongside SmartClipboard
/ ink / ArguMap / GlassLayer.

---

## Cluster taxonomy — hybrid signing+extension shape

APIReverse is the first portfolio member to demonstrate a **hybrid
distribution shape**. The two surfaces are:

| Surface | Channel | Purpose |
|---|---|---|
| **Primary: Tauri 2 desktop app** | DMG via Apple Developer ID + notarization | Full UI, MITM proxy engine, SQLite storage, Postman export, AI annotation |
| **Secondary: Browser extension** | Chrome Web Store (MV3) / addons.mozilla.org (Firefox MV2/MV3) — **OR bundled with the Tauri app, operator decision** | Alternate capture mode for users who don't want to install a system-wide MITM CA |

The extension is **not a second cluster slot** — it is a
capture-mode sub-shape of the primary Tauri product. Distinguishing
the two:

- The Tauri app **is** the product (full UI, persistence, export).
- The extension is **one capture surface** for the Tauri app; the
  built-in MITM proxy is the other.
- The two surfaces serve the same SQLite storage; they don't ship
  independently.

If the operator chooses to ship the extension to Chrome Web Store
**separately** (as a feeder for the Tauri app), then APIReverse
would become dual-cluster (signing + Chrome MV3). For now, treat the
extension as a sub-shape, not a second cluster slot.

The signing cluster (now 23 members) remains the operationally-
correct primary classification.

---

## Cluster taxonomy update

| Cluster | Count | Notes |
|---|---|---|
| **Signing (Apple desktop)** | **23** | … SmartClipboard / ink / ArguMap / GlassLayer / **APIReverse** |
| iOS App Store | 3 | Calibrate / Chromafield / Ghost Routes |
| Static-host (web) | 3 sub-shapes | … |
| Self-hosted service | 1 | RedditSentimentAnalyzer |
| PyPI distribution | 2 | MCPAudit / mcpforge |
| Local-first pipeline | 1 | visual-album-studio |
| Operator-tool / dogfood | 1 | GithubRepoAuditor |
| Chrome MV3 extension | 1 | PageDiffBookmark |

APIReverse extends the signing cluster shape with a **new shape
modifier: "hybrid signing+extension"**. Future repos that pair a
Tauri desktop app with an optional browser extension batch as
signing cluster members with this modifier.

---

## Unblock trigger (operator)

When ready to ship publicly:

1. **Apple Developer ID + notarization credentials wired.** Standard
   signing cluster prerequisite.
2. **CA certificate UX for MITM mode.** This is the highest-risk UX
   path. Users must:
   - Trust a APIReverse-generated root CA on first launch
   - Understand the security implication (your traffic is decryptable
     by APIReverse while the cert is trusted)
   - Be able to uninstall the cert cleanly
   Document this in onboarding **before** App Store / general
   distribution — a confused user with an installed MITM CA is a
   support / security incident waiting to happen.
3. **macOS Keychain integration** — verify CA install / uninstall
   uses `security` CLI properly and doesn't leak the private key.
4. **Browser extension distribution decision** — bundle with the
   Tauri app (operator-controlled, no Chrome Web Store overhead) OR
   ship to Chrome Web Store separately (broader reach but adds
   Chrome MV3 cluster overhead per `PageDiffBookmark` disposition).
   Recommended: bundle for v1.0; Chrome Web Store as v1.1 if
   adoption demand justifies.
5. **Anthropic API key handling** — the AI annotation feature needs
   an Anthropic key. Verify the v1.0 UX clearly distinguishes "AI
   annotation requires your own Anthropic key" from "MITM capture +
   Postman export works without an API key." Pricing model clarity
   matters for users.
6. **Postman Collection v2.1 conformance** — verify exported JSON
   imports cleanly into current Postman, Insomnia, and Bruno (the
   three current API client targets).
7. **Verify signed/notarized DMG opens cleanly** with no Gatekeeper
   warnings.
8. **Cut v1.0.0 release tag.**

Estimated operator time once Apple credentials + CA UX onboarding
copy exist: ~4-5 hours (CA UX is the dominant cost).

---

## Portfolio operating system instructions

| Aspect | Posture |
|---|---|
| Portfolio status | `Release Frozen` |
| Distribution channel | **DMG via Apple Developer ID + notarization** (primary); browser extension as sub-shape (bundled or separate Chrome Web Store) |
| Current version | **v1.0.0** |
| Review cadence | Suspend overdue counting |
| Resurface conditions | (a) Apple signing credentials wired, (b) CA UX onboarding finalized, (c) Anthropic API pricing UX clarified, (d) browser extension distribution decision made, or (e) v1.1 scope packet |
| Co-batch with | Signing cluster: … SmartClipboard / ink / ArguMap / GlassLayer / **APIReverse** — **now 23 repos** |
| Special concern | **MITM CA certificate UX.** Highest-risk path — confused users with installed MITM CA = security incident. Onboarding flow and uninstall path must be explicit. |
| Special concern | **Anthropic API key pricing transparency.** Distinguish AI-optional features from core functionality. |
| Special concern | **Hybrid signing+extension shape — first in portfolio.** Future repos with both Tauri DMG and browser extension co-shipping should batch here as precedent. |
| Special concern | **Postman v2.1 conformance.** Verify export imports cleanly into Postman / Insomnia / Bruno before announce. |
| Special concern | **README "WIP" badge is stale.** Refresh in v1.1 polish to reflect v1.0 release state. |

---

## Why this row introduces the hybrid signing+extension sub-shape

Prior signing cluster members were pure Tauri 2 desktop apps. The
extension dir on canonical main breaks that pattern in a way worth
naming:

- The extension is **on `origin/main` of the desktop app's repo** —
  not a separate repo. This signals operator intent to ship them
  together.
- The extension is **a capture surface alternative**, not an
  independent product — it feeds the same SQLite storage the Tauri
  app uses.
- The **distribution decision (bundle vs separate Chrome Web Store)
  remains open** — both are valid.

This sub-shape pattern will recur. Other portfolio repos that
combine a desktop shell with a browser hook (clipboard tools,
recording tools, data-capture tools) may want to adopt this pattern.
Naming it now prevents per-row rediscovery.

---

## Reactivation procedure (for the next code session)

1. Verify `git branch -vv` shows `main` tracking `origin/main`.
   Already correct as of this disposition pass.
2. Review the local stash (`r12-apireverse-stash`) — contains
   modifications to `CLAUDE.md` and `package-lock.json` plus
   untracked `.claude/`, `.codex/`, `AGENTS.md`, `pnpm-lock.yaml`,
   `tsconfig.tsbuildinfo`. **The `pnpm-lock.yaml` is interesting —
   the repo uses `package-lock.json` on canonical main, so the
   untracked pnpm lock is operator experimentation.** Decide whether
   to standardize on npm or pnpm before committing further.
3. Re-run `npm install && npm run tauri build` (or pnpm equivalent
   if the operator has switched) to confirm toolchain.
4. **Test the MITM CA install + uninstall path manually** before
   signing.
5. **Test the browser extension capture mode** alongside the MITM
   mode — verify they hit the same SQLite session correctly.
6. **Audit `extension/manifest.json`** — confirm MV3 for Chrome and
   verify Firefox MV2 fallback if applicable.
7. **Verify Anthropic model ID** in `d4c8c70` is still current; the
   model landscape rotates faster than v1 release cadence.
8. **Run `cargo test`** to confirm baseline Rust tests still pass.

---

## Last known reference

| Field | Value |
|---|---|
| `origin/main` tip | `d4c8c70` chore: migrate to current Anthropic model ID (#12) |
| Last substantive commit | `838df63` test: add baseline Rust tests for proxy normalizer, filter, and db queries |
| Default branch | `main` |
| Build system | **Tauri 2 + Rust (hudsucker MITM proxy + rusqlite) + React 18 + TypeScript 5 + Tailwind CSS 4 + Vite** |
| Version | **v1.0.0** (bumped + Cargo.lock updated + .dmg build deps + icon set + CSP + baseline tests) |
| Phases shipped | 0-4 per memory; v1.0 release closeout commits on canonical main |
| Release scaffolding | **`.dmg` build deps + full icon set + CSP + baseline Rust tests + CHANGELOG + SECURITY.md** |
| Capture surfaces | **Two: built-in MITM HTTPS proxy + Chrome MV3 / Firefox MV2 browser extension** (in `extension/` on canonical main) |
| AI integration | Anthropic `@anthropic-ai/sdk` for endpoint annotation (descriptions, param types, auth requirements) |
| Export format | Postman Collection v2.1 JSON |
| Storage | Session-scoped SQLite under `~/Library/Application Support/apispy/` |
| Blocker | Apple signing + MITM CA UX onboarding + browser extension distribution decision (operator-only) |
| Migration state | **No `legacy-origin` remote** — clean |
| Distinguishing feature | **23rd signing cluster member AND first hybrid signing+extension shape in portfolio.** Tauri DMG primary + Chrome MV3/Firefox MV2 extension secondary capture surface co-existing on canonical main. |
