#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [twenty-tag]"
  echo "  Builds the Upshift image from a Twenty tag (default: the latest twenty/vX.Y.Z)."
  echo "  IMAGE=name:tag overrides the image name, PLATFORM=linux/amd64 sets the target platform."
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

TWENTY_REPOSITORY="https://github.com/twentyhq/twenty.git"
UPSHIFT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

TWENTY_TAG="${1:-$(bash "$UPSHIFT_ROOT/upshift/scripts/latest-twenty-tag.sh")}"
case "$TWENTY_TAG" in
  twenty/*) ;;
  v*) TWENTY_TAG="twenty/$TWENTY_TAG" ;;
esac

if ! [[ "$TWENTY_TAG" =~ ^twenty/v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Not a Twenty release tag: '$TWENTY_TAG'" >&2
  exit 1
fi

VERSION="${TWENTY_TAG#twenty/}"
IMAGE="${IMAGE:-upshift:$VERSION}"
BUILD_DIRECTORY="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIRECTORY"' EXIT

echo "Cloning Twenty $TWENTY_TAG"
git clone --quiet --depth 1 --branch "$TWENTY_TAG" "$TWENTY_REPOSITORY" "$BUILD_DIRECTORY/twenty"

node "$UPSHIFT_ROOT/upshift/scripts/apply-branding.mjs" --root "$BUILD_DIRECTORY/twenty"

PLATFORM_ARGUMENTS=()
if [ -n "${PLATFORM:-}" ]; then
  PLATFORM_ARGUMENTS=(--platform "$PLATFORM")
fi

docker build \
  "${PLATFORM_ARGUMENTS[@]+"${PLATFORM_ARGUMENTS[@]}"}" \
  --target twenty \
  --build-arg "APP_VERSION=${VERSION#v}" \
  --label "org.opencontainers.image.title=Upshift" \
  --label "org.opencontainers.image.description=Upshift process platform, built on Twenty $TWENTY_TAG" \
  --label "org.opencontainers.image.version=$VERSION" \
  --file "$BUILD_DIRECTORY/twenty/packages/twenty-docker/twenty/Dockerfile" \
  --tag "$IMAGE" \
  "$BUILD_DIRECTORY/twenty"

echo "Built $IMAGE from Twenty $TWENTY_TAG"
