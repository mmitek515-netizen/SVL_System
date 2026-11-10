import React, { useState } from "react";
import { RefreshCw, Search, Wrench } from "lucide-react";
import { usePollingJSON, postJSON } from "../hooks/usePollingJSON";
import {
  CodeInspector,
  EmptyState,
  Metric,
  ModuleHeader,
  Panel,
  Segments,
} from "./WorkspaceUI";

export const TaskProcessMatrix: React.FC = () => {
  const [tab, setTab] = useState<"logs" | "processes" | "incidents">("logs");
  const [filter, setFilter] = useState<"all" | "errors" | "healed">("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const status = usePollingJSON<any>("/api/infrastructure/status");
  const logs = usePollingJSON<{ logs: any[] }>(
    `/api/infrastructure/logs?filter=${filter}`,
    5000,
  );
  const processes = usePollingJSON<{ processes: any[] }>(
    "/api/infrastructure/processes",
    5000,
  );
  const run = async (url: string, body?: unknown) => {
    setBusy(true);
    setActionError("");
    try {
      const result = await postJSON<any>(url, body);
      setNotice(result.message || "Zapisano.");
      await Promise.all([status.refresh(), logs.refresh()]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Błąd operacji");
    } finally {
      setBusy(false);
    }
  };
  const visible = (
    tab === "logs"
      ? logs.data?.logs || []
      : tab === "processes"
        ? processes.data?.processes || []
        : status.data?.healedIncidents || []
  ).filter((row: any) =>
    JSON.stringify(row)
      .toLocaleLowerCase("pl")
      .includes(query.toLocaleLowerCase("pl")),
  );
  return (
    <section className="module-view module-page">
      <ModuleHeader
        title="Infrastruktura"
        meta={
          status.error
            ? "Odczyt nieaktualny"
            : status.data
              ? "API połączone"
              : "Łączenie…"
        }
      >
        <button
          type="button"
          disabled={busy || !status.data || !!status.error}
          aria-pressed={status.data?.autoRepairEnabled === true}
          onClick={() =>
            void run("/api/infrastructure/toggle-auto-repair", {
              enabled: !status.data?.autoRepairEnabled,
            })
          }
        >
          Autonaprawa:{" "}
          {status.data ? (status.data.autoRepairEnabled ? "wł." : "wył.") : "—"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run("/api/infrastructure/repair-now")}
        >
          <Wrench size={14} />
          {busy ? "Przetwarzanie…" : "Skanuj logi"}
        </button>
        <button
          type="button"
          onClick={() => {
            void status.refresh();
            void logs.refresh();
            void processes.refresh();
          }}
        >
          <RefreshCw size={14} />
          Odśwież
        </button>
      </ModuleHeader>
      {(status.error || logs.error || processes.error || actionError) && (
        <p role="alert">
          {actionError || status.error || logs.error || processes.error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="module-metrics">
        <Metric
          label="Czas pracy backendu"
          value={status.data ? `${status.data.uptimeSeconds} s` : null}
        />
        <Metric label="Wpisy logów" value={status.data?.totalLogsCount} />
        <Metric label="Naprawy" value={status.data?.healedCount} />
        <Metric
          label="Pamięć RSS backendu"
          value={
            status.data?.memoryUsage?.rss
              ? `${(status.data.memoryUsage.rss / 1048576).toFixed(1)} MB`
              : null
          }
        />
      </div>
      <div className="module-actions">
        <Segments
          label="Dane infrastruktury"
          value={tab}
          options={[
            ["logs", "Logi"],
            ["processes", "Procesy"],
            ["incidents", "Naprawy"],
          ]}
          onChange={(v) => {
            setTab(v);
            setSelected(null);
          }}
        />
        <label className="workspace-search">
          <Search size={14} />
          <input
            aria-label="Szukaj w infrastrukturze"
            placeholder="Szukaj…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {tab === "logs" && (
          <select
            aria-label="Poziom logów"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">Wszystkie</option>
            <option value="errors">Błędy</option>
            <option value="healed">Naprawione</option>
          </select>
        )}
      </div>
      <Panel
        title={
          tab === "logs"
            ? "Logi"
            : tab === "processes"
              ? "Procesy backendu"
              : "Naprawy"
        }
      >
        {visible.length === 0 ? (
          <EmptyState>
            {logs.loading || processes.loading ? "Odczyt…" : "Brak wpisów."}
          </EmptyState>
        ) : (
          <div className="module-list">
            {visible.map((row: any, i: number) => (
              <div key={row.id || row.pid || i} className="module-row">
                <div>
                  <strong>{row.name || row.title || row.source}</strong>
                  <p>
                    {row.message ||
                      row.resolution ||
                      `${row.memory} · ${row.runtime}`}
                  </p>
                  <span className="module-meta">
                    {row.timestamp || `PID ${row.pid}`} ·{" "}
                    {row.level || row.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  aria-label={`Szczegóły ${row.id || row.pid || i}`}
                >
                  Szczegóły
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {selected && (
        <Panel
          title="Inspektor"
          actions={
            <button type="button" onClick={() => setSelected(null)}>
              Zamknij
            </button>
          }
        >
          <CodeInspector
            code={JSON.stringify(selected, null, 2)}
            filename="infrastruktura.json"
          />
        </Panel>
      )}
    </section>
  );
};
