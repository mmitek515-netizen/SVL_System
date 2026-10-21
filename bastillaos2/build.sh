#!/usr/bin/env bash
# Budowanie obrazu ISO BastillaOS 2 (wymaga Dockera z kontenerami uprzywilejowanymi).
set -Eeuo pipefail

OS2_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${OUT_DIR:-$OS2_DIR/out}"
IMAGE_TAG="bastillaos2-builder:debian13"
ISO_NAME="BastillaOS-2.0-amd64.iso"
WORK_DIR=''

command -v docker >/dev/null 2>&1 || { echo "Brak Dockera." >&2; exit 1; }
bash "$OS2_DIR/check.sh"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/bastillaos2.XXXXXX")"
cleanup() {
  if [ -n "$WORK_DIR" ] && [ -d "$WORK_DIR" ]; then
    # live-build tworzy pliki roota — usuwamy je z kontenera.
    docker run --rm --mount "type=bind,source=$WORK_DIR,target=/build" "$IMAGE_TAG" \
      find /build -mindepth 1 -delete >/dev/null 2>&1 || true
    rm -rf -- "$WORK_DIR"
  fi
}
trap cleanup EXIT

cp -a "$OS2_DIR/config/." "$WORK_DIR/"
mkdir -p "$WORK_DIR/config"
for part in package-lists hooks includes.chroot; do
  mv "$WORK_DIR/$part" "$WORK_DIR/config/$part"
done

docker build --pull --file "$OS2_DIR/builder/Dockerfile" --tag "$IMAGE_TAG" "$OS2_DIR/builder"
docker run --rm --privileged \
  --mount "type=bind,source=$WORK_DIR,target=/build" \
  --workdir /build \
  "$IMAGE_TAG" \
  bash -Eeuc 'sh ./auto/config && lb build'

mapfile -t images < <(find "$WORK_DIR" -maxdepth 1 -type f -name '*.iso' | sort)
[ "${#images[@]}" -eq 1 ] || { echo "Oczekiwano jednego ISO, znaleziono ${#images[@]}." >&2; exit 1; }

mkdir -p "$OUT_DIR"
install -m 0644 "${images[0]}" "$OUT_DIR/$ISO_NAME"
(cd "$OUT_DIR" && sha256sum "$ISO_NAME" > "$ISO_NAME.sha256")
echo "BastillaOS 2 gotowe: $OUT_DIR/$ISO_NAME"
cat "$OUT_DIR/$ISO_NAME.sha256"
