# GUI SVL_System

Wspólny ciemny interfejs obejmuje wszystkie 18 zakładek: pulpit, czat, akceptacje,
infrastrukturę, misje, pamięć, historię, terminal, Python, dane, telemetrię,
wizualizator, pliki, aplikacje, transmisje, flotę, analizę sygnału i GitHub.

Kontrolki, panele, edytory i dialogi korzystają z `WorkspaceUI.tsx` oraz
`workspace.css`. Opisy rozwija się na żądanie. Wiadomości korzystają ze wspólnego
renderera Markdown i akcji kopiowania/cytowania. Interfejs nie pobiera obrazków;
wykres sygnału i mapa floty są sterowane kontrolkami.

Infrastruktura pokazuje procesy z API backendu zamiast przykładowych PID-ów.
Telemetria i status VM pokazują odczyt API lub stan niezweryfikowany. Migawki
historii są kopiami bieżących danych i pozostają w pamięci do opuszczenia widoku.
Wizualizator pokazuje liczby wiadomości oraz rozmiar JSON UTF-8. Transmisje
zachowują lokalną kolejkę SQLite i nie oznaczają połączenia zewnętrznego.

## Sprawdzenie

```sh
npm ci
npm run lint
npm test
npm run build
```

Uruchom aplikację w osobnym terminalu (`npm run dev` albo po buildzie
`NODE_ENV=production npm start`). Zainstaluj Chromium dla Playwright:

```sh
npx playwright install chromium
UI_BASE_URL=http://localhost:3000 npm run test:ui
```

Można wskazać istniejący Chromium przez `CHROMIUM_PATH=/usr/bin/chromium`.
`UI_SCREENSHOTS` określa katalog podglądów (domyślnie `/tmp/svl-workspace-ui`).
Test GUI sprawdza 18 zakładek przy 1440×1000 i 390×844, brak poziomego
przepełnienia i obrazków, akcje czatu, inspektory, odrzucenie niepoprawnego JSON
oraz importu, błąd i sukces zapisu, edycję aplikacji, mapę i eksport floty,
misje, transmisje, akceptacje oraz obsługę dialogów klawiszem Escape.
Wszystkie żądania API w tym teście są przechwytywane; zapisy nie trafiają do
prawdziwego backendu ani do GitHub. Dostępność zewnętrznych usług wymaga osobnej
konfiguracji środowiska i nie jest potwierdzana tym testem.
