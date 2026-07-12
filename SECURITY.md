# Security and privacy boundary

This app can read the current user's Codex login state **only** to request usage data locally. It must never copy, store, render, log, upload, or expose an access token or account ID to renderer code.

## Network allowlist

The real provider requests only `https://chatgpt.com/backend-api/wham/usage`. Redirects are rejected and requests time out after 12 seconds. It does not use telemetry, analytics, crash reporting, or third-party services.

## Publishing checklist

- Never commit `~/.codex/auth.json`, `CODEX_HOME`, `.env` files, response fixtures containing real data, or debug logs.
- Keep Electron `contextIsolation: true` and `nodeIntegration: false`.
- Keep the preload bridge minimal; do not expose filesystem, shell, or arbitrary IPC access.
- Treat all request headers and raw API responses as secrets in issue reports and screenshots.
- Ship signed release binaries from CI or a clean build machine. Clearly label unsigned builds.
- Label the provider as an unsupported internal-interface integration, not an official OpenAI API.
