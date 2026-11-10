import React, { useState } from "react";
import { DataStore } from "../kernel/svlKernel";
import { RefreshCw } from "lucide-react";
import { usePollingJSON, postJSON } from "../hooks/usePollingJSON";
import {
  CodeInspector,
  Metric,
  ModuleHeader,
  Panel,
  Segments,
} from "./WorkspaceUI";

export const DiagnosticsView: React.FC<{
  dataStore: DataStore;
  onUpdateDataStore?: (store: DataStore) => void;
}> = ({ dataStore, onUpdateDataStore }) => {
  const status = usePollingJSON<any>("/api/infrastructure/status");
  const [tab, setTab] = useState<"memory" | "config">("memory");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const memory = status.data?.memoryUsage;
  const bytes = (n: number | undefined) =>
    typeof n === "number" ? `${(n / 1048576).toFixed(1)} MB` : "—";
  return (
    <section className="module-view module-page">
      <ModuleHeader
        title="Telemetria"
        meta={
          status.error
            ? "API niezweryfikowane"
            : status.data
              ? "Odczyt backendu"
              : "Łączenie…"
        }
      >
        <button
          type="button"
          onClick={() => void status.refresh()}
          disabled={status.loading}
        >
          <RefreshCw size={14} />
          Odśwież
        </button>
      </ModuleHeader>
      {(status.error || error) && <p role="alert">{error || status.error}</p>}
      <div className="module-metrics">
        <Metric label="RSS" value={bytes(memory?.rss)} />
        <Metric label="Heap" value={bytes(memory?.heapUsed)} />
        <Metric label="Wiadomości" value={dataStore.chat_history.length} />
        <Metric
          label="Rejestr UTF-8"
          value={`${new Blob([JSON.stringify(dataStore)]).size} B`}
        />
      </div>
      <Panel
        title="Tryb lokalny"
        actions={
          <button
            type="button"
            disabled={busy}
            aria-pressed={dataStore.config.sovereign_mode !== false}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const result = await postJSON<any>("/api/kernel/sovereignty", {
                  sovereign_mode: dataStore.config.sovereign_mode === false,
                });
                if (result.state?.store)
                  onUpdateDataStore?.(result.state.store);
                await status.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Błąd zapisu");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? "Zapisywanie…"
              : dataStore.config.sovereign_mode !== false
                ? "Włączony"
                : "Wyłączony"}
          </button>
        }
      >
        <span className="module-meta">Konfiguracja jądra</span>
      </Panel>
      <Segments
        label="Inspektor telemetrii"
        value={tab}
        options={[
          ["memory", "Pamięć backendu"],
          ["config", "Konfiguracja"],
        ]}
        onChange={setTab}
      />
      <Panel title={tab === "memory" ? "node:process" : "DATA_STORE.config"}>
        <CodeInspector
          code={JSON.stringify(
            tab === "memory"
              ? memory || { status: "unverified" }
              : dataStore.config,
            null,
            2,
          )}
          filename="telemetria.json"
        />
      </Panel>
    </section>
  );
};
