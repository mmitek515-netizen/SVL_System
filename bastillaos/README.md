# BastillaOS

BastillaOS is a Debian 13 (Trixie) Stable amd64 Live installer with KDE Plasma,
the Bastilla visual identity, and the existing SVL system installed as a local
system service. It is a bootable Linux distribution project, not a web-only
reskin.

## Build requirements

- Linux or GitHub Actions runner with Docker Engine and permission to run
  privileged build containers.
- Node.js 22 or later and npm.
- Internet access for Debian repositories, npm, and the Debian live-build
  container.
- Approximately 20 GB of free build storage; a KDE installer ISO is large.

The ISO build uses Docker so the Debian live-build tools run on Debian 13 rather
than inheriting Ubuntu or another host's build environment.

## Build an installable ISO

From the repository root:

```sh
bash bastillaos/build-iso.sh
```

The user running the build needs permission to access the Docker daemon, which
launches a privileged but disposable Debian build container. The host-side Node,
npm, and Debian package preparation do not require running `npm` as root.

The script builds the existing React application, compiles its production
server, creates the `bastillaos-svl-system` Debian package, and builds the
Debian Live installer with the repository's live-build configuration. On
success it produces:

- `bastillaos/build/BastillaOS-13-amd64.iso`
- `bastillaos/build/BastillaOS-13-amd64.iso.sha256`

The installer image is built from the current Debian Trixie repositories,
includes KDE Plasma 6 and the official Debian live installer, and supports
amd64 UEFI and legacy BIOS boot.
The image also sets unattended Debian security upgrades, a deny-incoming UFW
firewall policy, and conservative kernel/network sysctl defaults.

GitHub Actions can build the same ISO on demand via **Build BastillaOS Debian
Live ISO → Run workflow**. Pushing a `bastillaos-v*` tag also builds and
publishes the ISO and checksum as a workflow artifact. CI does not commit
generated binaries to the source repository. The workflow frees runner disk
space and syntax-checks the build scripts before the full build; the build
script removes root-owned live-build temporaries via the builder container.

## Boot and install

Write the ISO to a USB drive with a trusted image writer, or attach it to an
amd64 virtual machine configured for UEFI. Back up files before installation:
installing an operating system can erase disk contents. Start the live session,
review the installer partition choices, and explicitly select the target disk.
The installed system starts the local SVL service as `root` so Triad agents can
perform system-level changes. The root-privileged HTTP API is bound to
`127.0.0.1:3000`; do not expose it to a network. Any local process that can
reach this API can execute root commands. The desktop opens using Chromium.

The Gemini and Pollinations credentials are not bundled into the ISO. To enable
external AI services on an installed system, configure
`/etc/bastillaos/system.env` as a root-owned file (`chmod 0600`) and restart
`bastillaos-svl-system`. The service reads this file as root; never make it
writable by the desktop user, and never put API secrets in a Git-tracked file or
a public ISO. The service unit fixes its listener to `127.0.0.1:3000` after
reading this file, so the bind address cannot be changed there.

## Preserved SVL functionality

The Debian package carries the existing built web system and writable runtime
data, including the Triad chat, Astyria mission tooling, terminal, system
diagnostics and telemetry, kernel and DATA_STORE, history and snapshots, file
explorer, Apps Studio, without_nlp engine, 3D visualizations, and GitHub
integration. The service binds to loopback only. Existing app data is preserved
when the Debian package is upgraded.
