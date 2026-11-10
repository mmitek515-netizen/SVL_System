# Bastilla OS / SVL_System — pełny plan, wymagania i procent ukończenia

**Stan na 2026-11-10 (ok. 16:42 Europe/Warsaw).** Repozytorium: `mmitek515-netizen/SVL_System`, jedyna gałąź robocza wskazana przez właściciela: `main`. Obowiązuje zasada: **najpierw GUI/design, potem rozbudowa i autonomiczne ulepszanie przez AI**. Hasło otwarcia: **Enter hyperspace**.

## Sposób oceny

Szacunki procentowe odzwierciedlają **stopień realizacji wymagań w aktualnym drzewie repozytorium**, oceniony na podstawie kodu, testów i udokumentowanych ograniczeń. Nie są automatycznym pomiarem, nie oznaczają procentu ukończonych zadań GitHub i **nie są potwierdzeniem działania na hoście**. Wagi sumują się do 100; wartość globalna to suma `waga × procent / 100`, zaokrąglona do liczby całkowitej. Brak dowodu integracji runtime obniża ocenę.

| Obszar | Waga | Realizacja, szacunek | Stan i brakujące kryteria |
| --- | ---: | ---: | --- |
| GUI, design, nawigacja, gesty, Android | 16% | 50% | Istnieją interfejs React, ekran wejściowy, pulpit, komponenty; wymagane uproszczenie modułów, gesty i test na telefonie |
| Główny czat dwustronny jak ChatGPT Work | 13% | 50% | Czat, nowy czat, historia, panel aktywności i załączniki w kodzie; brak dowodu niezależnego pisania agentów 24/7 |
| Pełna biblioteka interaktywnych bloków wiadomości | 10% | 45% | Renderer `svl-ui` obsługuje 26 typów; potrzebne kolejne typy, bezpieczne powiązanie akcji z realnym API i większa zgodność UX |
| Awatary operatora i agentów | 3% | 65% | Plik, HTTPS i generowanie z promptu w GUI/API; wymagane sprawdzenie prawdziwego renderowania i trwałości |
| Debian 13 / KDE / ISO / pakiet systemowy | 10% | 40% | Skrypty live-build, pakiet Debian, branding i launcher pulpitu istnieją; brak potwierdzonego gotowego ISO i instalacji end-to-end |
| Terminale i operacje systemowe | 8% | 40% | Istnieją terminal React, Python/kernel, polecenia i kod binarnej hiperprzestrzeni; brak testu rzeczywistego roota hosta przez każdy terminal |
| Osobne konta Linux i administracja agentów | 5% | 60% | Skrypt `bastilla-agent-accounts` tworzy osobne konta; dostęp sudo/root wymaga świadomej aktywacji; brak dowodu instalacji na docelowym Debianie |
| Niezależne workery, daemony, topologia sferyczna i autoregeneracja | 9% | 15% | Profile czterech agentów i monitorowanie są w kodzie; niezależne usługi, komunikacja i udowodniona samonaprawa niepotwierdzone |
| Ollama i Gemini fallback | 4% | 50% | Backend routingu i diagnostyka istnieją; brak dowodu podłączenia rzeczywistego 14B użytkownika lub działającego fallbacku w AI Studio |
| Real Vision + generowanie obrazów z promptów | 4% | 55% | Kod do analizy zdjęć i OpenAI Images API istnieje; dokładny model/klucz i generowanie na żywo niezweryfikowane |
| Pamięć globalna + agentowa | 3% | 60% | Trwały magazyn JSON, API, wyszukiwanie i kontekst agentów; brak testu odporności na reinstalację oraz długiej pracy na hoście |
| GitHub `main` / globalna synchronizacja | 4% | 45% | API i testy synchronizacji istnieją; dwukierunkowa propagacja GitHub ↔ AI Studio niepotwierdzona |
| MCP, ChatGPT plugin i integracja AI Studio | 5% | 35% | Kod bramy MCP, testy i konfiguracje istnieją; pełny dostęp z ChatGPT oraz backend Linux w samym podglądzie AI Studio niezweryfikowane |
| Diagnostyka, rzeczywiste logi, Work Activity | 2% | 55% | Istnieją panele oraz endpointy; wymaga testów hosta, aktualnych heartbeatów i raportów z wykonań |
| Narzędzia bezpieczeństwa Debian/Kali-style i Maltego | 2% | 35% | Skrypty instalacyjne i panel istnieją; instalacja pakietów i aktywacja Maltego na hoście niepotwierdzone |
| Flota / mapa / moduł hiperprzestrzeni z rzeczywistymi danymi | 2% | 60% | Panel i uwierzytelnione API raportów istnieją; brak dowodu prawdziwych źródeł telemetrycznych i pełnej mapy Układu Słonecznego |
| **Suma ważona** | **100%** | **45%** | **Szacunek realizacji kodowej całego zakresu, nie gotowości produkcyjnej** |

## Wymagania docelowe — wiążąca specyfikacja

