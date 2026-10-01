# release-please

[`release.yml`](../workflows/release.yml) keeps a release pull request open against `master`.
Merging it tags the commit and publishes a GitHub release, which is what deploys — see
[`../webhooks/README.md`](../webhooks/README.md).

- **Version** comes from the squash-merged pull request titles: `feat` → minor, `fix` → patch, a
  `!` or `BREAKING CHANGE` → major. [`test.lint.pr.yml`](../workflows/test.lint.pr.yml) keeps those
  titles parseable.
- **`changelog-sections`** lists every conventional type with `hidden: false`. release-please's
  defaults hide `build`, `chore`, `ci`, `refactor`, `style` and `test`, which would drop every
  Dependabot bump from the changelog. A commit of a visible type is also enough to open a release
  pull request, so a week of dependency bumps alone produces a (patch) release candidate.
- **`bootstrap-sha`** is the last commit before release-please was introduced. The history before
  it does not follow Conventional Commits, so without it the first changelog would be built from
  all of it. It only matters until the first release exists; after that release-please starts
  from the newest release tag.
- **Tags** have no `v` prefix (`include-v-in-tag: false`), so `1.4.0`. `deploy.sh` accepts exactly
  that shape.
