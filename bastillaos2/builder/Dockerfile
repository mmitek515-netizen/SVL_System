# Środowisko budowania obrazu BastillaOS 2 (Debian 13 Trixie + live-build).
FROM debian:13-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates cpio debootstrap debian-archive-keyring dosfstools \
      dpkg-dev gnupg grub-common grub-efi-amd64-bin isolinux live-build \
      mtools squashfs-tools syslinux syslinux-common xorriso xz-utils zstd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
