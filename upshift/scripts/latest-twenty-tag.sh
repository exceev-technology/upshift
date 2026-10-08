#!/usr/bin/env bash
set -euo pipefail

# Twenty ships a Docker image for every twenty/vX.Y.Z tag; GitHub Release pages only exist for minor versions
MINOR_LINE="${1:-}"

if [ -n "$MINOR_LINE" ]; then
  if ! [[ "$MINOR_LINE" =~ ^v[0-9]+\.[0-9]+$ ]]; then
    echo "Expected a minor line such as v2.45, got '$MINOR_LINE'" >&2
    exit 1
  fi
  PATTERN="^twenty/${MINOR_LINE//./\\.}\\.[0-9]+$"
else
  PATTERN='^twenty/v[0-9]+\.[0-9]+\.[0-9]+$'
fi

git ls-remote --tags --refs https://github.com/twentyhq/twenty.git 'twenty/v*' \
  | sed 's#.*refs/tags/##' \
  | grep -E "$PATTERN" \
  | sort -V \
  | tail -1
