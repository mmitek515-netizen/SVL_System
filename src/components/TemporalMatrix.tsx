import React, { useState } from "react";
import { DataStore, SYS_VERSION } from "../kernel/svlKernel";
import { Camera, Plus, RotateCcw } from "lucide-react";
import {
  CodeInspector,
  Disclosure,
  EmptyState,
  ModuleHeader,
  Panel,
  Segments,
} from "./WorkspaceUI";
interface Snapshot {
  id: string;
  name: string;
  timestamp: string;
  version: string;
  store: DataStore;
}
export const TemporalMatrix: React.FC<{
  dataStore: DataStore;
  onRestoreSnapshot: (store: DataStore) => void;
  onAddUpdate: (wersja: string, opis: string) => void;
}> = ({ dataStore, onRestoreSnapshot, onAddUpdate }) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [description, setDescription] = useState("");
  const [tab, setTab] = useState<"releases" | "snapshots">("releases");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const history = [...dataStore.update_history]
    .reverse()
    .filter((row) =>
      (row.wersja + " " + row.opis)
        .toLocaleLowerCase("pl")
        .includes(query.toLocaleLowerCase("pl")),
    );
  return (
    <section className="module-view module-page">
      <ModuleHeader
        title="Historia"
        meta={`${dataStore.update_history.length} wydań`}
      />
      <Segments
        label="Historia systemu"
        value={tab}
        options={[
          ["releases", "Wydania"],
          ["snapshots", "Migawki sesji"],
        ]}
        onChange={setTab}
      />
      {notice && <p role="status">{notice}</p>}
      {tab === "releases" ? (
        <>
          <Disclosure title="Nowe wydanie">
            <form
              className="module-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (version.trim() && description.trim()) {
                  onAddUpdate(version.trim(), description.trim());
                  setVersion("");
                  setDescription("");
                  setNotice("Przekazano zapis wydania do jądra.");
                }
              }}
            >
              <label>
                Wersja
                <input
                  required
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  maxLength={100}
                />
              </label>
              <label>
                Opis
                <input
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                />
              </label>
              <div>
                <button type="submit">
                  <Plus size={14} />
                  Zapisz wydanie
                </button>
              </div>
            </form>
          </Disclosure>
          <input
            aria-label="Szukaj wydań"
            placeholder="Wersja lub opis…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Panel title="Wydania">
            {history.length ? (
              <div className="module-list">
                {history.map((row, i) => (
                  <details key={i} className="module-disclosure">
                    <summary>
                      {row.wersja}{" "}
                      <span className="module-meta">· {row.data}</span>
                    </summary>
                    <p>{row.opis}</p>
                  </details>
                ))}
              </div>
            ) : (
              <EmptyState>Brak wydań.</EmptyState>
            )}
          </Panel>
        </>
      ) : (
        <>
          <Panel
            title="Nowa migawka"
            actions={
              <span className="module-meta">
                Przechowywana do opuszczenia widoku
              </span>
            }
          >
            <form
              className="module-actions"
              onSubmit={(e) => {
                e.preventDefault();
                const serialized = JSON.stringify(dataStore);
                const snap = {
                  id: crypto.randomUUID(),
                  name: name.trim() || `Migawka ${snapshots.length + 1}`,
                  timestamp: new Date().toLocaleString("pl"),
                  version: dataStore.config.sys_version || SYS_VERSION,
                  store: JSON.parse(serialized),
                };
                setSnapshots((prev) => [snap, ...prev]);
                setName("");
                setNotice("Utworzono migawkę sesji.");
              }}
            >
              <input
                aria-label="Nazwa migawki"
                placeholder="Nazwa migawki…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
              <button type="submit">
                <Camera size={14} />
                Utwórz
              </button>
            </form>
          </Panel>
          <Panel title="Migawki">
            {snapshots.length ? (
              <div className="module-list">
                {snapshots.map((snap) => (
                  <div key={snap.id} className="module-panel">
                    <div className="module-row">
                      <div>
                        <strong>{snap.name}</strong>
                        <p>
                          {snap.timestamp} · {snap.version}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(`Przywrócić migawkę „${snap.name}”?`)
                          ) {
                            onRestoreSnapshot(
                              JSON.parse(JSON.stringify(snap.store)),
                            );
                            setNotice(`Przywrócono: ${snap.name}`);
                          }
                        }}
                      >
                        <RotateCcw size={14} />
                        Przywróć
                      </button>
                    </div>
                    <Disclosure title="Dane migawki">
                      <CodeInspector
                        code={JSON.stringify(snap.store, null, 2)}
                        filename="migawka.json"
                      />
                    </Disclosure>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>Utwórz pierwszą migawkę.</EmptyState>
            )}
          </Panel>
        </>
      )}
    </section>
  );
};
