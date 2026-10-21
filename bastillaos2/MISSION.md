# Misja BUILD_BEST_OS — BastillaOS 2

Cel: zupełnie nowy system operacyjny, budowany od podstaw przez Triadę.
To nie jest łatka do BastillaOS 1 (`bastillaos/`) — ta wersja służy tylko
jako baza do odczytu i źródło sprawdzonych rozwiązań.

Pracują autonomicznie: **Alex** planuje, **Astyria** buduje, **Aurelius**
weryfikuje. Cykl trafia do git tylko po „WERDYKT: OK” oraz przejściu
`bash bastillaos2/check.sh` i `npm test`.

## Fazy

1. Architektura i nazwy: założenia systemu, podstawa (dystrybucja, jądro,
   init), struktura katalogu `bastillaos2/`.
2. System budowania obrazu ISO (własny skrypt budowania + konfiguracja).
3. Warstwa systemowa: usługi, bezpieczeństwo, aktualizacje, sieć.
4. Triada jako natywne usługi systemu (Alex, Astyria, Aurelius).
5. Pulpit/powłoka, wygląd i identyfikacja BastillaOS 2.
6. Instalator i pierwsze uruchomienie.
7. Testy całości w `check.sh` i budowanie ISO w CI.

## Architektura

(do ustalenia przez Alexa w pierwszym cyklu)

## Następny krok

Faza 1: zaprojektować architekturę BastillaOS 2 i strukturę katalogu.

## Dziennik
