# Bastilla OS SVL_System — czysta baza po reinstalacji

Ten dokument opisuje procedurę przygotowania nowej instalacji. Zmiany w repozytorium same w sobie nie instalują systemu operacyjnego ani nie resetują urządzenia.

## Tożsamość i stan repozytorium

- Nazwa systemu/aplikacji: **Bastilla OS SVL_System**
- Ekran wejściowy aplikacji: **Enter hyperspace**
- Repozytorium: `mmitek515-netizen/SVL_System`
- Główna gałąź: `main`

Repozytorium zachowuje historię Git i kod. Ekran powitalny jest elementem aplikacji webowej: kliknięcie **ENTER HYPERSPACE** otwiera istniejący pulpit, a wybór jest zapisywany w localStorage bieżącej przeglądarki. Aby ponownie zobaczyć ekran, wyczyść dane witryny dla aplikacji lub użyj świeżego profilu przeglądarki.

## Co oznacza „czysta instalacja”

Nowa instalacja systemu docelowego powinna używać świeżo zbudowanego obrazu i pustych danych runtime. Nie kopiuj automatycznie z poprzedniej instalacji sekretów, historii czatu, baz lokalnych, danych aplikacji ani dysków VM. Repozytorium nie zawiera prywatnego pliku `.env`; utwórz go lokalnie na podstawie `.env.example`.

Obecność terminala, jądra SVL lub kodu integracji w repozytorium nie potwierdza uprawnień root na hoście, działania daemonów, uruchomienia Ollamy ani instalacji systemu.

## Pierwsze uruchomienie aplikacji webowej

Wymagane są Node.js 22+, npm i Python 3:

```sh
npm ci
cp .env.example .env
npm run dev
```

Uzupełniaj `.env` lokalnie i nie commituj sekretów. Lokalny czat wymaga niezależnie uruchomionej usługi Ollama oraz pobranego i skonfigurowanego modelu. Panel diagnostyczny może pokazać status dostępny z uruchomionej aplikacji; nie zastępuje kontroli hosta.

## Budowa świeżego obrazu systemu

Szczegółowe wymagania opisuje [bastillaos/README.md](../bastillaos/README.md). Obecny proces budowania używa skryptu `bastillaos/build-iso.sh` i wymaga hosta Linux amd64 z dostępem do Docker Engine, Node.js 22+, npm, Bash, `dpkg-deb`, `sha256sum`, internetu i około 20 GB wolnego miejsca.

Z katalogu głównego repozytorium:

```sh
bash bastillaos/build-iso.sh
sha256sum -c bastillaos/build/BastillaOS-13-amd64.iso.sha256
```

Wynik to `bastillaos/build/BastillaOS-13-amd64.iso` i plik sumy SHA-256. Następnie zapisz ISO na nośniku albo uruchom w maszynie wirtualnej, sprawdź wybór dysku instalacyjnego i dopiero wtedy rozpocznij instalację. Instalacja systemu może usunąć dane z wybranego dysku.

GitHub Actions może zbudować obraz po ręcznym uruchomieniu workflow lub po wypchnięciu tagu `bastillaos-v*`. Artifact workflow nie jest automatycznie zapisywany do `main` ani instalowany na komputerze.

## Po instalacji

1. Uruchom system z zainstalowanego dysku i sprawdź połączenie sieciowe.
2. Sprawdź status usługi aplikacji oraz logi zgodnie z dokumentacją Bastilla OS.
3. Skonfiguruj wymagane sekrety i ustawienia w docelowym systemie, a nie w repozytorium.
4. Sprawdź Ollamę, wybrany model, terminale, uprawnienia i dostęp do jądra na tym hoście.
5. Utwórz nowe dane runtime. Przywracaj kopie tylko świadomie i wybiórczo.

## Walidacja

Testy aplikacji można uruchomić z katalogu repozytorium:

```sh
npm test
npm run lint
npm run build
npm run build:server
```

Sukces tych poleceń nie dowodzi, że ISO się uruchamia albo że wszystkie urządzenia i uprawnienia hosta działają. Weryfikację ISO i systemu po instalacji wykonaj w środowisku docelowym.
