# Bastilla OS SVL_System

**Enter hyperspace** — świeży ekran wejściowy aplikacji Bastilla OS z dostępem do pulpitu SVL.

To repozytorium zawiera kod aplikacji webowej i konfigurację obrazu instalacyjnego Debian 13 Live z KDE Plasma. Sam zapis w GitHub nie instaluje systemu na komputerze ani nie publikuje aplikacji.

## Porządek w repozytorium

Kod źródłowy, konfiguracja Debian 13/KDE i skrypty budowania ISO pozostają w `main`. W dniu 10.11.2026 usunięto z aktualnego drzewa Git historyczne pliki runtime (lokalne bazy SQLite, migawki DATA_STORE, rejestr wdrożeń oraz testowe archiwum). Nie są to elementy wymagane do zbudowania czystego ISO. Nowe dane runtime należy tworzyć lokalnie, poza historią Git.

**Uwaga dla istniejących instalacji:** przed `git pull` wykonaj kopię własnych baz i eksportów, jeśli były przechowywane w śledzonych ścieżkach. Zmiana repozytorium nie czyści automatycznie hosta ani nie instaluje systemu. Historyczne pliki nadal są dostępne w poprzednich commitach Git — usunięcie z `main` nie usuwa ich z historii publicznego repozytorium.

Weryfikacja i odzyskiwanie: [zasady higieny repozytorium](docs/REPO_CLEANUP.md).

## Aktualny stan

- Repozytorium: `mmitek515-netizen/SVL_System`
- Główna gałąź: `main`
- Ekran wejściowy: **Enter hyperspace**; wybór jest pamiętany lokalnie w przeglądarce.
- Wejście prowadzi do istniejącego pulpitu Bastilla; pozostałe moduły aplikacji są zachowane.
- Kod aplikacji i skrypty ISO są w repozytorium. Zainstalowany system, uruchomiony model Ollama oraz dostęp root do hosta wymagają osobnej konfiguracji i weryfikacji.

## Uruchamianie BastillaOS

1. Uruchom komputer lub VM z przygotowanego ISO/USB i wybierz sesję Live.
2. W środowisku Live otwórz instalator Debiana. Przed potwierdzeniem dokładnie
	sprawdź dysk docelowy; instalacja na całym dysku usuwa jego dotychczasowe dane.
3. Po instalacji uruchom komputer z dysku i zaloguj się do KDE kontem utworzonym
	w instalatorze. System nie konfiguruje automatycznego logowania ani
	automatycznego otwarcia Chromium.
4. Z menu aplikacji uruchom **BastillaOS**. Poczekaj na lokalny panel, a na
	ekranie **Enter hyperspace** wybierz wejście do pulpitu SVL.
5. Jeśli panel się nie otwiera, sprawdź usługę przez
	`sudo systemctl status bastillaos-system.service`.

Pełna instrukcja bootowania, instalacji, pierwszego uruchomienia i diagnostyki
jest w [przewodniku BastillaOS](bastillaos/README.md#boot-and-install). Ekran
**Enter hyperspace** jest ekranem aplikacji, nie systemu ani instalatora.

## Czysta baza po reinstalacji

Postępuj według [dokumentacji czystej bazy](docs/REINSTALL_BASELINE.md). Repozytorium zachowuje historię i kod. Dane runtime, lokalne bazy, dyski VM oraz sekrety należy utworzyć osobno dla świeżej instalacji.

## Uruchomienie aplikacji webowej

Wymagane: Node.js 22+, npm 10.5.1+ i Python 3. Lokalny czat wymaga osobnej usługi Ollama i skonfigurowanego modelu.

```sh
npm ci
if [ ! -f .env ]; then cp .env.example .env; fi
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

## Główny plan projektu i postęp (10.11.2026)

Aktualna, zbiorcza specyfikacja właściciela, priorytety GUI → Linux → autonomiczni agenci,
stan 26 elementów czatu i szacunkowa **realizacja kodowa 45%** (nie gotowość produkcyjna):
[Plan Bastilla OS i procent ukończenia](docs/BASTILLA_MASTER_PLAN_PROGRESS_2026-11-10.md).

Procenty są szacunkami z audytu kodu i testów; działanie Ollama, root hosta,
czterech niezależnych workerów, bootowalnego ISO oraz integracji AI Studio/MCP
w realnym środowisku należy osobno potwierdzić. Nie wyświetlać fikcyjnych statusów.

## Główne dokumenty

- [Czysta baza po reinstalacji](docs/REINSTALL_BASELINE.md)
- [Budowa i instalacja Bastilla OS](bastillaos/README.md)
- [Globalna synchronizacja DATA_STORE, GitHub i AI Studio](docs/GLOBAL_SYNC.md)
- [Flota i statki kosmiczne — interaktywny panel danych rzeczywistych](docs/FLEET_REAL_DATA.md)
- [Real Vision, renderowanie GPT Image i pamięć AI](docs/AI_MULTIMODAL_MEMORY.md)
- [Konfiguracja mostu MCP](docs/MCP_SETUP.md)
- [MCP wyłącznie przez Google AI Studio (bez Codespaces)](docs/MCP_AI_STUDIO.md)
