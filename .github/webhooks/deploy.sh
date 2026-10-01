#!/bin/sh

# Deploy a release: the git tag release-please created when its pull request
# was merged. Called by the GitHub webhook on `release.published` with the tag
# as argument, or manually on the server — without an argument it deploys the
# newest release tag. Never a branch: what is live is always a tagged version.
#
# The site is fully static, so there is no service to restart: the build is
# published into a timestamped release directory and the `current` symlink —
# which nginx serves from — is flipped over to it once the build succeeded.

set -e

SCRIPT_PATH=$(realpath "$0")
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")
PROJECT_ROOT=$(realpath "$SCRIPT_DIR/../..")

# Where the published releases live. Override to serve from outside the checkout.
RELEASES_DIR="${DORNSLOOPS_RELEASES:-$PROJECT_ROOT/releases}"
CURRENT_LINK="$RELEASES_DIR/current"
# Older releases kept around for a quick rollback.
KEEP="${DORNSLOOPS_KEEP:-3}"

log () {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%SZ')] $*"
}

cd "$PROJECT_ROOT"

# `--tags` because the tag that triggered this run is new by definition.
log "fetching origin"
git fetch --prune --tags origin

TAG="${1:-$(git tag --merged origin/master --list --sort=-v:refname '[0-9]*.[0-9]*.[0-9]*' | head -n 1)}"

# The argument comes out of the webhook payload. It is signed, but it still ends
# up in a git command line and a directory name, so only a plain version passes.
if ! printf '%s' "$TAG" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  log "ERROR: '$TAG' is not a release tag — nothing deployed"
  exit 1
fi

# Only what went through master is a release. A tag pushed from a side branch,
# by hand or by mistake, would otherwise bypass every check.
if ! git merge-base --is-ancestor "refs/tags/$TAG" origin/master; then
  log "ERROR: $TAG is not on origin/master — nothing deployed"
  exit 1
fi

# Detached on the tag; `--force` discards local changes like the
# `reset --hard` this used to be.
log "checking out $TAG"
git -c advice.detachedHead=false checkout --force --detach "refs/tags/$TAG"

# Build. The fixed zone keeps a build reproducible wherever it runs; what the page
# shows no longer depends on it, the upload date carries its own zone.
#
# `npm run generate` pins the same zone through cross-env, so a local build matches this
# one. Kept here as well, for everything else this script runs.
export TZ=UTC

# Link previews embed absolute URLs, which are baked in at build time. Nuxt
# picks this up from .env as well; the check only warns, it never blocks.
if [ -z "${NUXT_PUBLIC_SITE_URL:-}" ] && ! grep -qs 'NUXT_PUBLIC_SITE_URL' .env; then
  log "WARNING: NUXT_PUBLIC_SITE_URL is unset — link previews will have no image"
fi

log "installing dependencies"
npm ci
log "generating static site"
npm run generate

# Never publish a broken build.
if [ ! -f .output/public/index.html ]; then
  log "ERROR: build produced no index.html — keeping the current release"
  exit 1
fi

# Publish. The new release starts as a hardlink copy of the live one, then
# rsync overwrites only what actually differs — so the ~180 MB of loop videos
# occupy the disk once, not once per release.
#
# Two details make this work:
#   * `cp -al` instead of rsync --link-dest, because --link-dest only hardlinks
#     files matching in *all* preserved attributes, and `nuxt generate` stamps
#     a fresh mtime on every copied file.
#   * --checksum, so rsync compares contents rather than size+mtime and leaves
#     the unchanged videos alone.
# rsync replaces changed files by writing a temp file and renaming it, so
# older releases keep their own version.
# Timestamp first, so the pruning below can keep sorting by name; the tag after
# it says which version a directory is when picking one for a rollback.
RELEASE="$RELEASES_DIR/$(date -u '+%Y%m%d%H%M%S')-$TAG"
PREVIOUS=$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)

mkdir -p "$RELEASES_DIR"
if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
  log "publishing to $RELEASE (hardlinked against $PREVIOUS)"
  rm -rf "$RELEASE"
  cp -al "$PREVIOUS" "$RELEASE"
  rsync -a --delete --checksum .output/public/ "$RELEASE/"
else
  log "publishing to $RELEASE (first release)"
  mkdir -p "$RELEASE"
  rsync -a --delete .output/public/ "$RELEASE/"
fi

# Flip the symlink. `-n` keeps ln from writing *into* the old target directory.
ln -sfn "$RELEASE" "$CURRENT_LINK"
log "current -> $RELEASE"

# Prune old releases, newest first, keeping the configured number.
find "$RELEASES_DIR" -maxdepth 1 -type d -name '2*' \
  | sort -r \
  | tail -n "+$((KEEP + 1))" \
  | while read -r old; do
      [ "$old" = "$PREVIOUS" ] && continue
      log "removing old release $old"
      rm -rf "$old"
    done

log "deployment of $TAG complete"
