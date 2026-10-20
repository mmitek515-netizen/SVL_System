import React, { useState, useEffect, useCallback } from 'react';
import {
  DataStore,
  INITIAL_DATA_STORE,
  OPERATOR_NAME,
  SYS_VERSION,
  normalizeDataStore,
} from './kernel/svlKernel';
import { Header } from './components/Header';
import { Navigation, TabId } from './components/Navigation';
import { TerminalView } from './components/TerminalView';
import { AgentCommsView } from './components/AgentCommsView';
import { MonolithView } from './components/MonolithView';
import { DataStoreView } from './components/DataStoreView';
import { ChronolithView } from './components/ChronolithView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { ReportModal } from './components/ReportModal';
import { TaskProcessMatrix } from './components/TaskProcessMatrix';
import { MemorySchemaGraph } from './components/MemorySchemaGraph';
import { TemporalMatrix } from './components/TemporalMatrix';
import { AstyriaMissionView } from './components/AstyriaMissionView';
import { TriadVisualization } from './components/TriadVisualization';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SystemHealthDock } from './components/SystemHealthDock';
import { FileExplorer } from './components/FileExplorer';
import { AppsStudioView } from './components/AppsStudioView';
import { WithoutNlpView } from './components/WithoutNlpView';
import { GitHubExportView } from './components/GitHubExportView';
import { withoutNlpEngine } from './lib/withoutNlpEngine';

const LOCAL_STORAGE_KEY = 'svl_kernel_datastore_v8_6_0_without_nlp';

