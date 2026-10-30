# SVL System

SVL System is a local web application for the SVL kernel. It combines the
Alex, Astyria and Aurelius agent interfaces, deterministic structured commands,
local Ollama-powered chat, local kernel state, diagnostics and application management.

## Requirements

- Node.js 22 or newer
- npm
- Python 3 for the local kernel
- Ollama with the configured local chat model

## Run locally

```sh
npm ci
cp .env.example .env
ollama pull gemma3:4b
npm run dev
```

Ollama runs locally at `http://127.0.0.1:11434`; chat requires no model API key
or cloud connection. The default `gemma3:4b` model (4B parameters, ~3.3 GB
download) needs roughly 5 GB of free RAM and supports image (vision) input; in
constrained environments pick a smaller model instead (e.g. `llama3.2`, faster
on CPU but without image analysis). Set
`OLLAMA_MODEL` to another model already installed in Ollama to change it.
`GET /api/ai/status` checks the local Ollama service and selected model. Chat
replies are capped at 2048 output tokens; set `OLLAMA_NUM_PREDICT` (e.g. 512)
to shorten replies and speed up CPU-only generation. Text attachments are
included in the prompt; image attachments (JPEG/PNG) work with vision models
such as `gemma3:4b` (models without vision reject them with a clear error),
while PDF input requires the optional Gemini provider.
The deterministic command protocol works independently of Ollama.

`npm run check:gemini` checks the optional Gemini configuration for the
separate `VM_Gemini_4` profile; Gemini is not used by chat.

## Local `VM_Gemini_4` guest

In the dashboard chat, request creation of `VM_Gemini_4` to see the proposed
operation. A separate **Zatwierdzam: utwórz VM** click is required before the
server will create it. The fixed operation starts a local QEMU/KVM Debian 13
cloud guest in Docker with 2 vCPUs, 2 GiB guest memory and a 20 GiB copy-on-write
disk. It downloads the official Debian cloud image and checks the published
SHA-512 checksum before boot. Docker/KVM and outbound HTTPS access are required.

The provisioning endpoint only accepts that fixed operation, only for a
same-origin browser request from a loopback client, and checks the Compose
labels before reusing a container named `vm_gemini_4`. It cannot execute
arbitrary shell commands or act on other containers. SSH is bound to host
loopback port 2224; its generated private key and guest disk are kept in the
ignored `bastillaos/vm-gemini-4/data/` directory. Protect that directory like
any SSH private key. The Gemini API key remains on the application server and
is not copied into the guest. This guest does not grant the chat agents root
access to the host.
SSH logs in as the locked-password `svl-agent` account, which has no `sudo`
privileges. The default `debian` account is removed from the `sudo` group and
cloud-init's passwordless sudoers file is removed. The guest uses a separate
`vm-gemini-4-restricted.qcow2` disk, leaving any older VM disk untouched.
Guest networking uses QEMU user-mode NAT for outbound connections; SSH is
published on host loopback only. Do not place credentials or private host data
in the guest.

### Check Gemini

Run a minimal live request to verify Gemini models configured for the optional
`VM_Gemini_4` profile, its key and network access:

```sh
npm run check:gemini
```

The diagnostic never prints the API key and does not send chat history or
application data. It sends a short test prompt to each configured Gemini model.

## Instant best-fit replies

Short chat messages (up to 8 words) are matched against a matrix of
"arguments" before any model is called — the same best-fit idea as the
ABARKUS prototype. The best match answers immediately from live system
data; no match falls through to the model (Ollama) as before.

| Argument | Agent | Example | Data |
|---|---|---|---|
| `SYSTEM_STATUS` | Alex | `status` | kernel version, mode, mission, model chain |
| `RESOURCES` | Alex | `ile ramu` | RAM, CPU load, disk, uptime |
| `OLLAMA_STATUS` | Astyria | `ollama` | reachability, installed/loaded models |
| `SYSTEM_LOGS` | Astyria | `pokaż błędy` | last 10 system log entries |
| `GIT_STATUS` | Aurelius | `git` | branch, last commit, uncommitted files |
| `HELP` | Aurelius | `pomoc` | this list |

Prefix a message with `@model` to force a model reply. Set
`BEST_FIT_ROUTER="off"` to disable the router. Matching lives in
`src/kernel/bestFitRouter.ts`; the arguments are `BEST_FIT_MATRIX` in
`server.ts`.

## Agent commands

The typed agent-command API is `POST /api/triad/command`. It validates a
finite command schema and rejects unknown commands and fields. Supported
commands are `SYSTEM_STATUS`, `DATA_STORE_AUDIT`, `VERSION_TIMELINE`, and
`SIGNAL_ANALYSIS`. The signal command requires `payload.signal`; optional
`omega` and `time` values are numeric.

