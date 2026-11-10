import React, { useState } from "react";
import { DataStore, SYS_VERSION } from "../kernel/svlKernel";
import { Play, RefreshCw } from "lucide-react";
import { usePollingJSON, postJSON } from "../hooks/usePollingJSON";
import { ChatMessage } from "./ChatMessage";
import {
  CodeInspector,
  EmptyState,
  Metric,
  ModuleHeader,
  Panel,
  Segments,
} from "./WorkspaceUI";

const ACTIONS = [
  ["deep_scan", "Skan logów"],
  ["vm_firewall_audit", "Audyt zapory"],
  ["vm_snapshot_now", "Migawka VM"],
  ["vm_memory_optimize", "Optymalizuj pamięć"],
  ["repair_schemas", "Sprawdź schemat"],
  ["sync_versions", "Synchronizuj wersję"],
  ["internet_self_update", "Aktualizuj z GitHub"],
  ["ollama_optimize", "Konfiguruj Ollamę"],
  ["deploy_vm_ten_system", "Wdróż ulepszenia VM"],
  ["unblock", "Odblokuj czat"],
  ["full_system_app_chat_repair", "Napraw system"],
] as const;
export const AstyriaMissionView: React.FC<{
  dataStore: DataStore;
  onUpdateDataStore: React.Dispatch<React.SetStateAction<DataStore>>;
}> = ({ dataStore, onUpdateDataStore }) => {
  const status = usePollingJSON<any>("/api/astyria/mission-status", 10000);
  const [tab, setTab] = useState<"actions" | "logs" | "vm">("actions");
  const [action, setAction] = useState<string>("deep_scan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [replies, setReplies] = useState<{ tekst: string; time: string }[]>([]);
  const [notice, setNotice] = useState("");
  const vm = status.data?.vmTenSystem;
  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await postJSON<any>("/api/astyria/mission", { action });
      if (data.state?.store) onUpdateDataStore(data.state.store);
      else if (data.reply)
        onUpdateDataStore((prev) => ({
          ...prev,
          chat_history: [
            ...prev.chat_history,
            { agent: "Astyria", tekst: data.reply },
          ],
        }));
      if (data.reply)
        setReplies((prev) => [
          { tekst: data.reply, time: new Date().toLocaleTimeString("pl") },
          ...prev,
        ]);
      await status.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd misji");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="module-view module-page">
      <ModuleHeader
        title="Misje"
        meta={dataStore.config.sys_version || SYS_VERSION}
      >
        <button
          type="button"
          disabled={busy || !status.data || !!status.error}
          aria-pressed={status.data?.continuousMissionEnabled === true}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await postJSON("/api/mission/toggle", {
                enabled: !status.data?.continuousMissionEnabled,
              });
              await status.refresh();
              setNotice("Zapisano ustawienie misji.");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Błąd zapisu");
            } finally {
              setBusy(false);
            }
          }}
        >
          Misja ciągła:{" "}
          {status.data
            ? status.data.continuousMissionEnabled
              ? "wł."
              : "wył."
            : "—"}
        </button>
        <button type="button" onClick={() => void status.refresh()}>
          <RefreshCw size={14} />
          Odśwież
        </button>
      </ModuleHeader>
      {(error || status.error) && <p role="alert">{error || status.error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="module-metrics">
        <Metric
          label="VM"
          value={vm?.runtimeVerified ? vm.status : "Niezweryfikowana"}
        />
        <Metric label="Naprawy" value={status.data?.healedCount} />
        <Metric label="Migawki" value={vm?.snapshotsCount} />
        <Metric
          label="RSS backendu"
          value={
            vm?.memoryTelemetry?.rssMB !== undefined
              ? `${vm.memoryTelemetry.rssMB} MB`
              : null
          }
        />
      </div>
      <Segments
        label="Panel misji"
        value={tab}
        options={[
          ["actions", "Akcje"],
          ["logs", "Dziennik"],
          ["vm", "Maszyna wirtualna"],
        ]}
        onChange={setTab}
      />
      {tab === "actions" && (
        <Panel title="Uruchom akcję">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run();
            }}
            className="module-form"
          >
            <label>
              Akcja
              <select
                aria-label="Akcja misji"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                disabled={busy}
              >
                {ACTIONS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="module-actions">
              <button type="submit" className="primary-action" disabled={busy}>
                <Play size={14} />
                {busy ? "Przetwarzanie…" : "Wykonaj"}
              </button>
              <button
                type="button"
                onClick={() => (window as any).setActiveTab?.("file_explorer")}
              >
                Otwórz pliki
              </button>
            </div>
          </form>
          {replies[0] && (
            <ChatMessage
              agent="Astyria"
              content={replies[0].tekst}
              index={replies.length - 1}
            />
          )}
        </Panel>
      )}
      {tab === "logs" && (
        <div className="module-columns">
          <Panel title="Wyniki tej sesji">
            {replies.length ? (
              replies.map((reply, i) => (
                <div key={i}>
                  <span className="module-meta">{reply.time}</span>
                  <ChatMessage
                    agent="Astyria"
                    content={reply.tekst}
                    index={replies.length - i - 1}
                  />
                </div>
              ))
            ) : (
              <EmptyState>Brak wykonanych akcji.</EmptyState>
            )}
          </Panel>
          <Panel title="Ostatnie naprawy">
            <div className="module-list">
              {status.data?.recentHealed?.length ? (
                status.data.recentHealed.map((item: any) => (
                  <details key={item.id} className="module-disclosure">
                    <summary>{item.actionTaken}</summary>
                    <p>{item.resolution}</p>
                    <span className="module-meta">{item.timestamp}</span>
                  </details>
                ))
              ) : (
                <EmptyState>Brak wpisów.</EmptyState>
              )}
            </div>
          </Panel>
        </div>
      )}
      {tab === "vm" && (
        <Panel title="VM_Ten_System">
          <CodeInspector
            code={JSON.stringify(vm || { status: "unverified" }, null, 2)}
            filename="vm-status.json"
          />
        </Panel>
      )}
    </section>
  );
};