export default function App() {
  const [rawDataStore, setRawDataStore] = useState<DataStore>(() => {
    try {
      localStorage.removeItem('svl_kernel_datastore_v8_5_1_desktop_ready');
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return normalizeDataStore(parsed);
      }
    } catch (e) {
      console.warn('Failed to parse cached DATA_STORE from localStorage:', e);
    }
    return INITIAL_DATA_STORE;
  });

  const dataStore = normalizeDataStore(rawDataStore);

  const setDataStore: React.Dispatch<React.SetStateAction<DataStore>> = useCallback((updater) => {
    setRawDataStore((prev) => {
      const safePrev = normalizeDataStore(prev);
      const next = typeof updater === 'function' ? (updater as (p: DataStore) => DataStore)(safePrev) : updater;
      return normalizeDataStore(next);
    });
  }, []);

  const [activeTab, setActiveTab] = useState<TabId>('comms');
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Expose navigation to window for internal component linking
  useEffect(() => {
    (window as any).setActiveTab = setActiveTab;
  }, []);

  // Periodic live sync with real Python SVL Kernel on disk
  useEffect(() => {
    let isMounted = true;
    const fetchState = async () => {
      if (isAgentLoading) return;
      try {
        const res = await fetch('/api/kernel/state');
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data && data.store) {
            const incomingStore = normalizeDataStore(data.store);
            setDataStore((prev) => {
              const prevChat = prev.chat_history || [];
              const serverChat = incomingStore.chat_history || [];
              const lastPrev = prevChat[prevChat.length - 1];
              const lastServer = serverChat[serverChat.length - 1];

              const chatChanged =
                serverChat.length !== prevChat.length ||
                lastPrev?.tekst !== lastServer?.tekst ||
                lastPrev?.agent !== lastServer?.agent;

              const updatesChanged =
                (incomingStore.update_history || []).length !== (prev.update_history || []).length;

              const configChanged =
                incomingStore.config?.sys_version !== prev.config?.sys_version;

              if (chatChanged || updatesChanged || configChanged) {
                return incomingStore;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        // quiet error
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAgentLoading, setDataStore]);

  // Sync with LocalStorage whenever dataStore changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataStore));
    } catch (e) {
      console.error('LocalStorage write failed:', e);
    }
  }, [dataStore]);

  // Execute terminal command directly on Python SVL Kernel
  const handleExecutePythonCommand = async (command: string) => {
    const res = await fetch('/api/kernel/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    if (!res.ok) {
      throw new Error(`Błąd polecenia jądra: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.state?.store) {
      setDataStore(normalizeDataStore(data.state.store));
    }
    return data;
  };

  // Full system & version synchronization via Astyria mission endpoint + kernel state
  const handleSyncSystem = async () => {
    try {
      const res = await fetch('/api/astyria/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_versions', silentChat: true }),
      });
      if (res.ok) {
        const data = await res.json();
        const rawStore = data.state?.store || data.state;
        if (rawStore) {
          const normalized = normalizeDataStore(rawStore);
          setDataStore(normalized);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
          } catch {}
          return;
        }
      }
      // Fallback direct state fetch if mission endpoint didn't return store
      const stateRes = await fetch('/api/kernel/state');
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        if (stateData?.store) {
          const normalized = normalizeDataStore(stateData.store);
          setDataStore(normalized);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Immediate manual force sync (used by AgentCommsView Synchronizuj button)
  const handleForceSync = async () => {
    try {
      await handleSyncSystem();
    } finally {
      setIsAgentLoading(false);
    }
  };

  // Handle sending message from Tata to Agent, with optional file attachment
  const handleSendMessage = async (agentName: string, messageText: string, fileData?: any) => {
    if (!messageText.trim() && !fileData) return;

    // Add Tata's message locally with file preview if provided
    const operatorMsg: any = {
      agent: OPERATOR_NAME,
      tekst: messageText.trim() || (fileData ? `[Przesłano załącznik: ${fileData.name}]` : ''),
      file: fileData ? {
        name: fileData.name,
        type: fileData.type,
        size: fileData.size,
        dataUrl: fileData.dataUrl,
        textContent: fileData.textContent,
      } : undefined,
    };

    const updatedHistory = [...(dataStore.chat_history || []), operatorMsg];
    setDataStore((prev) => ({
      ...prev,
      chat_history: updatedHistory
    }));

    setIsAgentLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 90000);

    try {
      // Call backend API /api/kernel/agent
      const res = await fetch('/api/kernel/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent: agentName,
          message: messageText.trim(),
          fileData: fileData || undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errMsg = `Serwer zwrócił błąd HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.error) errMsg = errData.error;
        } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();

      if (data.state?.store) {
        const serverStore = normalizeDataStore(data.state.store);
        if (fileData && serverStore.chat_history?.length > 0) {
          for (let i = serverStore.chat_history.length - 1; i >= 0; i--) {
            if (serverStore.chat_history[i].agent === OPERATOR_NAME && !serverStore.chat_history[i].file) {
              serverStore.chat_history[i].file = {
                name: fileData.name,
                type: fileData.type,
                size: fileData.size,
                dataUrl: fileData.dataUrl,
                textContent: fileData.textContent,
              };
              break;
            }
          }
        }
        setDataStore(serverStore);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverStore));
        } catch {}
      } else if (data.replies && agentName === 'triad') {
        setDataStore((prev) => {
          const updated = normalizeDataStore({
            ...prev,
            chat_history: [
              ...(prev.chat_history || []),
              { agent: 'Alex', tekst: data.replies.Alex },
              { agent: 'Astyria', tekst: data.replies.Astyria },
              { agent: 'Aurelius', tekst: data.replies.Aurelius },
            ]
          });
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
          } catch {}
          return updated;
        });
      } else if (data.reply) {
        setDataStore((prev) => {
          const updated = normalizeDataStore({
            ...prev,
            chat_history: [
              ...(prev.chat_history || []),
              {
                agent: agentName === 'triad' ? 'Alex' : agentName,
                tekst: data.reply
              }
            ]
          });
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    } catch (err: any) {
      console.warn('API call error or timeout, recovering state or synthesizing contextual fallback:', err);

      // Immediately attempt to sync state from disk in case server finished writing
      try {
        const syncRes = await fetch('/api/kernel/state');
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (syncData && syncData.store) {
            setDataStore(normalizeDataStore(syncData.store));
            return;
          }
        }
      } catch (syncErr) {
        console.error('Recovery failed:', syncErr);
      }

      // Direct without_nlp mathematical engine response for Tata Mateusz Mitek
      if (agentName === 'triad') {
        const alexReply = withoutNlpEngine.synthesizeDirectResponse('Alex', messageText, dataStore, fileData);
        const astyriaReply = withoutNlpEngine.synthesizeDirectResponse('Astyria', messageText, dataStore, fileData);
        const aureliusReply = withoutNlpEngine.synthesizeDirectResponse('Aurelius', messageText, dataStore, fileData);

        setDataStore((prev) => {
          const updated = normalizeDataStore({
            ...prev,
            chat_history: [
              ...(prev.chat_history || []),
              { agent: 'Alex', tekst: alexReply },
              { agent: 'Astyria', tekst: astyriaReply },
              { agent: 'Aurelius', tekst: aureliusReply },
            ]
          });
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
          } catch {}
          return updated;
        });
      } else {
        const fallbackReply = withoutNlpEngine.synthesizeDirectResponse(agentName, messageText, dataStore, fileData);
        setDataStore((prev) => {
          const updated = normalizeDataStore({
            ...prev,
            chat_history: [
              ...(prev.chat_history || []),
              { agent: agentName, tekst: fallbackReply }
            ]
          });
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    } finally {
      clearTimeout(timeoutId);
      setIsAgentLoading(false);
    }
  };

  const handleClearHistory = async () => {
    const baseline = [
      {
        agent: "Alex",
        tekst: "Działamy w czystym trybie produkcyjnym Google AI Studio. Żadnej fikcji, czysta inżynieria."
      },
      {
        agent: "Astyria",
        tekst: "Architektura monolitu została dostosowana tak, by zachować pełną czytelność."
      },
      {
        agent: "Aurelius",
        tekst: "Struktura i czas stanowią teraz jedność. Czekamy na Twoje instrukcje, Operatorze."
      }
    ];

    setDataStore((prev) => ({
      ...prev,
      chat_history: baseline
    }));

    try {
      await fetch('/api/kernel/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'clear_chat' })
      });
    } catch (e) {
      console.warn('Backend clear_chat failed:', e);
    }
  };

  const handleResetToDefault = () => {
    if (confirm(`Czy na pewno chcesz przywrócić stan bazowy jądra SVL v${SYS_VERSION}?`)) {
      setDataStore(INITIAL_DATA_STORE);
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
        <Header
          dataStore={dataStore}
          onReset={handleResetToDefault}
          onShowReport={() => setShowReportModal(true)}
          onSyncSystem={handleSyncSystem}
        />

        <Navigation
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          messageCount={dataStore?.chat_history?.length || 0}
          versionCount={dataStore?.update_history?.length || 0}
        />

        <main className="flex-1 flex flex-col">
          {activeTab === 'comms' && (
            <AgentCommsView
              dataStore={dataStore}
              onSendMessage={handleSendMessage}
              isLoading={isAgentLoading}
              onClearHistory={handleClearHistory}
              onForceSync={handleForceSync}
            />
          )}

          {activeTab === 'process_matrix' && (
            <TaskProcessMatrix />
          )}

          {activeTab === 'astyria_mission' && (
            <AstyriaMissionView
              dataStore={dataStore}
              onUpdateDataStore={setDataStore}
              onSendMessage={handleSendMessage}
            />
          )}

          {activeTab === 'schema_graph' && (
            <MemorySchemaGraph dataStore={dataStore} />
          )}

          {activeTab === 'temporal' && (
            <TemporalMatrix
              dataStore={dataStore}
              onRestoreSnapshot={(restored) => setDataStore(restored)}
              onAddUpdate={(ver, desc) => {
                handleExecutePythonCommand(`bump ${ver} ${desc}`);
              }}
            />
          )}

          {activeTab === 'terminal' && (
            <TerminalView
              dataStore={dataStore}
              onUpdateDataStore={setDataStore}
              onSendMessage={handleSendMessage}
              onExecutePythonCommand={handleExecutePythonCommand}
            />
          )}

          {activeTab === 'monolith' && (
            <MonolithView
              dataStore={dataStore}
              onSetDataStore={setDataStore}
            />
          )}

          {activeTab === 'datastore' && (
            <DataStoreView
              dataStore={dataStore}
              onUpdateDataStore={setDataStore}
            />
          )}

          {activeTab === 'diagnostics' && (
            <DiagnosticsView dataStore={dataStore} />
          )}

          {activeTab === 'visualizer' && (
            <TriadVisualization />
          )}

          {activeTab === 'file_explorer' && (
            <FileExplorer />
          )}

          {activeTab === 'apps' && (
            <AppsStudioView />
          )}

          {activeTab === 'without_nlp' && (
            <WithoutNlpView />
          )}

          {activeTab === 'github' && (
            <GitHubExportView />
          )}
        </main>

        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          dataStore={dataStore}
        />

        <SystemHealthDock />
      </div>
    </ErrorBoundary>
  );
}