### ETAP 1 — przede wszystkim GUI, design i czat

1. Jedno centralne, pełnoekranowe okno czatu inspirowane ChatGPT Work; minimalna liczba widocznych przycisków, ukryte grupy funkcji: Czat / System i terminale / AI i diagnostyka / Narzędzia i dane.
2. Dwustronna komunikacja: operator ↔ Alex/Aria/Astyria/Aurelius i agent ↔ agent; agent może sam napisać, gdy potrzebuje informacji. Strumieniowanie odpowiedzi, realne statusy `queued/running/success/failure`, czas i źródło zdarzenia. Cisza oznacza brak zdarzeń, a nie ukrywanie śladów działań.
3. Gesty zamiast nadmiaru przycisków (swipe, long press, wysuwane panele), z zachowaniem przewijania na Androidzie i alternatyw dla klawiatury/myszy. Nowy czat od dołu, czyszczenie widoku z zachowaniem opcjonalnego archiwum.
4. Zmienialne awatary operatora i każdego z czterech agentów: z linku HTTPS, pliku oraz z promptu generatora obrazu; fioletowy motyw, wysoka czytelność, animacje dostępności i responsywność.
5. Pełna **rozszerzalna** biblioteka natywnych elementów czatu: nagłówki/formatowanie, statusy, karty, powiadomienia, akordeony, zakładki, przyciski i formularze, suwaki, przełączniki, tabele, wykresy, osie czasu, progres, mapy, pliki, podglądy obrazów/wideo/PDF, terminale, diagnostyka, grafy zależności, 3D i zaawansowane interaktywne panele. Stan obecny: **26 typów** w `src/components/SvlChatUi.tsx`, a nie „wszystkie elementy ChatGPT”. Każda akcja mająca zmieniać system musi mieć realny handler/API i wynik, nie tylko zmianę lokalnego stanu.
6. Nie używać nieruchomych makiet DALL-E jako zastępstwa działających widgetów. Dopuszczalne generowane obrazy to awatary, tapety i prawdziwe materiały do pokazania w czacie.

### ETAP 2 — stabilny Linux i interfejs wykonywania

7. Debian 13 z KDE Plasma i autentycznym bootowalnym ISO; pakiet systemowy, usługi systemd, instalator, logi, kopie zapasowe i test zimnego startu.
8. Terminal Python Root, Linux Root CLI, terminal poleceń języka naturalnego przez Ollama/Gemini, Terminal **Binarnej Hiperprzestrzeni** (interfejs 128-bitowy zgodny ze specyfikacją projektu), komunikacja agentów; bez osobnego „Terminala Mashy”.
9. Root oznacza rzeczywistą operację wykonywaną jako UID 0 na **zainstalowanym hoście**, nie napis w interfejsie. Każdy agent otrzymuje osobny UID/home, a administrator może jawnie nadać i odebrać sudo; wszystkie żądania są uwierzytelniane i logowane. Nie udostępniać anonimowego shell/root przez publiczny HTTPS.
10. Preferować `main`; operacje Git muszą pokazywać rzeczywisty SHA, wynik testów, push i potwierdzenie zgodności z origin. Nie niszczyć lokalnych zmian AI Studio.
11. W AI Studio i pod publicznym HTTPS pokazujemy tyle, ile potrafi tam działać rzeczywiście. Preview AI Studio nie jest pełnym Linuxem z rootem do hosta użytkownika. Przy braku bezpiecznego backendu nie symulować wykonania.

### ETAP 3 — maksymalne narzędzia i autonomiczne AI

12. **Alex, Aria, Astyria, Aurelius**: cztery odrębne procesy/usługi, własne konta Linux i narzędzia, pamięć indywidualna + wspólna, komunikacja do użytkownika i między agentami, inicjatywa oraz współdzielona kolejka zadań. Brak sztywnych ról jako ograniczeń; profile GitHub to konfiguracje, nie dowód aktywnego workera.
13. Workery/daemony: asynchroniczne, asymetryczne, polimorficzne, w modelu **sferycznym** (wielokierunkowe zdarzenia i równoległa obserwowalność modułów). Opis architektury, **nie** twierdzenie, że pojedynczy proces fizycznie „widzi wszystko jednocześnie”. Backpressure, kontrola konkurencji, heartbeat i metryki.
14. Samodzielne wykrywanie awarii, diagnoza, proponowanie/wykonywanie napraw, testy regresji, migawka, automatyczny rollback przy błędzie, widoczny dziennik zmian oraz możliwość zatrzymania zadań. Administracyjne operacje według jawnie skonfigurowanej polityki uprawnień.
15. Najpierw preferowany lokalny model Ollama, w tym wskazany przez użytkownika **14B uncensored z obsługą obrazów**, po faktycznej weryfikacji `/api/show` i właściwości `vision`. Gemini 3.1 Flash Lite jako planowany fallback; sprawdzić rzeczywiste nazwy modeli i klucze. Gdy model nie ma vision, system zgłasza brak funkcji.
16. Real Vision przez Ollama, generowanie grafiki z promptu i prezentacja w wiadomości, pamięć długoterminowa globalna i per-agent, załączniki oraz rzeczywiste narzędzia: terminal, Python, git/gh, pliki, przeglądarka, diagnostyka, analizatory danych, systemd/journalctl, testy, API i MCP.
17. Zestaw diagnostyczny wzorowany na Kali, ale instalowany z kompatybilnych źródeł Debiana 13: `nmap`, `tcpdump`, `lynis`, `yara`, `strace`, `jq`, `ripgrep`, `lsof`, `binwalk`, `exiftool`; Maltego Graph z oficjalnego pakietu i legalną licencją. Dostęp do wrażliwych narzędzi pod kontrolą uprawnień.
18. Moduł floty, statków i kosmicznej mapy 2D/3D (estetyka science fiction), ale **zero wymyślonych danych produkcyjnych**: prawdziwe źródło, znacznik czasu, filtr przeterminowanych odczytów; gdy brak danych — pusta mapa.
19. MCP/ChatGPT, Google AI Studio, GitHub i Cloudflare wyłącznie jako faktycznie podłączone kanały. Bez wymaganego Google Cloud Billing w tym wariancie; bez uzależnienia działania głównego GUI od nieuruchomionych usług. Rozróżniać kod, CI, stan deployu i procesy hosta.