```sh
curl -X POST http://localhost:3000/api/triad/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"SYSTEM_STATUS","agent":"triad"}'
```

Set `agent` to `triad`, `Alex`, `Astyria` or `Aurelius`. The API returns
structured agent replies and the updated local kernel state. Natural-language
chat is provided separately at `POST /api/triad/message` and uses local Ollama.
In the Triad tab, the default shared channel sends one message to Alex, Astyria,
si_1 and Aurelius; each reply is saved as a separate author entry in the same
chat history.
Alex receives project-development guidance and can direct you to the supported
Studio commands. Alex, Astyria and Aurelius each receive a mission focused on
project development, application reliability, database workflows and validating
changes. The mission runs only when an agent answers a chat message; it is not a
background worker. Chat replies do not directly edit repository files, execute
arbitrary system commands, browse the web continuously or deploy changes.
Agents must distinguish supplied or model-known information from verified
current internet research.
These names are chat roles, not separately installed autonomous services. They
are not connected to the VM and cannot log into it or change system
permissions. The VM is a separate environment for manually approved work;
dependency updates run on a schedule only to produce a reviewable pull request
and are not merged automatically.

### Chat proposals and approvals

Agents can suggest one of these chat commands:

- `/propose create-app <id> [type]`
- `/propose create-db <id>`
- `/propose write-file <app-id> <filename>` followed by the complete file
  content on the next line (up to 20,000 characters)
- `/propose launch <id>`

Proposals are previews only. Review the operation (and the proposed file
content), then send `/approve <ID>` to apply it or `/reject <ID>` to discard
it. `/proposals` lists pending proposals. They expire after 15 minutes and are
cleared when the server restarts. File edits are limited to a single named
file inside an existing `apps/` project; `app.json`, hidden files, arbitrary
commands, repository files and production deployments are not allowed. Launch
only starts the application's local preview.

Approval commands require a same-origin browser request. The application does
not currently authenticate user accounts, so do not expose this development
server or its network to untrusted users. Review every proposed file before
approving it.

The dashboard and agent chat accept up to three files. Text files (`txt`, `md`,
`csv`, `json`, `xml`, web/source files, logs and YAML) are limited to 40 KB
each and 60 KB combined. PDF documents and JPG/JPEG photos are limited to 5 MB
each and 12 MB combined. Text attachments are sent to the configured local
Ollama model and stored in local chat history. The small default model does not
support PDF/JPEG attachments; the server rejects those instead of silently
omitting their contents. Do not attach secrets or private data you do not want
included in chat history.

## Projects and local databases

In Studio Aplikacji, use `create-app <id> [type]` to scaffold a project and
`create-db <id>` to create an empty SQLite database under `data/databases/`.
Use `list` and `list-db` in the Studio terminal to refresh their lists. App
projects are refreshed automatically while Studio is open. Database files are
local to this server and are not shared with remote services.

## Validation and builds

```sh
npm test
npm run lint
npm run build
npm run build:server
```

`npm run build` creates the browser application in `dist/`. The server bundle
is written to `bastillaos/build/server.mjs`.

## Dependency maintenance

The maintenance tool checks registry updates and audits dependencies without
changing files by default:

```sh
npm run maintenance
# Explicitly install compatible updates and security fixes:
npm run maintenance -- --apply
```

Updates stay within the version ranges declared in `package.json`; breaking
major upgrades are not forced. The tool runs the audit, tests, TypeScript
check, browser build and server build. If an apply run fails, it restores the
previous package manifest and lockfile and reinstalls the locked dependencies.
Review the resulting diff before committing it.

A weekly/manual GitHub Actions workflow performs the same checks and opens a
pull request for compatible dependency changes. It does not merge the pull
request, update application source from arbitrary websites, or deploy to
production. Major-version upgrades and production deployments require an
explicit review.

## Configuration

Copy `.env.example` to `.env` and set `OLLAMA_HOST` and `OLLAMA_MODEL` to your
local Ollama service and an installed model. If `.env` already exists, add or
update those lines without replacing the file. Keep `.env` private; it is
excluded from version control. `GEMINI_API_KEY`, `GEMINI_MODEL` and
`GEMINI_FALLBACK_MODELS` are only for the optional `VM_Gemini_4` profile and
Gemini diagnostic. Restart the server after changing environment variables.
Image-generation credentials and `APP_URL` are optional and are not needed for
the agent command protocol.

## Deployment

Build both artifacts with `npm run build && npm run build:server`. BastillaOS
packages the server with the systemd unit in
`bastillaos/system-package/systemd/`. Production deployment additionally
requires the target host, its approved environment configuration and a release
decision; builds and dependency checks do not publish or install to a host.
