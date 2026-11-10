import React, { useMemo, useState } from "react";
import { DataStore } from "../kernel/svlKernel";
import {
  CodeInspector,
  EmptyState,
  ModuleHeader,
  Panel,
  Segments,
} from "./WorkspaceUI";

export const TriadVisualization: React.FC<{ dataStore: DataStore }> = ({
  dataStore,
}) => {
  const [mode, setMode] = useState<"agents" | "storage">("agents");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () =>
      mode === "agents"
        ? Object.entries(
            dataStore.chat_history.reduce<Record<string, number>>(
              (all, msg) => {
                all[msg.agent] = (all[msg.agent] || 0) + 1;
                return all;
              },
              {},
            ),
          ).map(([label, value]) => ({ label, value, unit: "wiadomości" }))
        : Object.entries(dataStore).map(([label, value]) => ({
            label,
            value: new Blob([JSON.stringify(value)]).size,
            unit: "B",
          })),
    [dataStore, mode],
  );
  const visible = rows.filter((r) =>
    r.label.toLocaleLowerCase("pl").includes(query.toLocaleLowerCase("pl")),
  );
  const max = Math.max(1, ...rows.map((r) => r.value));
  const messages = dataStore.chat_history.filter(
    (msg) => msg.agent === selected,
  );
  return (
    <section className="module-view module-page">
      <ModuleHeader title="Wizualizator" meta="Dane bieżącego rejestru">
        <Segments
          label="Wykres"
          value={mode}
          options={[
            ["agents", "Wiadomości"],
            ["storage", "Rozmiar danych"],
          ]}
          onChange={(value) => {
            setMode(value);
            setSelected(null);
          }}
        />
      </ModuleHeader>
      <label className="workspace-search">
        <input
          aria-label="Filtruj wykres"
          placeholder="Filtruj…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="module-columns">
        <Panel
          title={
            mode === "agents"
              ? "Wiadomości według autora"
              : "Rozmiar JSON UTF-8"
          }
        >
          {visible.length ? (
            <div className="module-chart">
              {visible.map((row) => (
                <button
                  key={row.label}
                  type="button"
                  aria-pressed={selected === row.label}
                  onClick={() => setSelected(row.label)}
                >
                  <i style={{ width: `${(row.value / max) * 100}%` }} />
                  <span>{row.label}</span>
                  <strong>
                    {row.value} {row.unit}
                  </strong>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState>Brak danych.</EmptyState>
          )}
        </Panel>
        <Panel title={selected || "Szczegóły"}>
          {selected ? (
            <CodeInspector
              code={JSON.stringify(
                mode === "agents"
                  ? messages
                  : dataStore[selected as keyof DataStore],
                null,
                2,
              )}
              filename="wizualizator.json"
            />
          ) : (
            <EmptyState>Wybierz pasek wykresu.</EmptyState>
          )}
        </Panel>
      </div>
    </section>
  );
};
