#!/bin/sh

# Always deploy the current state of origin/master.
# Called automatically by the GitHub webhook on push to master,
# or manually on the server (no arguments).
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

# Sync working tree to the latest master, discarding local changes
log "fetching origin/master"
git fetch --prune origin
git checkout master
git reset --hard origin/master

# Build
export TZ=UTC
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
RELEASE="$RELEASES_DIR/$(date -u '+%Y%m%d%H%M%S')"
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

log "deployment complete"
