# Bastilla OS SVL_System

**Enter hyperspace** — świeży ekran wejściowy aplikacji Bastilla OS z dostępem do pulpitu SVL.

To repozytorium zawiera kod aplikacji webowej i konfigurację obrazu instalacyjnego Debian 13 Live z KDE Plasma. Sam zapis w GitHub nie instaluje systemu na komputerze ani nie publikuje aplikacji.

## Aktualny stan

- Repozytorium: `mmitek515-netizen/SVL_System`
- Główna gałąź: `main`
- Ekran wejściowy: **Enter hyperspace**; wybór jest pamiętany lokalnie w przeglądarce.
- Wejście prowadzi do istniejącego pulpitu Bastilla; pozostałe moduły aplikacji są zachowane.
- Kod aplikacji i skrypty ISO są w repozytorium. Zainstalowany system, uruchomiony model Ollama oraz dostęp root do hosta wymagają osobnej konfiguracji i weryfikacji.

## Czysta baza po reinstalacji

Postępuj według [dokumentacji czystej bazy](docs/REINSTALL_BASELINE.md). Repozytorium zachowuje historię i kod. Dane runtime, lokalne bazy, dyski VM oraz sekrety należy utworzyć osobno dla świeżej instalacji.

## Uruchomienie aplikacji webowej

Wymagane: Node.js 22+, npm i Python 3. Lokalny czat wymaga osobnej usługi Ollama i skonfigurowanego modelu.

```sh
npm ci
cp .env.example .env
# Uzupełnij lokalne ustawienia w .env; nie dodawaj ich do Git.
npm run dev
```

Otwórz adres wyświetlony przez Vite. Ekran **Enter hyperspace** pojawi się przy pierwszym wejściu w danej przeglądarce lub po wyczyszczeniu jej danych witryny. Kliknięcie przycisku zapisuje wybór w localStorage i otwiera pulpit.

## Budowa bootowalnego ISO

Wymagania i kroki opisuje [bastillaos/README.md](bastillaos/README.md). Na hoście Linux amd64 z Dockerem uruchom z katalogu głównego repozytorium:

```sh
bash bastillaos/build-iso.sh
```

Po udanej budowie skrypt tworzy ISO oraz sumę SHA-256 w `bastillaos/build/`. Samo rozpoczęcie workflow lub commity w `main` nie instalują systemu na urządzeniu. Workflow ISO jest uruchamiany ręcznie albo po wypchnięciu tagu `bastillaos-v*`.

## Walidacja kodu aplikacji

```sh
npm test
npm run lint
npm run build
npm run build:server
```

Walidacja kodu aplikacji nie zastępuje budowania ani testu ISO na maszynie docelowej. Nie deklaruj działania funkcji hosta, roota, terminali czy Ollamy bez sprawdzenia ich na zainstalowanym systemie.

## Główne dokumenty

- [Czysta baza po reinstalacji](docs/REINSTALL_BASELINE.md)
- [Budowa i instalacja Bastilla OS](bastillaos/README.md)
- [Konfiguracja mostu MCP](docs/MCP_SETUP.md)
