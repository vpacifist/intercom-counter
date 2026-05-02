# Agent Instructions

This is a small pet-project Firefox extension. Keep process lightweight, but preserve release traceability.

## Versioning Rules

- `manifest.json` is the extension-store source of truth.
- `package.json` and `package-lock.json` must use the same version as `manifest.json`.
- AMO-published commits are marked with git tags named `amo-vX.Y.Z`.
- Current development may be ahead of the latest `amo-v*` tag. That means the local/GitHub code has changes not yet published to the extension store.
- Do not submit or prepare an AMO package without bumping the version first.
- Do not move an existing `amo-v*` tag unless the user explicitly asks; tags are release records.

## Before Coding

Run:

```bash
npm run version:status
```

Use the output to understand:

- the current local extension version
- the latest version known to be published on AMO
- commits and files changed since that store version

## When Adding Changes

- Add user-visible changes to `CHANGELOG.md` under the current `Unreleased` version.
- If the change should ship to AMO and the current version is already tagged as published, bump patch/minor version in `manifest.json`, `package.json`, and `package-lock.json`.
- Keep version bumps separate from unrelated refactors when practical.

## Before Finishing Work

- Run `git status --short --branch`.
- If there are uncommitted changes, mention this clearly in the final response and ask whether the user wants them committed.
- If the current branch is ahead of `origin`, mention that the commits have not been pushed and ask whether the user wants them pushed.
- Do not create commits, tags, pushes, or pull requests unless the user explicitly asks for that action.
- If the user forgets to ask for commit/push after a coding task, proactively remind them with the exact current state.

## Release Flow

1. Run `npm run check`.
2. Run `npm run validate`.
3. Run `npm run build`.
4. Upload the package from `web-ext-artifacts/` to AMO.
5. After AMO accepts the version, tag the exact accepted commit:

```bash
git tag amo-vX.Y.Z
git push origin main --tags
```

6. Update `CHANGELOG.md` from `Unreleased` to `Published on AMO` or add the publish date.

If AMO rejects a package and code changes are needed, keep developing on the same version until the accepted upload is tagged.
