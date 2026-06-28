# Stripe & Entitlements

## Webhook — `apps/web/src/app/api/stripe/webhook/route.ts`

- **Signature:** `stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)`; header `stripe-signature`; invalid → 400.
- **Idempotency (two steps):**
  1. Upsert a `ProviderEvent` row keyed on `event.id` (unique → duplicate inserts are no-ops).
  2. Atomically **claim** via `updateMany` flipping `processed: false → true`; exactly one concurrent request sees `count === 1`, others return early. On handler error `processed` is reset so Stripe can retry.
- Wrapped with `withRateLimit(handler, { limit: 1000, window: 60 })`.
- Events handled: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_succeeded` (receipt email), `invoice.payment_failed` (7-day grace). Unknown → logged.
- **Server-side price trust:** the handler requires a local `Price` row matching the incoming Stripe price id, else it throws — never trust client-supplied amounts.

## Entitlements — `apps/web/src/lib/entitlements.ts`

Feature keys: `MAX_JOBS`, `MAX_CANDIDATES`, `MAX_TEAM_MEMBERS`, `EMAIL_SEQUENCES`, `ASSESSMENTS`, `AI_MATCHING`, `CUSTOM_BRANDING`, `API_ACCESS`.

- `hasFeature`, `getFeatureLimit` (null = unlimited, 0 = off, >0 = quota), `canCreateJob` / `canAddCandidate` / `canAddTeamMember`, `checkEntitlement`, `consumeEntitlement(…, tx?)`, `requireFeature` (throws), `getEntitlements`.
- `getCurrentPlan(orgId) → 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | null` via 3 strategies: (1) `subscription.product.plans[0].key`; (2) `subscription.metadata.planKey`; (3) parse `product.name` for "enterprise"/"professional"/"pro"; fallback `STARTER`.
- Missing entitlement rows fall back to `STARTER_LIMITS` (`MAX_JOBS` 5, `MAX_CANDIDATES` 50, `MAX_TEAM_MEMBERS` 2, rest 0).

## Billing models

`Subscription` (keyed on `providerSubId`, status = lowercase Stripe enum, `metadata.planKey`), `OrgCustomer` (org → Stripe customer id), `Product` (+ `plans[]`), `Price` (`providerPriceId`), `Entitlement` (composite `(orgId, featureKey)`, `limitInt` / `remainingInt`). All org-scoped via `orgId`.

## Security wrappers

- **`withRateLimit`** (`@/lib/rate-limit`) — presets: `auth` 5/min, `api` 100/min, `public` 200/min, `strict` 10/15min, `upload` 30/5min; opts `{ preset | limit | window | byUser | strict }`. Backed by Upstash Redis (sliding window) with in-memory + circuit-breaker fallback (fail-closed at 50% of limit).
- **`withCsrfProtection`** (`@/lib/csrf`) — skipped when `NODE_ENV === 'test'`; checks `x-csrf-token` (HMAC, cookie `jobsphere-csrf-token`, `CSRF_SECRET`) else falls back to same-site check; 403 otherwise. The signup route uses only rate-limit `strict` (no CSRF, by design).
