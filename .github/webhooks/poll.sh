#!/bin/sh

# Alternative to the webhook for hosts GitHub cannot reach (internal network,
# no port forwarding): check for a newer release tag and deploy only then.
# Meant for cron, e.g. every five minutes:
#
#   */5 * * * * /var/www/dornsloops/.github/webhooks/poll.sh >> /var/log/dornsloops-poll.log 2>&1

set -e

SCRIPT_PATH=$(realpath "$0")
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")
PROJECT_ROOT=$(realpath "$SCRIPT_DIR/../..")

# mkdir is atomic, so this keeps a long build from overlapping the next tick.
LOCK_DIR="${TMPDIR:-/tmp}/dornsloops-deploy.lock"

cd "$PROJECT_ROOT"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(date -u '+%Y-%m-%d %H:%M:%SZ')] a deployment is already running, skipping"
  exit 0
fi
trap 'rmdir "$LOCK_DIR"' EXIT INT TERM

git fetch --quiet --prune --tags origin

# Same selection as deploy.sh without an argument.
LATEST=$(git tag --merged origin/master --list --sort=-v:refname '[0-9]*.[0-9]*.[0-9]*' | head -n 1)

if [ -z "$LATEST" ]; then
  exit 0
fi

# deploy.sh leaves the checkout detached on the tag it deployed, so HEAD tells
# what is live. Compared as commits: a tag is only a name for one.
if [ "$(git rev-parse HEAD)" = "$(git rev-parse "refs/tags/$LATEST^{commit}")" ]; then
  exit 0
fi

echo "[$(date -u '+%Y-%m-%d %H:%M:%SZ')] new release $LATEST, deploying"
sh "$SCRIPT_DIR/deploy.sh" "$LATEST"
