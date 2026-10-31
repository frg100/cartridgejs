# Releasing

All packages (`@cartridgejs/cli`, `@cartridgejs/steam`, `@cartridgejs/electron`, `create-cartridgejs`) are released
together with the same version. `create-cartridgejs` gives new games `^<its own version>` of the other packages.

## One time

1. Own the npm scope: make the org `cartridgejs` at https://www.npmjs.com/org/create (the free plan allows
   unlimited public packages). The npm CLI cannot create orgs. Check it with `npm org ls cartridgejs`.
2. Make an npm access token that can publish `@cartridgejs/*` and `create-cartridgejs`
   (npmjs.com › Access Tokens › Generate New Token › Granular, read and write).
3. Add it to GitHub: repo › Settings › Secrets and variables › Actions › New secret › `NPM_TOKEN`.

## Each release

```bash
node scripts/set-version.mjs 0.2.0      # sets the version in every package
pnpm install                            # updates the lockfile
pnpm build && node scripts/check-pack.mjs --e2e
git commit -am "Release 0.2.0"
git tag v0.2.0 && git push origin main v0.2.0
```

The tag starts `.github/workflows/release.yml`. It builds, tests, checks that the tag matches the package versions,
builds a new game from the packed packages, and publishes. When the repository is public, it adds npm provenance
(a signed link from each package to the commit and workflow that built it).

- A version with a `-` (for example `0.2.0-beta.1`) is published with the npm tag `next`, not `latest`.
- To try the workflow without publishing: Actions › Release › Run workflow (with "dry run" on).

## Check before you release

`node scripts/check-pack.mjs --e2e` packs every package as npm would publish it, checks the files in each tarball,
then makes a new game with the packed starter and builds it with only the packed packages. CI runs it on Windows,
macOS and Linux for every pull request (`release-check` job).
