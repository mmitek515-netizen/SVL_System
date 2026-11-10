# Bastilla OS SVL_System — czysta baza po reinstalacji

Ten dokument wyznacza świeży punkt startowy projektu po reinstalacji. Nie oznacza, że system operacyjny został już zainstalowany na hoście.

## Tożsamość

- Nazwa systemu: **Bastilla OS SVL_System**
- Ekran wejściowy: **Enter hyperspace**
- Repozytorium: `mmitek515-netizen/SVL_System`
- Gałąź integracyjna: `main`

## Czysty stan startowy

Reinstalacja systemu docelowego powinna zaczynać się od nowego obrazu/instalacji systemu bazowego, pustych danych runtime i nowego pliku środowiskowego utworzonego z `.env.example`. Nie kopiuj starych sekretów, historii czatu, baz lokalnych ani dysków VM do nowej instalacji.

Repozytorium pozostaje źródłem kodu i zachowuje swoją historię Git. Moduły aplikacji, terminal i narzędzia projektu są nadal kodem aplikacji; ich obecność w repozytorium nie oznacza, że mają dostęp root do hosta ani że system operacyjny został zainstalowany.

## Pierwsze uruchomienie deweloperskie

1. Zainstaluj Node.js zgodny z `package.json`, npm oraz Python 3.
2. Skopiuj `.env.example` do lokalnego `.env` i uzupełnij tylko własne ustawienia.
3. Uruchom `npm ci`.
4. Uruchom `npm run dev`.
5. Sprawdź status usług w panelu diagnostycznym.

Ollama jest usługą lokalną instalowaną osobno. Samo repozytorium nie potwierdza, że Ollama lub model są obecne na hoście.

## Zasady czystej instalacji

- Nie zapisuj tokenów, haseł, kluczy prywatnych ani danych użytkownika w Git.
- Nie przywracaj danych runtime z poprzedniej instalacji bez osobnej decyzji.
- Najpierw uruchom aplikację w trybie deweloperskim; nie traktuj tego kroku jako wdrożenia produkcyjnego.
- Weryfikacja instalacji systemu operacyjnego, uprawnień hosta, terminali root i usług wymaga wykonania na docelowym hoście.
