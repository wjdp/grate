---
type: task
status: open
---

# Provider fault banners

Scaffold written 2026-09-02. Motivated by [28](28-Steam-QR-Login.md): an unattended instance must not lose Steam syncing silently. Applies to every provider.

## Problem

- Provider auth breaks quietly: Epic already throws "refresh token has expired, reconnect your Epic account" from `lib/epic/service.ts`, GOG can do the same, Steam will once doc 28 lands. Today the only trace is the failed task in the tasks page and the server log.
- The instance runs for months without anyone opening the providers page. The timeline stops accruing and nobody notices until they look.
- Need one global surface: a banner in the app shell whenever a provider is in a fault state, linking to the fix.

## Sketch (to flesh out)

- **Fault model**: per-provider state derived on request, not stored: `ok | expiring | expired | erroring`. `expiring`/`expired` from token expiry columns; `erroring` from the last N task runs for that provider failing (task history already exists). Lives in `lib/providerHealth.ts` beside `lib/providerJobs.ts`, exposed as `GET /api/providers/health`.
- **Banner**: `AppProviderFaultBanner` in the default layout above page content, one line per faulted provider, severity colour, link to `/providers/<id>`. Dismiss per fault key (`provider:state:expiresAt`) in local storage so a known fault does not nag but a new one does.
- **Providers page**: same data drives the per-provider status chips, replacing ad-hoc `hasApiKey`/expiry text.
- **Refresh**: fetch on layout mount and after any provider task finishes (task SSE already reaches the client via `AppTaskIndicator`).
- Not in scope: email/push notifications, per-game faults, store outages that are not auth.

## Open items

- Thresholds: what counts as `expiring` per provider (Steam 14 days per doc 28; Epic/GOG token lifetimes to check).
- Whether `erroring` needs a task-history query or a `lastError` column on each `<Provider>User` row.
- Dismiss UX: local storage vs a `UserSettings` row.
