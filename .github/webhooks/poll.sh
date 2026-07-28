#!/bin/sh

# Alternative to the webhook for hosts GitHub cannot reach (internal network,
# no port forwarding): check origin/master and deploy only when it moved.
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

git fetch --quiet --prune origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "[$(date -u '+%Y-%m-%d %H:%M:%SZ')] origin/master moved ${LOCAL%"${LOCAL#???????}"} -> ${REMOTE%"${REMOTE#???????}"}, deploying"
sh "$SCRIPT_DIR/deploy.sh"
