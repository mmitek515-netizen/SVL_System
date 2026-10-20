import React, { useState, useEffect, useCallback } from 'react';
import {
  DataStore,
  INITIAL_DATA_STORE,
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
import { BastillaDashboard } from './components/BastillaDashboard';
import {
  AstyriaMissionAction,
  AgentProtocolRequest,
  isAgentProtocolCommand,
  isTriadAgent,
} from './kernel/agentProtocol';

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

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
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

  const handleSendProtocol = async (request: AgentProtocolRequest) => {
    setIsAgentLoading(true);
    setAgentError(null);

    try {
      if (
        !request ||
        !isAgentProtocolCommand(request.command) ||
        (request.agent !== 'triad' && !isTriadAgent(request.agent))
      ) {
        throw new Error('Nieprawidłowe polecenie protokołu operatora.');
      }

      const response = await fetch('/api/triad/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        let message = `Serwer zwrócił błąd HTTP ${response.status}`;
        try {
          const errorData: unknown = await response.json();
          if (
            errorData &&
            typeof errorData === 'object' &&
            'error' in errorData &&
            typeof errorData.error === 'string'
          ) {
            message = errorData.error;
          }
        } catch {}
        throw new Error(message);
      }

      const result: unknown = await response.json();
      const resultRecord = result && typeof result === 'object' ? result as Record<string, unknown> : null;
      const stateRecord = resultRecord?.state && typeof resultRecord.state === 'object'
        ? resultRecord.state as Record<string, unknown>
        : null;
      const returnedStore = stateRecord?.store;
      if (
        !returnedStore ||
        typeof returnedStore !== 'object' ||
        Array.isArray(returnedStore) ||
        !('config' in returnedStore) ||
        !('chat_history' in returnedStore) ||
        !('update_history' in returnedStore) ||
        !returnedStore.config ||
        typeof returnedStore.config !== 'object' ||
        !Array.isArray(returnedStore.chat_history) ||
        !Array.isArray(returnedStore.update_history)
      ) {
        throw new Error('Serwer zwrócił nieprawidłowy stan DATA_STORE dla polecenia protokołu.');
      }

      const normalized = normalizeDataStore(returnedStore as DataStore);
      setDataStore(normalized);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : 'Nie udało się wykonać polecenia protokołu.');
      throw err;
    } finally {
      setIsAgentLoading(false);
    }
  };

  const handleRunAstyriaMission = async (action: AstyriaMissionAction) => {
    setIsAgentLoading(true);
    setAgentError(null);
    try {
      const response = await fetch('/api/astyria/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true || typeof result.reply !== 'string') {
        throw new Error(result.error || `Nie udało się wykonać misji Astyrii (HTTP ${response.status}).`);
      }
      const store = result.state?.store;
      if (
        !store ||
        typeof store !== 'object' ||
        !Array.isArray(store.chat_history) ||
        !store.chat_history.some((message: unknown) =>
          message !== null &&
          typeof message === 'object' &&
          'agent' in message &&
          'tekst' in message &&
          (message as { agent?: unknown }).agent === 'Astyria' &&
          (message as { tekst?: unknown }).tekst === result.reply
        )
      ) {
        throw new Error('Misja zwróciła wynik, ale nie potwierdziła zapisu odpowiedzi Astyrii w historii czatu.');
      }
      const normalized = normalizeDataStore(store as DataStore);
      setDataStore(normalized);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się wykonać misji Astyrii.';
      setAgentError(message);
      throw error;
    } finally {
      setIsAgentLoading(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    setIsAgentLoading(true);
    setAgentError(null);
    try {
      const response = await fetch('/api/triad/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) {
        throw new Error(result.error || `Nie udało się wysłać wiadomości (HTTP ${response.status}).`);
      }
      const normalized = normalizeDataStore(result.state?.store);
      const expectedTranscript = [
        { agent: 'Mateusz Mitek', tekst: message.trim() },
        { agent: 'Astyria', tekst: result.reply },
      ];
      const history = normalized.chat_history;
      const persisted = history.some((entry, start) =>
        expectedTranscript.every((expected, index) =>
          history[start + index]?.agent === expected.agent &&
          history[start + index]?.tekst === expected.tekst
        )
      );
      if (!persisted || typeof result.reply !== 'string') {
        throw new Error('Serwer nie potwierdził zapisu wiadomości i odpowiedzi.');
      }
      setDataStore(normalized);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Nie udało się wysłać wiadomości.';
      setAgentError(messageText);
      throw error;
    } finally {
      setIsAgentLoading(false);
    }
  };

  const handleClearHistory = async () => {
    setDataStore((prev) => ({
      ...prev,
      chat_history: []
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
      <div className="flex min-h-dvh min-w-0 max-w-full flex-col overflow-x-hidden bg-[#050b18] font-sans text-slate-100 selection:bg-cyan-400/30 selection:text-cyan-100">
        <Header
          dataStore={dataStore}
          onReset={handleResetToDefault}
          onShowReport={() => setShowReportModal(true)}
          onSyncSystem={handleSyncSystem}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          <Navigation
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            messageCount={dataStore?.chat_history?.length || 0}
            versionCount={dataStore?.update_history?.length || 0}
          />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
          {activeTab === 'home' && (
            <BastillaDashboard
              dataStore={dataStore}
              onNavigate={setActiveTab}
              onSendMessage={handleSendMessage}
            />
          )}

          {activeTab === 'comms' && (
            <AgentCommsView
              dataStore={dataStore}
              onSendProtocol={handleSendProtocol}
              onSendMessage={handleSendMessage}
              onRunAstyriaMission={handleRunAstyriaMission}
              isLoading={isAgentLoading}
              sendError={agentError}
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
              onSendProtocol={handleSendProtocol}
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
        </div>

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
