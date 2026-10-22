#!/usr/bin/env bash
# Instalacja i konfiguracja Ollamy dla czatu Triady (Alex, Astyria, Aurelius).
#
#   bash scripts/setup-ollama.sh               # automatyczny dobór modelu do sprzętu
#   bash scripts/setup-ollama.sh gemma4:12b    # wymuszenie konkretnego modelu
#   ENV_FILE=/etc/bastillaos/system.env bash scripts/setup-ollama.sh
#
# Skrypt: instaluje Ollamę (jeśli brak), uruchamia serwer, pobiera model,
# sprawdza odpowiedź i zapisuje OLLAMA_MODEL / OLLAMA_BASE_URL do pliku .env.
set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
OLLAMA_HOST_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
REQUESTED_MODEL="${1:-}"

log()  { printf '\033[1;36m[ollama-setup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[ollama-setup]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[ollama-setup]\033[0m %s\n' "$*" >&2; exit 1; }

if [ -z "${ENV_FILE:-}" ]; then
  if [ -f /etc/bastillaos/system.env ] && [ -w /etc/bastillaos/system.env ]; then
    ENV_FILE=/etc/bastillaos/system.env
  else
    ENV_FILE="$REPO_ROOT/.env"
  fi
fi

# ── 1. Sprzęt ────────────────────────────────────────────────────────────────
ram_gb=$(awk '/MemTotal/ { printf "%d", $2 / 1024 / 1024 }' /proc/meminfo)
cpus=$(nproc)
vram_gb=0
if command -v nvidia-smi >/dev/null 2>&1; then
  vram_mb=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | sort -n | tail -1 || echo 0)
  vram_gb=$(( ${vram_mb:-0} / 1024 ))
fi
disk_gb=$(df -Pk "$HOME" | awk 'NR==2 { printf "%d", $4 / 1024 / 1024 }')
log "Sprzęt: RAM ${ram_gb} GB, CPU ${cpus} rdzeni, GPU ${vram_gb} GB VRAM, wolne miejsce ${disk_gb} GB."

# ── 2. Dobór modelu (rozmiary z ollama.com/library) ─────────────────────────
# Gemma 4 i Qwen 3.5 dobrze radzą sobie z polskim. Na samym CPU wybieramy
# mniejsze modele, żeby trzech agentów odpowiadało w rozsądnym czasie.
need_gb=0
if [ -n "$REQUESTED_MODEL" ]; then
  model="$REQUESTED_MODEL"; need_gb=4
elif [ "$vram_gb" -ge 20 ] || [ "$ram_gb" -ge 32 ]; then
  model="gemma4:26b"; need_gb=19     # MoE (~4B aktywnych) — szybki mimo rozmiaru
elif [ "$vram_gb" -ge 10 ]; then
  model="gemma4:12b"; need_gb=8
elif [ "$ram_gb" -ge 14 ]; then
  model="gemma4:e4b"; need_gb=10
elif [ "$ram_gb" -ge 6 ]; then
  model="qwen3.5:4b"; need_gb=4
else
  model="qwen3.5:2b"; need_gb=3
fi
log "Wybrany model: $model"
if [ "$disk_gb" -lt $(( need_gb + 2 )) ]; then
  die "Za mało miejsca na dysku dla $model (potrzeba ~$(( need_gb + 2 )) GB, wolne ${disk_gb} GB). Podaj mniejszy model jako argument."
fi

# ── 3. Instalacja Ollamy ─────────────────────────────────────────────────────
if ! command -v ollama >/dev/null 2>&1; then
  log "Instaluję Ollamę (ollama.com/install.sh)…"
  command -v curl >/dev/null 2>&1 || die "Brak curl."
  curl -fsSL https://ollama.com/install.sh | sh
fi
log "Ollama: $(ollama --version 2>/dev/null | head -1)"

# ── 4. Serwer Ollamy ─────────────────────────────────────────────────────────
is_up() { curl -fsS -m 3 "$OLLAMA_HOST_URL/api/version" >/dev/null 2>&1; }
if ! is_up; then
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ] \
     && systemctl list-unit-files ollama.service >/dev/null 2>&1; then
    log "Uruchamiam usługę systemd ollama…"
    sudo systemctl enable --now ollama >/dev/null 2>&1 || true
  fi
fi
if ! is_up; then
  # Codespaces / kontenery bez systemd: serwer w tle, log w ~/.ollama/serve.log.
  mkdir -p "$HOME/.ollama"
  log "Uruchamiam 'ollama serve' w tle (log: ~/.ollama/serve.log)…"
  nohup ollama serve >"$HOME/.ollama/serve.log" 2>&1 &
fi
for _ in $(seq 1 30); do is_up && break; sleep 1; done
is_up || die "Serwer Ollamy nie odpowiada pod $OLLAMA_HOST_URL (zobacz ~/.ollama/serve.log)."

# ── 5. Pobranie i test modelu ────────────────────────────────────────────────
log "Pobieram $model (może potrwać kilka minut)…"
ollama pull "$model"
log "Test odpowiedzi modelu…"
start=$(date +%s)
answer=$(curl -fsS -m 300 "$OLLAMA_HOST_URL/api/chat" -H 'Content-Type: application/json' -d "{
  \"model\": \"$model\", \"stream\": false, \"think\": false,
  \"messages\": [{\"role\": \"user\", \"content\": \"Przedstaw się jednym zdaniem po polsku.\"}],
  \"options\": {\"num_predict\": 60}
}" 2>/dev/null || curl -fsS -m 300 "$OLLAMA_HOST_URL/api/chat" -H 'Content-Type: application/json' -d "{
  \"model\": \"$model\", \"stream\": false,
  \"messages\": [{\"role\": \"user\", \"content\": \"Przedstaw się jednym zdaniem po polsku.\"}],
  \"options\": {\"num_predict\": 60}
}") || die "Model $model nie odpowiedział."
elapsed=$(( $(date +%s) - start ))
reply=$(printf '%s' "$answer" | python3 -c 'import json,sys; print(json.load(sys.stdin)["message"]["content"].strip()[:300])' 2>/dev/null || echo "$answer")
log "Odpowiedź ($elapsed s): $reply"

# ── 6. Zapis konfiguracji ────────────────────────────────────────────────────
upsert() {
  local key="$1" value="$2" file="$3"
  touch "$file"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=\"${value}\"|" "$file"
  else
    printf '%s="%s"\n' "$key" "$value" >>"$file"
  fi
}
upsert OLLAMA_MODEL "$model" "$ENV_FILE"
upsert OLLAMA_BASE_URL "$OLLAMA_HOST_URL" "$ENV_FILE"
log "Zapisano OLLAMA_MODEL=\"$model\" i OLLAMA_BASE_URL w $ENV_FILE"
log "Gotowe. Zrestartuj serwer SVL (Ctrl+C → npm run dev, w BastillaOS: sudo systemctl restart bastillaos-system)."
log "W logu startu zobaczysz: [CZAT TRIADY] Łańcuch: … → Ollama ($model …) → without_nlp"
