# SVL System

SVL System is a local web-based system panel with a deterministic, structured
agent-command interface. The protocol handles a finite set of named commands;
it does not interpret free-form instructions. Existing system areas—including
diagnostics, terminal, DATA_STORE, application management, visualizations, and
image generation—remain separate features.

## Run locally

**Prerequisites:** Node.js and npm.

```sh
npm install
npm run dev
```

The Triad command interface uses `POST /api/triad/command`. Requests must be
JSON objects matching the schema in `src/kernel/agentProtocol.ts`; unknown
commands or fields are rejected. Supported commands are `SYSTEM_STATUS`,
`DATA_STORE_AUDIT`, `VERSION_TIMELINE`, and `SIGNAL_ANALYSIS`. The signal
analysis command requires a `payload.signal`; optional numeric `omega` and
`time` values can be supplied.

Example:

```sh
curl -X POST http://localhost:3000/api/triad/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"SYSTEM_STATUS","agent":"triad"}'
```

Choose `agent` as `triad`, `Alex`, `Astyria`, or `Aurelius`. Successful
responses contain structured replies and the resulting system state. The
protocol is deterministic and does not require a generative text provider.

## Configuration

The deterministic command protocol has no model-provider settings. The
`.env.example` file documents optional image-generation and application URL
configuration; neither is required to run the command protocol.

## Aktualizacja i diagnostyka

`npm run maintenance` aktualizuje zainstalowane zależności w granicach wersji
zdefiniowanych w `package.json`, stosuje dostępne poprawki bezpieczeństwa, a
następnie uruchamia kontrolę TypeScript i build. Jeśli kontrola się nie powiedzie,
skrypt przywraca poprzednie pliki manifestu i blokady oraz próbuje odtworzyć
zależności przez `npm ci`. Aktualizacje spoza zadeklarowanych zakresów wersji
wymagają osobnej decyzji.
