# Test Coverage Gaps (V1)

Known gaps that are acceptable for V1 and documented for future phases.

## Not Covered

- **React component rendering tests (UI layer)** — requires jsdom environment and component-level test harness
- **End-to-end browser tests (Playwright)** — planned for Phase 3 testing
- **Jellyfin adapter integration tests** — requires real Jellyfin instance or full HTTP mock server
- **Docker Compose startup tests** — infrastructure-layer validation, not unit-testable
- **STB Android app tests** — separate test suite needed in apps/pulse-tv
- **Multi-tenant isolation tests** — requires multi-tenant test data setup with RLS verification
- **Real Supabase integration tests** — all tests use the mock layer; real DB tests are a Phase 2 goal
- **WebSocket/Realtime subscription tests** — realtime hooks are client-side only

## Current Coverage

- API route handler logic (register, heartbeat, sync, assets, devices, cron, config)
- Heartbeat alert detection (storage, CPU, WAN, Jellyfin)
- Sync job lifecycle (enqueue, progress, completion, deduplication)
- Device enrollment flow (token generation, rotation, revocation)
- Checksum utilities (SHA-256 compute + verify)
- Package manifest building
- Request validation utility
- Node-agent heartbeat payload builder
- Node-agent enrollment rate limiting
- Sync-worker download + retry + integrity check logic