## Kryteria potwierdzenia 100%

- GUI: test na Androidzie i desktopie; co najmniej 100 wiadomości, załączniki, gesty i awatary bez utraty stanu.
- Biblioteka: katalog elementów z działającym renderowaniem, schematami oraz powiązaniem akcji z potwierdzonym API, nie pozornymi kontrolkami.
- Linux: build ISO z hashem, uruchomienie w VM i prawdziwej instalacji, usługa systemd, wersja Debiana, aktualny UID i wynik komendy `id`.
- Agent: `systemctl`, PID, UID, heartbeat, ślad narzędzia, odpowiedź samodzielna do czatu, rollback i raport z naprawy.
- AI: odpowiedź wskazanego modelu, przesłanie obrazu, wynik renderowania, zapis/odczyt pamięci po restarcie.
- Git/AI Studio/MCP: rzeczywiste commit SHA i push do `main`, odświeżenie aplikacji, uwierzytelnione `initialize/tools/list`, zewnętrzne wywołanie kończące się danymi z backendu.
- Narzędzia: pakiet widoczny w Debianie, wykonana weryfikacja `--verify`; Maltego uruchomione i aktywowane przez właściciela.
- Brak symulacji w panelach: żadnych fikcyjnych agentów online, statków, telemetrii, uprawnień, zakończonych zadań czy połączenia Ollama.

## Kontrola audytowa z 2026-11-10

Zweryfikowane pliki: `src/components/SvlChatUi.tsx`, `FormattedMessage.tsx`, `AgentCommsView.tsx`, `AvatarSettings.tsx`, `WorkActivityPanel.tsx`, `src/lib/aiRuntimeRoutes.ts`, `docs/AI_AGENT_LINUX_ACCOUNTS.md`, `docs/GLOBAL_SYNC.md`, `docs/SVL_CHAT_UI.md`, `docs/FLEET_REAL_DATA.md`, `scripts/install-ai-security-toolkit.sh` i `scripts/install-maltego-graph.sh`. Zidentyfikowane skrypty ISO, pakietu systemowego, desktopu oraz MCP. Ostatnie zweryfikowane workflow: `AI Vision, render and memory checks` na SHA `6ab09569` — **success**; `Fleet real-data checks` i `Global sync checks` na `0775c4d8` — **success**. Wynik CI nie dowodzi uruchomienia na komputerze, a w historii występowały także nieudane przebiegi.

## Kolejność dalszych prac

**P0 — GUI i czat:** bezpośrednio w `main` (zgodnie z preferencją właściciela), małe zmiany z testami i bez force push: nawigacja, gesty, pełne życie wiadomości, rozbudowa renderera, streaming, statusy hosta oraz widoczność aktywności agentów.

**P1 — Linux/runtime:** rzeczywisty test KDE/noVNC i ISO; instalacja kont agentów; połączenie terminali z uwierzytelnionymi procesami na hoście; komunikaty OFFLINE tam, gdzie usługi nie odpowiadają.

**P2 — AI:** cztery usługi/worker queues, uprawnienia root i audyt, wiarygodne automatyczne naprawy; integracja modelu Ollama 14B, Vision, render, pamięć, sieć narzędzi, Maltego.

**P3 — integracje:** potwierdzona synchronizacja `main` z AI Studio, MCP end-to-end, publikacja wyłącznie bezpiecznych endpointów; pełna telemetria floty i mapa przestrzenna.

**Reguła:** podwyższamy procent dopiero po zmianie kodu i/lub dostarczeniu dowodu testu. Nie wnioskujemy o postępie z wyglądu podglądu ani z samych deklaracji agentów.
