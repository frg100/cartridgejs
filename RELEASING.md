# Releasing

All packages (`@cartridgejs/cli`, `@cartridgejs/steam`, `@cartridgejs/electron`, `create-cartridgejs`) are released
together with the same version. `create-cartridgejs` gives new games `^<its own version>` of the other packages.

## One time

The release workflow uses **npm trusted publishing (OIDC)**: GitHub Actions proves to npm which repo and workflow
it is, so no npm token is stored in GitHub. (npm is removing direct publishing for 2FA-bypass tokens around
January 2027, see the [GitHub changelog](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/).)

1. **Own the npm scope.** Make the org `cartridgejs` at https://www.npmjs.com/org/create (the free plan allows
   unlimited public packages). The npm CLI cannot create orgs. Check it with `npm org ls cartridgejs`.

2. **Publish 0.1.0 by hand, one time.** A trusted publisher is set in each package's settings on npmjs.com,
   so the packages must exist first. From a clean `main`:

   ```bash
   pnpm install --frozen-lockfile && pnpm build && node scripts/check-pack.mjs --e2e
   node scripts/pack-release.mjs
   for f in .release/*.tgz; do npm publish "$f" --access public; done
   ```

   npm asks for your 2FA code for each package. With npm 12, this makes a **staged** publish: npm shows a
   `0.0.0-stage` placeholder, and the real version is not public until you approve it on npmjs.com (the package
   page, with 2FA). Approve all four. `create-cartridgejs` makes games that need `@cartridgejs/cli`, so a new game
   cannot install until every package is approved. Check with `npm view @cartridgejs/cli version`.

3. **Connect each package to the workflow.** For each of `@cartridgejs/cli`, `@cartridgejs/steam`,
   `@cartridgejs/electron` and `create-cartridgejs`: npmjs.com › the package › Settings › Trusted Publisher ›
   GitHub Actions, with:

   | Field | Value |
   |---|---|
   | Organization or user | `frg100` |
   | Repository | `cartridgejs` |
   | Workflow filename | `release.yml` |
   | Environment | (empty) |
   | Allow `npm publish` | ✅ (the workflow runs `npm publish`; without it, only `npm stage publish` is allowed) |
   | Allow `npm dist-tag` | not needed (the workflow sets the `next` tag during publish) |

   If you want a human approval step for every release instead, leave "Allow `npm publish`" off and change the
   workflow to `npm stage publish`; then approve each package on npmjs.com after the workflow runs.

4. **Optional, recommended:** on the same Settings page, set "Publishing access" to require 2FA and disallow
   tokens. Then only this workflow (and you, with 2FA) can publish.

## Each release

```bash
node scripts/set-version.mjs 0.2.0      # sets the version in every package
pnpm install                            # updates the lockfile
pnpm build && node scripts/check-pack.mjs --e2e
git commit -am "Release 0.2.0"
git tag v0.2.0 && git push origin main v0.2.0
```

The tag starts `.github/workflows/release.yml`. It builds, tests, checks that the tag matches the package versions,
builds a new game from the packed packages, and publishes with trusted publishing. It skips versions that are
already on npm, so you can run a failed release again. npm adds provenance (a signed link from each package to the
commit and workflow that built it) when the repository is public.

- A version with a `-` (for example `0.2.0-beta.1`) is published with the npm tag `next`, not `latest`.
- To try the workflow without publishing: Actions › Release › Run workflow (with "dry run" on).

## Check before you release

`node scripts/check-pack.mjs --e2e` packs every package as npm would publish it, checks the files in each tarball,
then makes a new game with the packed starter and builds it with only the packed packages. CI runs it on Windows,
macOS and Linux for every pull request (`release-check` job).
