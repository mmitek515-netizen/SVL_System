# Bastilla OS · GUI First · new backend

This is a **replacement** for the prior SVL_System web server. GUI, chat history, 80+ interactive block types, and cross-tab/server realtime updates use the new JSON database and SSE. There are **no fake AI/agent/host success states**. This package is standalone; it does not require GitHub.

## Run

```bash
npm install
cp .env.example .env
# set SVL_OPERATOR_TOKEN (32+ random characters) when exposed to others
npm run dev
```

`npm run build` and `npm start` produce/serve the production web app. The UI is responsive for mobile and desktop. The same backend instance is the authoritative source for chats, avatars, and queued agent work. OpenCode with ChatGPT sign-in is the primary model backend. State persists at `DATA_DIR/bastilla-state.json`. Web pages sync via SSE `/api/events`, plus refetch on focus and scheduled checks. Changes on *another* backend URL are not synchronized without a separate external database or replication setup.

## Linux host global sync

The application server may run inside AI Studio/hosting, which is **not** your full Linux host. To see real Debian 13/systemd/Ollama metrics, deploy `linux/linux-sync-agent.py` **on that host**. Configure `SVL_BACKEND_URL` to the actual HTTPS backend URL and the same 32+ character `SVL_LINUX_SYNC_TOKEN` on both sides. It sends signed read-only snapshots every 15 seconds: Linux version/kernel, host UID, memory, disk, services, processes, Ollama tags. `/api/linux/status` reports OFFLINE if no fresh sample arrives within 45 seconds. This bridge does **not** copy your entire filesystem, root-control Linux, or sync remote repositories.

To install as systemd service (on your authorized Debian host):

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin bastilla-sync || true
sudo install -Dm644 linux/linux-sync-agent.py /opt/bastillaos/linux-sync-agent.py
sudo install -Dm644 linux/systemd/bastilla-linux-sync.service /etc/systemd/system/bastilla-linux-sync.service
sudo install -d -m700 /etc/bastillaos
sudo sh -c 'umask 077; printf "SVL_BACKEND_URL=https://YOUR-BACKEND-URL\nSVL_LINUX_SYNC_TOKEN=PASTE-SAME-32+CHAR-TOKEN\n" > /etc/bastillaos/linux-sync.env'
sudo systemctl daemon-reload
sudo systemctl enable --now bastilla-linux-sync
```

## OpenCode with ChatGPT Plus/Pro login (primary AI)

OpenCode runs **on Debian 13**, not inside the phone and not inside Google AI Studio preview. On the SAME Linux user account that will run OpenCode:

```bash
opencode auth login openai
# Select "Sign in with ChatGPT", complete OAuth in your browser or via device code.
# Then check that your model is available with /models in the OpenCode TUI.
OPENCODE_SERVER_PASSWORD="YOUR-LONG-RANDOM-SECRET" opencode serve --hostname 127.0.0.1 --port 4096
```

Set the same `OPENCODE_SERVER_PASSWORD` in Bastilla's backend environment and `OPENCODE_BASE_URL=http://127.0.0.1:4096` (when both services run on the same host). Host credentials remain in the OpenCode user profile; the browser **never receives OAuth credentials**. `GET /api/opencode/status` explicitly reports whether OpenCode is reachable and whether its `/provider` endpoint identifies OpenAI as connected, and checks the selected default OpenAI model. The API cannot distinguish ChatGPT OAuth from OpenAI API-key authentication; this is explicitly marked UNVERIFIED, so complete the **Sign in with ChatGPT** step on the host. A real response checks the OpenAI model path, not the OAuth method. The `Wszyscy` chat routes to OpenCode's real session APIs. Persistent mapping from Bastilla sessions to OpenCode sessions is stored in the Bastilla database. SSE sends GUI invalidations across devices.

When Bastilla backend runs in another container/host, configure a private HTTPS-protected reverse proxy and `OPENCODE_ALLOW_REMOTE=true`; never expose port 4096 publicly. Operator authentication uses `SVL_OPERATOR_TOKEN` on production deployments. Sign in with ChatGPT is provider authentication, **not** a substitute for authenticating users of the Bastilla GUI.

Only if explicitly configured `SVL_ALLOW_OLLAMA_FALLBACK=true`, requests may fall back to local Ollama when OpenCode is unavailable. ChatGPT plan usage remains subject to account limits. The system does not provide unlimited API credentials or an OpenAI API key.

### Agent communication

Each agent requires its own 32+ character bearer token in the JSON `SVL_WORKER_TOKENS` env variable. `POST /api/worker/heartbeat`, `POST /api/worker/next`, and `POST /api/worker/complete` support real jobs/responses. A named profile does not mean that worker is running. No unrestricted remote/root shell endpoint is provided. In the chat, messages to `Wszyscy` use OpenCode with a verified connected OpenAI provider; messages addressed to an individual are queued until that agent actually connects.

### Security scope and limitations

Use `SVL_OPERATOR_TOKEN` for remote access: the `/api/auth/login` endpoint establishes an HttpOnly session cookie; the GUI exposes a login form. The public web backend **cannot** manage or install Linux itself. The host observer requires HTTPS except loopback. Do not put secrets in Git/AI Studio client-side variables. There is no fake DALL-E render, full OS mirror, root access, or automatic AI Studio-to-GitHub two-way sync.
