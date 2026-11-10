# Bastilla OS SVL_System

**Enter hyperspace** — świeży punkt startowy aplikacji Bastilla OS, która udostępnia interfejs SVL System.

To repozytorium zawiera kod aplikacji webowej: pulpit Bastilla, interfejsy terminali, moduły SVL, integracje oraz narzędzia diagnostyczne. Sam kod nie oznacza, że Debian/Linux został zainstalowany na hoście, że Ollama jest uruchomiona ani że aplikacja ma uprawnienia root hosta.

## Czysta baza po reinstalacji

Zasady nowego startu i rozdzielenie kodu od danych hosta opisuje [dokumentacja czystej bazy](docs/REINSTALL_BASELINE.md). Repozytorium i jego historia Git pozostają zachowane; dane runtime, sekrety, lokalne bazy i dyski VM powinny być tworzone oddzielnie dla nowej instalacji.

## Uruchomienie aplikacji lokalnie

Wymagane: Node.js, npm oraz Python 3.

```sh
npm ci
cp .env.example .env
npm run dev
```

Ollama jest osobną lokalną usługą. Jej obecność, model, uprawnienia hosta i działanie terminali można potwierdzić dopiero na docelowym komputerze. Nie dodawaj sekretów ani kluczy do repozytorium.

## Projekt

- Nazwa interfejsu: **Bastilla OS SVL_System**
- Wejście: **Enter hyperspace**
- Domyślna gałąź: `main`
- Aplikacja: React + Vite + Express + lokalne SVL Kernel API
- Szczegóły środowiska, integracji i konfiguracji: dalsze sekcje dokumentacji repozytorium.

## Walidacja

```sh
npm test
npm run lint
npm run build
npm run build:server
```

Samo zapisanie zmian w GitHub nie uruchamia ich na hostingu. Do sprawdzenia wyglądu i połączeń aplikację trzeba uruchomić lub wdrożyć w odpowiednim środowisku.
