# Bug Log

## 2026-03-29 - Avoided invalid Tauri frontend path during desktop boot
- Status: fixed
- Severity: high
- Symptom: `cargo tauri dev` failed before startup because the pre-dev command resolved the frontend package path outside the repo and `npm` could not find `client/package.json`.
- Root cause: the Tauri build config used `../client` for `beforeDevCommand` and `beforeBuildCommand`, but the commands were executed from the repository root rather than from `server/`.
- Fix: updated the Tauri build commands to use the repo-relative `client` path so both dev and build boot flows resolve the frontend correctly.
- Verification: `cargo tauri dev` advanced past the missing-package error, `npm run build` passed in `client/`, and `cargo check` passed in `server/`.
- Files touched:
  - `server/tauri.conf.json`
- Linked commit/PR: pending
- Notes: this was a startup-only failure, but it blocked all local desktop verification until the path contract was corrected.

## 2026-03-29 - Avoided Tauri startup failure from missing icon asset location
- Status: fixed
- Severity: medium
- Symptom: the Rust/Tauri shell failed during `cargo check` because `generate_context!()` expected an icon at `server/icons/icon.png` and could not find one.
- Root cause: the project had an icon asset, but it was placed at `server/icon.png` instead of the generated Tauri icon path the build expected.
- Fix: moved the icon into `server/icons/icon.png` so the Tauri context generator could load the asset from the expected location.
- Verification: `/Users/rujulw/.cargo/bin/cargo check` passed after the icon was placed in the expected directory and the client production build also passed.
- Files touched:
  - `server/icons/icon.png`
- Linked commit/PR: pending
- Notes: this was an integration mismatch between project assets and Tauri defaults rather than a Rust logic bug.

## 2026-03-29 - Avoided broken client bootstrap build from outdated TypeScript module settings
- Status: fixed
- Severity: medium
- Symptom: the client production build failed with missing `Set`, `Buffer`, `node:*`, and Vite module resolution errors even though the app code itself was straightforward.
- Root cause: the scaffold used TypeScript module-resolution settings that did not match the Vite 7 toolchain and was also missing Node type declarations needed by the build config.
- Fix: updated the client TypeScript configuration to use bundler module resolution, added the required Vite and Node types, and installed the missing development dependency.
- Verification: `npm run build` passed in `client` and the desktop shell smoke checks ran successfully with `npm test`.
- Files touched:
  - `client/package.json`
  - `client/package-lock.json`
  - `client/tsconfig.json`
  - `client/tsconfig.node.json`
- Linked commit/PR: pending
- Notes: fixing the toolchain mismatch early kept later desktop-shell commits focused on app behavior instead of build-system churn.
