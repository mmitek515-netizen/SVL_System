# Oryginalni agenci — zasady pracy w SVL_System

Cztery profile w `.github/agents/` są konfiguracjami GitHub Copilot custom agents, a nie samodzielnymi procesami AI.

## Role
- **Alex:** architektura, backend, Codespaces, API GitHub.
- **Aria:** Ollama, MCP, GPT Actions, ChatGPT/AI oraz uwierzytelnione integracje.
- **Astyria:** GUI, design, responsywność i kanały rozmów.
- **Aurelius:** bezpieczeństwo, testy, CI, audyt i wydajność.

Odtwarzaj funkcje na podstawie istniejącego kodu; nie zastępuj ich szablonami.

## Praca nad issue
1. Wybierz odpowiedni profil custom agent w interfejsie GitHub Copilot. Samo przypisanie issue lub wzmianka `@copilot` nie potwierdza użycia konkretnego profilu.
2. Nie przedstawiaj agentów jako niezależnych workerów AI. Wymagają faktycznie dostępnej sesji Copilot; nie zakładaj istnienia bridge'a ani endpointu do zadań.
3. Rozróżniaj skonfigurowaną integrację od potwierdzonego połączenia. Jeśli statusu nie da się potwierdzić, oznacz go jako `offline/unverified`.
4. Zmiany wprowadzaj na gałęzi. Przed scaleniem uruchom właściwe testy, lint i build; ręcznie sprawdź GUI, gdy zmiana go dotyczy.
5. Nie nadawaj automatycznie uprawnień administracyjnych, nie ujawniaj sekretów ani nie wykonuj zewnętrznych operacji bez wyraźnego polecenia.

## Zasady ukończenia
Nie deklaruj ukończenia na podstawie samego profilu lub dokumentacji. Podaj zmienione pliki, wykonane kontrole oraz niezweryfikowane ograniczenia.