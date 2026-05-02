# Release and Versioning

The project intentionally uses a small release process:

- extension version: `manifest.json`
- npm/project version: `package.json` and `package-lock.json`
- store release record: git tags named `amo-vX.Y.Z`
- release notes: `CHANGELOG.md`

## Check Current State

```bash
npm run version:status
```

This prints the local version, latest AMO tag, commits since that tag, and changed files. If there are commits after the latest `amo-v*` tag, local/GitHub development is ahead of the extension-store version.

## Version Meaning

- Patch version, for example `0.1.1`: bug fixes, small behavior improvements, packaging/documentation needed for release.
- Minor version, for example `0.2.0`: new user-facing features such as historical reports.
- Major version is unlikely for this pet project until there are breaking data/storage changes.

## Preparing an AMO Upload

1. Confirm `manifest.json`, `package.json`, and `package-lock.json` all have the same version.
2. Confirm `CHANGELOG.md` describes the version being uploaded.
3. Run:

```bash
npm run check
npm run validate
npm run build
```

4. Upload the generated package from `web-ext-artifacts/`.
5. When AMO accepts it, tag the accepted commit:

```bash
git tag amo-vX.Y.Z
git push origin main --tags
```

Do not create the AMO tag before acceptance unless the user explicitly wants a candidate tag.
