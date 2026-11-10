import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import {
  INITIAL_DATA_STORE,
  generatePythonMonolith,
} from "../src/kernel/svlKernel.ts";

const baseURL = process.env.UI_BASE_URL || "http://localhost:3000";
const output = process.env.UI_SCREENSHOTS || "/tmp/svl-workspace-ui";
const tabs = [
  "home",
  "comms",
  "approvals",
  "process_matrix",
  "astyria_mission",
  "schema_graph",
  "temporal",
  "terminal",
  "monolith",
  "datastore",
  "diagnostics",
  "visualizer",
  "file_explorer",
  "apps",
  "hyper_com",
  "fleet",
  "without_nlp",
  "github",
];
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
});
const errors = [];
try {
  for (const [layout, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() =>
      localStorage.setItem("bastilla_svl_hyperspace_entered_v1", "true"),
    );
    const store = structuredClone(INITIAL_DATA_STORE);
    store.chat_history = [
      { agent: "Operator", tekst: "Sprawdź stan." },
      {
        agent: "Astyria",
        tekst:
          "## Wynik\n\n**Gotowe**\n\n```sh\nnpm test\n```\n\n| Moduł | Stan |\n| --- | --- |\n| API | OK |\n\n![plik](https://example.invalid/test.png)",
      },
    ];
    const app = {
      id: "matrix-telemetry",
      name: "Aplikacja testowa",
      description: "Opis testowy",
      type: "html5-web",
      version: "1.0",
      author: "Test",
      status: "ready",
      entry: "index.html",
      created_at: new Date().toISOString(),
      files: ["index.html"],
      size: "1 KB",
    };
    const infra = {
      success: true,
      uptimeSeconds: 100,
      healedCount: 0,
      totalLogsCount: 1,
      autoRepairEnabled: false,
      continuousMissionEnabled: false,
      memoryUsage: { rss: 10485760, heapUsed: 5242880 },
      healedIncidents: [],
      recentHealed: [],
      vmTenSystem: {
        runtimeVerified: false,
        status: "UNVERIFIED",
        snapshotsCount: 0,
      },
    };
    const messages = [
      {
        id: 1,
        direction: "incoming",
        sender: "TEST",
        recipient: "LOCAL_OPERATOR",
        content: "Wiadomość testowa",
        status: "received",
        created_at: new Date().toISOString(),
      },
    ];
    let approvals = [
      {
        id: "test-approval",
        agent: "Astyria",
        createdAt: Date.now(),
        description: "Zapis test.txt",
        action: { type: "write-file", path: "test.txt", content: "test" },
      },
    ];
    let saveFails = false;
    const writes = [];
    // Every API call is intercepted. Tests never write to the real backend or GitHub.
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const body = request.method() === "POST" ? request.postDataJSON() : null;
      if (body) writes.push({ path, body });
      let json = { success: true };
      if (path === "/api/kernel/state") json = { store };
      else if (path === "/api/kernel/script")
        json = { code: generatePythonMonolith(store) };
      else if (path === "/api/kernel/save-store") {
        if (saveFails)
          return route.fulfill({
            status: 503,
            json: { success: false, error: "Test: zapis niedostępny" },
          });
        Object.assign(store, body.store);
        json = { success: true, state: { store } };
      } else if (
        path === "/api/infrastructure/status" ||
        path === "/api/astyria/mission-status"
      )
        json = infra;
      else if (path === "/api/infrastructure/logs")
        json = {
          logs: [
            {
              id: "log-1",
              source: "KERNEL",
              level: "info",
              message: "Test logu",
              timestamp: "12:00",
            },
          ],
        };
      else if (path === "/api/infrastructure/processes")
        json = {
          processes: [
            {
              pid: 123,
              name: "backend-test",
              memory: "10 MB",
              status: "RUNNING",
              runtime: "100 s",
            },
          ],
        };
      else if (path === "/api/astyria/mission") {
        json = {
          success: true,
          reply: "Wynik testowej misji",
          state: { store },
        };
      } else if (path === "/api/chat/approvals")
        json = { success: true, approvals };
      else if (path === "/api/chat/approvals/test-approval") {
        approvals = [];
        json = { success: true, reply: "Odrzucono testową propozycję" };
      } else if (path === "/api/fleet")
        json = {
          success: true,
          timestamp: new Date().toISOString(),
          source: "test",
          vessels: [
            {
              id: "beta",
              name: "Beta",
              kind: "ship",
              missionPlan: "Test",
              missionStatus: "planned",
              connection: "recent-authenticated-report",
              position: {
                coordinateFrame: "heliocentric_ecliptic_J2000",
                xAu: 1,
                yAu: 1,
                zAu: 0,
              },
              lastObservationAt: new Date().toISOString(),
              provenance: null,
            },
            {
              id: "alfa",
              name: "Alfa",
              kind: "station",
              missionPlan: "Test",
              missionStatus: "planned",
              connection: "unverified",
              position: null,
              lastObservationAt: null,
              provenance: null,
            },
          ],
        };
      else if (path === "/api/apps/list")
        json = { apps: [app], totalApps: 1, storageUsed: "1 KB" };
      else if (path.endsWith("/files"))
        json = {
          files: [
            {
              name: "index.html",
              size: "1 KB",
              content: "<button>Test</button>",
              isDirectory: false,
            },
          ],
        };
      else if (path.startsWith("/api/apps/preview/"))
        return route.fulfill({
          contentType: "text/html",
          body: "<button>Test aplikacji</button>",
        });
      else if (path === "/api/explorer/files")
        json = {
          files: [
            {
              name: "raport.txt",
              type: "text",
              size: "1 KB",
              ctime: new Date().toISOString(),
            },
          ],
        };
      else if (path === "/api/triad/deploy/status") json = { pending: [] };
      else if (path === "/api/triad/git/status")
        json = {
          success: true,
          branch: "test-ui",
          repositoryUrl: null,
          dirtyFiles: 0,
          ahead: 0,
          behind: 0,
        };
      else if (path === "/api/hyper-com/transmissions") {
        if (body) {
          messages.push({
            id: 2,
            direction: "outgoing",
            sender: "LOCAL_OPERATOR",
            recipient: "TEST",
            content: body.content,
            status: "queued",
            created_at: new Date().toISOString(),
          });
        }
        json = { success: true, transmissions: messages };
      } else if (path === "/api/vm-gemini-4/status")
        json = {
          configured: false,
          name: "Gemini",
          provider: "Test",
          fallbackModels: [],
        };
      else if (request.method() !== "GET" && !path.endsWith("/save-file"))
        return route.fulfill({
          status: 403,
          json: { success: false, error: "Nieoczekiwana operacja testowa" },
        });
      await route.fulfill({ json });
    });
    await page.goto(baseURL);
    await page.getByRole("heading", { name: "Pulpit", exact: true }).waitFor();
    const navigate = async (tab) => {
      await page.evaluate((tab) => window.setActiveTab(tab), tab);
      await page
        .locator("nav button[aria-current=page]")
        .waitFor({ state: "attached" });
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
    };
    for (const tab of tabs) {
      await navigate(tab);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${layout}/${tab}: horizontal overflow`,
      );
      assert.equal(
        await page.locator("main img").count(),
        0,
        `${tab}: no image-based interface`,
      );
      await page.screenshot({ path: `${output}/${layout}-${tab}.png` });
    }
    await navigate("comms");
    await page.getByRole("button", { name: "Kopiuj kod", exact: true }).click();
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      "npm test",
    );
    await page
      .getByRole("button", { name: "Cytuj wiadomość 2", exact: true })
      .click();
    assert.match(
      await page
        .getByRole("textbox", { name: "Wiadomość", exact: true })
        .inputValue(),
      /^> ## Wynik/,
    );
    await page
      .getByRole("textbox", { name: "Szukaj wiadomości" })
      .fill("niewystępujące");
    assert.equal(await page.locator(".chat-message").count(), 0);
    await navigate("schema_graph");
    await page.getByRole("button", { name: "Sprawdź schemat" }).click();
    await page
      .getByText("Schemat i odczyt monolitu: poprawne.", { exact: true })
      .waitFor();
    await page
      .getByRole("textbox", { name: "Filtruj pamięć" })
      .fill("nieistniejący");
    await page.getByText("Brak wyników.", { exact: true }).waitFor();
    await navigate("visualizer");
    await page
      .getByRole("button", { name: "Rozmiar danych", exact: true })
      .click();
    await page.getByRole("button", { name: /config.*B$/ }).click();
    await page.locator(".code-inspector pre").waitFor();
    await navigate("process_matrix");
    await page.getByRole("button", { name: "Procesy", exact: true }).click();
    await page.getByText("backend-test", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Szczegóły 123" }).click();
    await page
      .getByRole("heading", { name: "Inspektor", exact: true })
      .waitFor();
    await navigate("astyria_mission");
    await page.getByRole("button", { name: "Wykonaj", exact: true }).click();
    await page.getByText("Wynik testowej misji", { exact: true }).waitFor();
    assert(
      writes.some(
        (write) =>
          write.path === "/api/astyria/mission" &&
          write.body.action === "deep_scan",
      ),
    );
    await navigate("temporal");
    await page
      .getByRole("button", { name: "Migawki sesji", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Nazwa migawki" }).fill("Test");
    await page.getByRole("button", { name: "Utwórz", exact: true }).click();
    await page.getByText("Test", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Wydania", exact: true }).click();
    await navigate("datastore");
    await page
      .getByRole("textbox", { name: "Filtruj konfigurację" })
      .fill("sys_version");
    await page.getByRole("button", { name: "JSON", exact: true }).click();
    const editor = page.getByRole("textbox", { name: "Edytor JSON" });
    await editor.fill("{");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    assert.equal(
      writes.filter((w) => w.path === "/api/kernel/save-store").length,
      0,
      "invalid JSON never sent",
    );
    await editor.fill(JSON.stringify(store));
    saveFails = true;
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    await page.getByText("HTTP 503", { exact: true }).waitFor();
    assert.equal(
      await page.getByText("Zapisano rejestr.", { exact: true }).count(),
      0,
    );
    saveFails = false;
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    await page.getByText("Zapisano rejestr.", { exact: true }).waitFor();
    await navigate("monolith");
    await page.getByRole("button", { name: "Importuj", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Import kodu Python" })
      .fill("niepoprawny import");
    const beforeInvalidImport = writes.length;
    await page
      .getByRole("button", { name: "Zapisz import", exact: true })
      .click();
    await page.getByRole("alert").waitFor();
    assert.equal(
      writes.length,
      beforeInvalidImport,
      "invalid Python import never sent",
    );
    await navigate("fleet");
    await page.getByPlaceholder("Token dostępu").fill("test-only");
    await page.getByRole("button", { name: "Połącz", exact: true }).click();
    await page
      .getByRole("button", { name: /Alfa.*Stacja.*Niezweryfikowane/ })
      .waitFor();
    await page
      .getByRole("button", { name: "Z telemetrią", exact: true })
      .click();
    assert.equal(
      await page.getByRole("button", { name: /Alfa.*Stacja/ }).count(),
      0,
    );
    await page.getByRole("button", { name: "Mapa", exact: true }).click();
    const point = page.getByRole("button", {
      name: "Wybierz Beta",
      exact: true,
    });
    await point.focus();
    await page.keyboard.press("Enter");
    assert.equal(await point.getAttribute("aria-pressed"), "true");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Eksport", exact: true }).click();
    assert.equal((await download).suggestedFilename(), "flota.json");
    await page.getByRole("button", { name: "Odłącz", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Eksport", exact: true })
        .isDisabled(),
      true,
    );
    await navigate("apps");
    await page
      .getByRole("button", { name: "Nowa aplikacja", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Nowa aplikacja", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    await page
      .getByRole("button", { name: "Kod", exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: "Kod aplikacji" })
      .fill("<button>Zmieniono</button>");
    await page
      .getByRole("button", { name: "Zapisz plik", exact: true })
      .click();
    assert(
      writes.some(
        (write) =>
          write.path.endsWith("/save-file") &&
          write.body.content.includes("Zmieniono"),
      ),
    );
    await navigate("file_explorer");
    await page.getByRole("textbox", { name: "Szukaj plików" }).fill("brak");
    await page.getByText("Brak wyników.", { exact: true }).waitFor();
    await navigate("hyper_com");
    await page.getByRole("button", { name: "Odpowiedz #1" }).click();
    await page
      .getByRole("textbox", { name: "Treść", exact: true })
      .fill("Odpowiedź testowa");
    await page
      .getByRole("button", { name: "Dodaj do kolejki", exact: true })
      .click();
    await page.getByText("Zapisano lokalnie.", { exact: true }).waitFor();
    assert(
      writes.some(
        (write) =>
          write.path === "/api/hyper-com/transmissions" &&
          write.body.action === "reply" &&
          write.body.replyTo === 1,
      ),
    );
    await navigate("approvals");
    await page.getByRole("button", { name: "Odrzuć", exact: true }).click();
    await page
      .getByText("Odrzucono testową propozycję", { exact: true })
      .waitFor();
    await navigate("without_nlp");
    await page.getByRole("button", { name: "Pauza", exact: true }).click();
    await page.getByRole("button", { name: "Wznów", exact: true }).waitFor();
    await navigate("terminal");
    await page.getByRole("button", { name: "Wyczyść", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Polecenie terminala" })
      .fill("status");
    assert.equal(
      await page
        .getByRole("textbox", { name: "Polecenie terminala" })
        .inputValue(),
      "status",
    );
    await page.getByLabel("Akcje systemu").click();
    await page.getByRole("button", { name: "Raport", exact: true }).click();
    await page.getByRole("dialog", { name: "Raport systemu" }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    if (layout === "mobile") {
      await page.getByRole("button", { name: "Więcej", exact: true }).click();
      await page.getByRole("button", { name: "Misje", exact: true }).click();
      await page.getByRole("heading", { name: "Misje", exact: true }).waitFor();
    }
    await context.close();
    console.log(
      `PASS ${layout}: 18 views and editor, dialog, chat, API-action checks`,
    );
  }
  assert.deepEqual(errors, [], "No browser errors");
} finally {
  await browser.close();
}
