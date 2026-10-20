# BastillaOS live-build

This directory contains a Debian `live-build` configuration for an amd64
hybrid ISO based on Debian 13.7 (Trixie), with KDE Plasma, Debian Installer,
non-free firmware, Wi-Fi support, and PipeWire audio.

## Build

On a Debian build host with `live-build`, `debootstrap`, `xorriso`, and
`squashfs-tools` installed, run from this directory as root:

```sh
lb build
```

`auto/config` configures both the live system and Debian Installer to use
Trixie. Its normal Debian mirrors track the current Trixie archive, including
security and point-release updates. Thus the recipe is repeatable in its
architecture, suite, and package selection, but builds are not bit-for-bit
reproducible as archive contents advance. The ISO name/volume retain the 13.7
baseline label; they do not freeze package versions at the 13.7 release date.

The BastillaOS runtime list provides Python 3, a venv, sudo, and general
system-management dependencies. When Aurelius's Debian package is available,
place its `.deb` in `config/packages.chroot/` so live-build includes it; its
control file remains the authority for package-specific dependencies. Add any
additional Debian runtime dependencies it declares to the package lists.
No custom service or daemon is assumed by this configuration.

## Validation

The configuration can be checked without building the full image:

```sh
sh -n auto/config
lb config --validate
```

The second command requires the Debian `live-build` package and should be run
from this directory. A complete build additionally requires network access,
root privileges, and sufficient disk space for a full KDE image.
