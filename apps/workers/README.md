# apps/workers — DEAD TREE, kept for reference only

- **Not a workspace member.** Root `package.json` declares `workspaces: ["apps/web", "packages/*"]`, so this package's dependencies are never installed.
- **Never built, linted, tested or deployed.** It is excluded from `yarn build`, `yarn lint`, `yarn typecheck` and `yarn test`.
- **Canonical background workers live in `apps/web/src/workers/`** and run through `tsx`; `Dockerfile.worker` is the image that actually ships them.
- Referenced only by the legacy root `./Dockerfile`, which is itself unused.
- Kept in the repo as historical reference. Do not add features here — change `apps/web/src/workers/` instead.
