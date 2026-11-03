# SVL MCP w Codespaces — bezpieczny most odczytu

Serwer MCP działa osobno na porcie 3100 (SVL na 3000). Obsługuje Streamable HTTP i wymaga tokenu Bearer. Nie udostępnia terminala, roota, GitHub write, czatu ani poleceń systemowych.

Narzędzia: svl_bridge_status (most), svl_agents (nazwy ról, nie status workerów), svl_ai_status (podstawowy status lokalnej aplikacji).

## Uruchomienie w Codespaces

1. Po włączeniu PR do gałęzi używanej przez Codespaces, otwórz terminal w repo i wykonaj:

    npm ci

2. Wygeneruj unikatowy sekret lokalnie:

    openssl rand -hex 32

   Wyniku nie zapisuj w repo i nie wklejaj do czatu. Dodaj go jako sekret Codespaces o nazwie SVL_MCP_TOKEN (repo Settings → Secrets and variables → Codespaces) i uruchom środowisko ponownie, aby sekret był dostępny.

3. Uruchom SVL i most MCP w osobnych terminalach:

    npm run dev
    npm run mcp

   Domyślne porty to 3000 (aplikacja) i 3100 (MCP). Jeśli SVL działa na innym porcie, ustaw SVL_APP_PORT. Most nasłuchuje wyłącznie na 127.0.0.1, a Codespaces może przekierować port 3100.

4. Sprawdź:

    curl -fsS http://127.0.0.1:3100/healthz -H "Authorization: Bearer $SVL_MCP_TOKEN"

5. Wyślij MCP initialize, następnie tools/list:

    curl -fsS http://127.0.0.1:3100/mcp \
      -H "Authorization: Bearer $SVL_MCP_TOKEN" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

    curl -fsS http://127.0.0.1:3100/mcp \
      -H "Authorization: Bearer $SVL_MCP_TOKEN" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

## Podłączenie klienta

W panelu Codespaces → Ports znajdź port 3100. Początkowo pozostaw go Private. Nigdy nie ustawiaj SVL port 3000 jako Public: aplikacja zawiera mechanizmy wykonywania poleceń.

Adres zewnętrznego MCP bywa w formacie:

    https://<codespace>-3100.app.github.dev/mcp

To WZÓR, a nie sprawdzony aktywny adres. Adres rzeczywisty odczytaj z Ports. Dla ChatGPT preferuj Secure MCP Tunnel, jeśli jest dostępny w Twoim planie. Zewnętrzny klient wymagający publicznego HTTPS musi poprawnie uwierzytelniać wywołania. Most używa Authorization: Bearer SVL_MCP_TOKEN. Jeżeli klient ChatGPT nie obsługuje statycznego Bearer, nie wyłączaj uwierzytelniania: potrzebny będzie obsługiwany tunel lub warstwa OAuth.

Gdy klient wysyła Origin, dozwolone są tylko lokalne adresy hosta MCP. Konkretny, zaufany origin można dodać przez SVL_MCP_ALLOWED_ORIGINS (lista po przecinku).

## Ograniczenia i diagnostyka

- 401: brak lub błędny token.
- 403: zablokowany Origin.
- 404: zła ścieżka; użyj /mcp.
- GET /mcp → 405: prawidłowe dla tego serwera, użyj POST.
- Błąd svl_ai_status: aplikacja SVL nie działa lub słucha na innym porcie.
- npm test uruchamia również testy MCP.

Most celowo nie tworzy Issues ani PR. Operacje zapisu do GitHub wymagają osobnego narzędzia z minimalnymi uprawnieniami, potwierdzeniami i audytem. Nie należy uznawać samych deklaracji ról AI za dowód działania niezależnych workerów.
