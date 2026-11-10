import React, { useMemo, useState } from "react";
import {
  DataStore,
  generatePythonMonolith,
  parsePythonMonolith,
} from "../kernel/svlKernel";
import { Search, ShieldCheck } from "lucide-react";
import {
  CodeInspector,
  EmptyState,
  Metric,
  ModuleHeader,
  Panel,
} from "./WorkspaceUI";

export const MemorySchemaGraph: React.FC<{ dataStore: DataStore }> = ({
  dataStore,
}) => {
  const [selected, setSelected] = useState("config");
  const [query, setQuery] = useState("");
  const [audit, setAudit] = useState<string | null>(null);
  const nodes = useMemo(
    () => [
      { id: "root", label: "Cały rejestr", value: dataStore },
      { id: "config", label: "Konfiguracja", value: dataStore.config },
      {
        id: "update_history",
        label: "Wydania",
        value: dataStore.update_history,
      },
      {
        id: "chat_history",
        label: "Wiadomości",
        value: dataStore.chat_history,
      },
    ],
    [dataStore],
  );
  const node = nodes.find((n) => n.id === selected)!;
  const entries = Object.entries(node.value).filter(([key, value]) =>
    (key + " " + JSON.stringify(value))
      .toLocaleLowerCase("pl")
      .includes(query.toLocaleLowerCase("pl")),
  );
  return (
    <section className="module-view module-page">
      <ModuleHeader title="Pamięć" meta="Inspektor danych">
        <button
          type="button"
          onClick={() => {
            try {
              const parsed = parsePythonMonolith(
                generatePythonMonolith(dataStore),
              );
              const shape =
                typeof dataStore.config === "object" &&
                !Array.isArray(dataStore.config) &&
                Array.isArray(dataStore.update_history) &&
                Array.isArray(dataStore.chat_history);
              setAudit(
                parsed.success && shape
                  ? "Schemat i odczyt monolitu: poprawne."
                  : "Wykryto niezgodność schematu.",
              );
            } catch {
              setAudit("Nie udało się zweryfikować danych.");
            }
          }}
        >
          <ShieldCheck size={15} />
          Sprawdź schemat
        </button>
      </ModuleHeader>
      {audit && <p role="status">{audit}</p>}
      <div className="module-metrics">
        <Metric
          label="Konfiguracja"
          value={Object.keys(dataStore.config).length}
        />
        <Metric label="Wydania" value={dataStore.update_history.length} />
        <Metric label="Wiadomości" value={dataStore.chat_history.length} />
        <Metric
          label="JSON UTF-8"
          value={`${new Blob([JSON.stringify(dataStore)]).size} B`}
        />
      </div>
      <div className="module-columns">
        <Panel title="Struktura">
          <div className="module-list">
            {nodes.map((n) => (
              <button
                type="button"
                key={n.id}
                aria-pressed={selected === n.id}
                onClick={() => {
                  setSelected(n.id);
                  setQuery("");
                  setAudit(null);
                }}
                className="justify-between"
              >
                <span>{n.label}</span>
                <span className="module-meta">
                  {Object.keys(n.value).length}
                </span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title={node.label}>
          <label className="workspace-search">
            <Search size={15} />
            <input
              aria-label="Filtruj pamięć"
              placeholder="Klucz lub wartość…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {entries.length === 0 ? (
            <EmptyState>Brak wyników.</EmptyState>
          ) : (
            <CodeInspector
              code={JSON.stringify(Object.fromEntries(entries), null, 2)}
              filename={`${selected}.json`}
            />
          )}
        </Panel>
      </div>
    </section>
  );
};
