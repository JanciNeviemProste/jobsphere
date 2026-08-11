# Playwright configs

Four configs, each with a different job. Picking the wrong one is the usual cause
of "it passes locally but not in CI".

| Config                               | Scope                            | Projects      | Runs                                                     |
| ------------------------------------ | -------------------------------- | ------------- | -------------------------------------------------------- |
| `playwright.config.ts`               | `tests/e2e/**` (minus `visual/`) | chromium only | every PR, via `ci.yml`                                   |
| `playwright.cross-browser.config.ts` | same specs                       | the other 9   | push to `main` + manual, via `e2e-cross-browser.yml`     |
| `playwright.a11y.config.ts`          | `tests/a11y/**`                  | its own       | separately                                               |
| `playwright.visual.config.ts`        | `tests/e2e/visual/**`            | its own       | opt-in — missing baselines must not fail the default run |

## Why chromium alone gates PRs

The default config used to declare all ten projects while CI installed only
chromium, so firefox, webkit, msedge and every mobile/tablet project failed with
`browserType.launch: Executable doesn't exist` on every single run. That is not a
flake to retry — it is a certainty, and it made the E2E job unpassable regardless
of whether the application worked.

The nine remaining projects are now sharded across their own workflow. Cross-browser
differences are real but rare, and 19 sharded jobs at a 60-minute timeout is a poor
trade on every push to a PR branch. Trigger it by hand
(`workflow_dispatch`) before merging anything browser-sensitive: CSS, layout, media
queries, date/number formatting.

## Engines, not names

Project names do not map one-to-one onto browsers to install:

- `iPhone 12`, `iPhone 13 Pro`, `iPad Air`, `iPad Mini`, `webkit` → **WebKit**
- `Pixel 5`, `Galaxy S9+`, `chromium` → **Chromium**
- `edge` → Chromium channel `msedge`, which needs the channel installed, not just the engine
- `firefox` → Firefox

So `npx playwright install --with-deps webkit chromium` covers all the mobile and
tablet projects.

## The server under test

In CI the config runs `yarn start`, so `.next` must already exist — the workflow
builds before invoking Playwright. Locally it runs `yarn dev`.

It previously ran `npm run dev` in both cases, which meant CI paid for `yarn build`
and then threw the build away to test a development bundle: different chunking, no
minification, dev-only error overlays. The `webServer.timeout` is 300s because
Playwright's 60s default is regularly too short for a cold Next start on a CI
runner, and the resulting timeout message reads like an application failure rather
than a budget that was simply too small.

## Do not run these through turbo

Invoke Playwright directly (`npx playwright test …`), not `yarn test:e2e`.

`yarn test:e2e` is `turbo test:e2e`, and Turborepo 2 defaults to `envMode: "strict"`:
only variables declared in the task's `env` reach the child process. The task
declares `NODE_ENV` and `DATABASE_URL`, so `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`,
`REDIS_URL` and the `NEXT_PUBLIC_*` values are stripped before the Next server
starts. Without `NEXTAUTH_SECRET` the logins in `tests/setup/global-setup.ts`
cannot succeed, and every authenticated spec fails for a reason that has nothing to
do with the test.

If you do want the turbo path, widen `test:e2e.env` in `turbo.json` first.
