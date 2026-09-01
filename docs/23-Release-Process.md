---
type: task
status: done
---

# Release process

Create an automated release process. Today every master push builds and pushes `latest` + `:sha` to ghcr, and `package.json` is stuck at 0.1.0. After this task, `latest` tracks releases; `edge` tracks master.

## Requirements

- Trigger: manual `workflow_dispatch` with a bump choice input (`patch` / `minor` / `major`).
- Release workflow:
  1. Guard: only runs against `master`.
  2. Bump version in `package.json` (`pnpm version <bump> --no-git-tag-version` or similar), commit `Release vX.Y.Z` to master, tag `vX.Y.Z`, push both.
  3. Build the Docker image **from the bump commit** and push with tags: `X.Y.Z`, `X.Y`, `X`, `latest`.
  4. Keep the provenance attestation step for release images.
  5. Create a GitHub release for the tag with auto-generated notes (`generate_release_notes: true`).
- Change the existing master push job: push `edge` + `:sha` instead of `latest` + `:sha`.
- Release builds must still pass lint/typecheck/vitest first (reuse existing jobs or `needs` them).
- Edge builds append the short git sha to the displayed version: build-arg → `runtimeConfig.public.version` (e.g. `0.2.0+abc1234`). Release builds show the bare version.

## Decisions made

- Edge tag named `edge` (Docker/Alpine/Traefik convention).
- Git tags `v`-prefixed (`v1.2.3`); Docker tags bare (`1.2.3`).
- Semver tag cascade (`1`, `1.2`, `1.2.3`) so deployments can pin a line — use `docker/metadata-action` rather than hand-rolling.
- Release commits land directly on master via the workflow; needs `contents: write` and, if branch protection is ever enabled, a token/app that can bypass it.
- amd64-only for now (drop the unused QEMU step); arm64 later.

## Nice-to-haves (include if cheap)

- Concurrency guard on the release workflow so two dispatches can't interleave.

## Notes

- Pushes made with the default `GITHUB_TOKEN` don't trigger other workflows, so the bump commit pushed to master won't itself fire the master workflow — no duplicate `edge` build for the release commit.
- Existing deployments pulling `latest` will silently switch from bleeding edge to release cadence once this lands — the prod instance (currently at 3aef15a) should be repointed deliberately, to `edge` or a version tag.
- Version display already exists: `nuxt.config.ts` reads `package.json` version into `runtimeConfig.public`, shown in `AppSidebar.vue` — the sha suffix builds on this.
