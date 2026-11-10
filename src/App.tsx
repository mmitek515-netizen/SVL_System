import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  DataStore,
  INITIAL_DATA_STORE,
  SYS_VERSION,
  normalizeDataStore,
} from './kernel/svlKernel';
import { Header } from './components/Header';
import { Navigation, TabId, initialTabFromLocation } from './components/Navigation';
import { TerminalView } from './components/TerminalView';
import { AgentCommsView } from './components/AgentCommsView';
import { ChatApprovalsView } from './components/ChatApprovalsView';
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
import { FleetView } from './components/FleetView';
import { BastillaDashboard } from './components/BastillaDashboard';
import {
  AstyriaMissionAction,
  AgentProtocolReply,
  AgentProtocolRequest,
  isAgentProtocolCommand,
  isTriadAgent,
  parseChatProtocolCommand,
  TRIAD_AGENT_NAMES,
} from './kernel/agentProtocol';
import { ChatAttachment, formatChatMessage } from './kernel/chatAttachments';
import { isChatSystemChange } from './kernel/chatChanges';
import type { ChatSystemChange } from './kernel/chatChanges';
import { canApplyPolledState, isKernelSnapshot } from './kernel/globalSync';

const LOCAL_STORAGE_KEY = 'svl_kernel_datastore_v8_6_0_without_nlp';
const HYPERSPACE_ENTERED_KEY = 'bastilla_svl_hyperspace_entered_v1';

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

  const dataStore = useMemo(() => normalizeDataStore(rawDataStore), [rawDataStore]);
  const syncGenerationRef = useRef(0);
  const [kernelSyncStatus, setKernelSyncStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');

  const setDataStore: React.Dispatch<React.SetStateAction<DataStore>> = useCallback((updater) => {
    // Invalidate poll responses started before any user action or server write.
    syncGenerationRef.current += 1;
    setRawDataStore((prev) => {
      const safePrev = normalizeDataStore(prev);
      const next = typeof updater === 'function' ? (updater as (p: DataStore) => DataStore)(safePrev) : updater;
      // Avoid unnecessary writes to localStorage and cross-tab re-fetch loops.
      if (JSON.stringify(safePrev) === JSON.stringify(next)) return prev;
      return normalizeDataStore(next);
    });
  }, []);

  const [activeTab, setActiveTab] = useState<TabId>(initialTabFromLocation);
  const [hasEnteredHyperspace, setHasEnteredHyperspace] = useState(() => {
    try { return localStorage.getItem(HYPERSPACE_ENTERED_KEY) === 'true'; } catch { return false; }
  });
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [chatSystemChange, setChatSystemChange] = useState<ChatSystemChange | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Expose navigation to window for internal component linking
  useEffect(() => {
    (window as any).setActiveTab = setActiveTab;
  }, []);

  // Ref mirrors isAgentLoading so in-flight polls never overwrite a freshly returned chat state
  const isAgentLoadingRef = useRef(isAgentLoading);
  useEffect(() => {
    isAgentLoadingRef.current = isAgentLoading;
  }, [isAgentLoading]);

  // Server state is authoritative. Poll without overlapping requests and refresh
  // immediately when a tab becomes active or another tab changes its local cache.
  useEffect(() => {
    let mounted = true;
    let inFlight = false;
    const fetchState = async () => {
      if (!mounted || inFlight || isAgentLoadingRef.current) return;
      inFlight = true;
      const startedGeneration = syncGenerationRef.current;
      try {
        const response = await fetch('/api/kernel/state', { cache: 'no-store' });
        if (!response.ok) throw new Error('Kernel HTTP ' + response.status);
        const snapshot: unknown = await response.json();
        if (!isKernelSnapshot(snapshot)) throw new Error('Invalid kernel snapshot');
        if (!mounted) return;
        setKernelSyncStatus('online');
        if (canApplyPolledState(startedGeneration, syncGenerationRef.current, isAgentLoadingRef.current)) {
          const incoming = normalizeDataStore(snapshot.store);
          setDataStore((previous) =>
            JSON.stringify(previous) === JSON.stringify(incoming) ? previous : incoming
          );
        }
      } catch {
        if (mounted) setKernelSyncStatus('offline');
      } finally {
        inFlight = false;
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchState();
    };
    const refreshOnStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_KEY) void fetchState();
    };
    void fetchState();
    const interval = window.setInterval(() => void fetchState(), 4000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('storage', refreshOnStorage);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('storage', refreshOnStorage);
    };
  }, [setDataStore]);

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

  // "Synchronizuj" must refresh the persisted kernel state, not run an
  // Astyria mission that rewrites system configuration and snapshots.
  const handleSyncSystem = async (): Promise<void> => {
    try {
      const response = await fetch('/api/kernel/state?fresh=1', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Odczyt jądra nie powiódł się (HTTP ${response.status}).`);
      const snapshot: unknown = await response.json();
      if (!isKernelSnapshot(snapshot)) {
        throw new Error('Serwer nie zwrócił prawidłowego stanu DATA_STORE.');
      }
      setDataStore(normalizeDataStore(snapshot.store));
      setKernelSyncStatus('online');
    } catch (error) {
      setKernelSyncStatus('offline');
      throw error;
    }
  };

  const handleForceSync = async () => {
    try {
      await handleSyncSystem();
      setAgentError(null);
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : 'Synchronizacja jądra nie powiodła się.');
    }
  };

  const handleSendProtocol = async (request: AgentProtocolRequest): Promise<AgentProtocolReply | undefined> => {
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

      let agentReply: AgentProtocolReply | undefined;
      if (request.agent !== 'triad') {
        const replyRecord = resultRecord?.reply;
        if (
          !replyRecord ||
          typeof replyRecord !== 'object' ||
          Array.isArray(replyRecord) ||
          !('agent' in replyRecord) ||
          replyRecord.agent !== request.agent ||
          !('command' in replyRecord) ||
          replyRecord.command !== request.command ||
          !('data' in replyRecord) ||
          !replyRecord.data ||
          typeof replyRecord.data !== 'object' ||
          Array.isArray(replyRecord.data)
        ) {
          throw new Error('Serwer nie zwrócił prawidłowej odpowiedzi wybranego agenta.');
        }
        agentReply = {
          agent: request.agent,
          command: request.command,
          data: replyRecord.data as Record<string, unknown>,
        };
      }

      const normalized = normalizeDataStore(returnedStore as DataStore);
      setDataStore(normalized);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
      return agentReply;
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

  const handleSendMessage = async (
    message: string,
    chatAgent: AgentProtocolRequest['agent'] = 'triad',
    attachments: ChatAttachment[] = [],
  ) => {
    const protocolCommand = attachments.length === 0
      ? parseChatProtocolCommand(message, chatAgent)
      : null;
    if (protocolCommand) {
      await handleSendProtocol(protocolCommand);
      return;
    }

    setIsAgentLoading(true);
    setAgentError(null);
    try {
      const normalizedCommand = message
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pl-PL')
        .replace(/\s+/g, ' ');
      const isFullChatRepair = attachments.length === 0 && [
        'napraw to',
        'napraw czat',
        'pelna naprawa czatu',
        'odpowiedz pelna naprawa czatu',
      ].includes(normalizedCommand);
      const response = await fetch(isFullChatRepair ? '/api/astyria/mission' : '/api/triad/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isFullChatRepair
          ? { action: 'full_system_app_chat_repair', userMessage: message.trim() }
          : { message, agent: chatAgent, attachments }),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true || typeof result.reply !== 'string') {
        throw new Error(result.error || `Nie udało się wysłać wiadomości (HTTP ${response.status}).`);
      }
      const normalized = normalizeDataStore(result.state?.store);
      const expectedAgentReplies = isFullChatRepair
        ? [{ agent: 'Astyria', tekst: result.reply }]
        : chatAgent === 'triad'
        ? TRIAD_AGENT_NAMES.map((agent) => ({
            agent,
            tekst: result.replies?.[agent],
          }))
        : [{ agent: chatAgent, tekst: result.reply }];
      if (expectedAgentReplies.some((entry) => typeof entry.tekst !== 'string' || !entry.tekst.trim())) {
        throw new Error('Nie otrzymano odpowiedzi wszystkich wybranych agentów.');
      }
      const expectedTranscript = [
        {
          agent: 'Mateusz Mitek',
          tekst: attachments.length > 0
            ? formatChatMessage(message, attachments)
            : message.startsWith('/propose write-file ')
            ? message
            : message.trim(),
        },
        ...expectedAgentReplies,
      ];
      const history = normalized.chat_history;
      const persisted = history.some((entry, start) =>
        expectedTranscript.every((expected, index) =>
          history[start + index]?.agent === expected.agent &&
          history[start + index]?.tekst === expected.tekst
        )
      );
      if (!persisted) {
        throw new Error('Serwer nie potwierdził zapisu wiadomości i odpowiedzi.');
      }
      setDataStore(normalized);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
      setChatSystemChange(isChatSystemChange(result.change) ? result.change : null);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Nie udało się wysłać wiadomości.';
      setAgentError(messageText);
      throw error;
    } finally {
      setIsAgentLoading(false);
    }
  };

  const handleProvisionGeminiVm = async (): Promise<{ status: string; sshCommand: string }> => {
    const response = await fetch('/api/vm-gemini-4/provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'create',
        confirmation: 'CREATE_VM_GEMINI_4',
      }),
    });
    const result: unknown = await response.json();
    if (
      !response.ok ||
      !result ||
      typeof result !== 'object' ||
      !('success' in result) ||
      result.success !== true ||
      !('status' in result) ||
      typeof result.status !== 'string' ||
      !('sshCommand' in result) ||
      typeof result.sshCommand !== 'string'
    ) {
      const error = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
        ? result.error
        : `Nie udało się utworzyć VM (HTTP ${response.status}).`;
      throw new Error(error);
    }
    return { status: result.status, sshCommand: result.sshCommand };
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

  const handleResetToDefault = async () => {
    if (!confirm(`Przywrócić ustawienia fabryczne SVL v${SYS_VERSION}? Historia czatu i wydań zostanie wyczyszczona.`)) return;
    setIsAgentLoading(true);
    setAgentError(null);
    try {
      const response = await fetch('/api/kernel/save-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: INITIAL_DATA_STORE }),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true || !result.state?.store) {
        throw new Error(result.error || `Reset nie powiódł się (HTTP ${response.status}).`);
      }
      const normalized = normalizeDataStore(result.state.store);
      setDataStore(normalized);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : 'Nie udało się przywrócić ustawień fabrycznych.');
    } finally {
      setIsAgentLoading(false);
    }
  };

  const enterHyperspace = () => {
    try { localStorage.setItem(HYPERSPACE_ENTERED_KEY, 'true'); } catch {}
    setHasEnteredHyperspace(true);
  };

  if (!hasEnteredHyperspace) {
    return (
      <ErrorBoundary>
        <main className="hyperspace-screen relative isolate flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#030712] px-5 py-12 text-slate-100">
          <div className="hyperspace-stars" aria-hidden="true" />
          <div className="hyperspace-orbit" aria-hidden="true"><span /><i /></div>
          <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center">
            <div className="mb-8 flex items-center gap-3 rounded-full border border-cyan-300/20 bg-slate-950/60 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-cyan-100/75 shadow-[0_0_36px_rgba(34,211,238,0.08)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
              Świeży punkt startowy <span className="text-slate-600">/</span> SVL System
            </div>
            <div className="mb-5 grid h-20 w-20 place-items-center rounded-[1.7rem] border border-cyan-200/20 bg-cyan-300/[0.07] text-3xl font-light text-cyan-100 shadow-[0_0_55px_rgba(34,211,238,0.17),inset_0_0_30px_rgba(34,211,238,0.08)]">B</div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.48em] text-cyan-200/65">Bastilla OS</p>
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">SVL_System</h1>
            <p className="mt-5 max-w-xl text-pretty text-sm leading-7 text-slate-400 sm:text-base">Nowy start systemu. Wybierz wejście, aby otworzyć pulpit Bastilla i dostępne moduły SVL.</p>
            <button type="button" onClick={enterHyperspace} className="group mt-10 inline-flex min-h-14 items-center gap-4 rounded-full border border-cyan-200/40 bg-cyan-300/[0.09] px-8 text-sm font-semibold tracking-[0.18em] text-cyan-50 shadow-[0_0_42px_rgba(34,211,238,0.13)] transition duration-300 hover:border-cyan-100/80 hover:bg-cyan-200/[0.16] hover:shadow-[0_0_64px_rgba(34,211,238,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-4 focus-visible:ring-offset-slate-950">
              <span>ENTER HYPERSPACE</span><span aria-hidden="true" className="text-lg text-cyan-200 transition-transform group-hover:translate-x-1">→</span>
            </button>
            <div className="mt-12 grid w-full max-w-xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.08] bg-slate-950/55 px-4 py-3"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Interfejs</p><p className="mt-1 text-xs text-slate-200">Bastilla Dashboard</p></div>
              <div className="rounded-2xl border border-white/[0.08] bg-slate-950/55 px-4 py-3"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Jądro</p><p className="mt-1 text-xs text-slate-200">SVL Kernel UI</p></div>
              <div className="rounded-2xl border border-white/[0.08] bg-slate-950/55 px-4 py-3"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Tryb startu</p><p className="mt-1 text-xs text-emerald-300">Lokalna aplikacja</p></div>
            </div>
            <p className="mt-8 text-[10px] uppercase tracking-[0.22em] text-slate-600">Repozytorium aplikacji · main</p>
          </div>
        </main>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-dvh min-w-0 max-w-full flex-col overflow-x-hidden bg-[#050b18] font-sans text-slate-100 selection:bg-cyan-400/30 selection:text-cyan-100">
        <Header
          dataStore={dataStore}
          onReset={handleResetToDefault}
          onShowReport={() => setShowReportModal(true)}
          onSyncSystem={handleSyncSystem}
          kernelSyncStatus={kernelSyncStatus}
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
              onProvisionGeminiVm={handleProvisionGeminiVm}
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

          {activeTab === 'approvals' && (
            <ChatApprovalsView
              onUpdateDataStore={setDataStore}
              onChatChange={setChatSystemChange}
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
            <AppsStudioView
              chatChange={chatSystemChange}
              onChatChangeApplied={() => setChatSystemChange(null)}
            />
          )}

          {activeTab === 'fleet' && <FleetView />}

          {activeTab === 'hyper_com' && (
            <section className="flex min-h-0 flex-1 flex-col bg-slate-950">
              <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2">
                <h1 className="text-xs font-semibold text-cyan-200">HyperCom — konsola transmisji</h1>
                <a
                  href="/api/apps/preview/hyper_com_module/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-300 hover:text-cyan-100"
                >
                  Otwórz osobno
                </a>
              </header>
              <iframe
                src="/api/apps/preview/hyper_com_module/"
                title="HyperCom — konsola transmisji"
                className="min-h-0 w-full flex-1 border-0"
                sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
              />
            </section>
          )}

          {activeTab === 'without_nlp' && (
            <WithoutNlpView onSendProtocol={handleSendProtocol} />
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
