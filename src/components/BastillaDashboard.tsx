import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Brain,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  FileCode2,
  FolderOpen,
  Github,
  LayoutGrid,
  MessagesSquare,
  Orbit,
  Radio,
  Send,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { TabId } from './Navigation';
import { DataStore } from '../kernel/svlKernel';
import { FormattedMessage } from './FormattedMessage';

interface BastillaDashboardProps {
  dataStore: DataStore;
  onNavigate: (tab: TabId) => void;
  onSendMessage: (message: string) => Promise<void>;
}

interface BastillaStatus {
  systemVersion: string;
  appCount: number | null;
  continuousMission: boolean | null;
  error: string | null;
}

const featureLaunchers: Array<{
  id: TabId;
  title: string;
  description: string;
  icon: typeof Activity;
}> = [
  { id: 'comms', title: 'Protokół Triady', description: 'Jawne polecenia deterministyczne dla agentów', icon: MessagesSquare },
  { id: 'process_matrix', title: 'Infrastruktura', description: 'Stan usług, logi i naprawa', icon: Cpu },
  { id: 'astyria_mission', title: 'Centrum misji', description: 'Misje, synchronizacja i snapshoty', icon: Sparkles },
  { id: 'terminal', title: 'Terminal', description: 'Konsola jądra i polecenia systemowe', icon: Terminal },
  { id: 'apps', title: 'Studio aplikacji', description: 'Instaluj, uruchamiaj i podglądaj aplikacje', icon: LayoutGrid },
  { id: 'file_explorer', title: 'Pliki i eksporty', description: 'Eksplorator RING-0 i przechowywanie', icon: FolderOpen },
  { id: 'datastore', title: 'DATA_STORE', description: 'Dane systemowe i konfiguracja', icon: Database },
  { id: 'temporal', title: 'Chronolit', description: 'Historia zmian i migawki', icon: Clock3 },
  { id: 'diagnostics', title: 'Telemetria', description: 'Diagnostyka i pomiary środowiska', icon: Activity },
  { id: 'visualizer', title: 'Wizualizacje 3D', description: 'Wizualizator Triady', icon: Orbit },
  { id: 'monolith', title: 'Monolit Python', description: 'Kod i eksport jądra', icon: FileCode2 },
  { id: 'schema_graph', title: 'Mapa pamięci', description: 'Schemat danych i relacje', icon: Brain },
  { id: 'without_nlp', title: 'Silnik without_nlp', description: 'Deterministyczny rdzeń harmoniczny', icon: Sparkles },
  { id: 'github', title: 'Synchronizacja GitHub', description: 'Eksport i synchronizacja repozytorium', icon: Github },
];

export const BastillaDashboard: React.FC<BastillaDashboardProps> = ({
  dataStore,
  onNavigate,
  onSendMessage,
}) => {
  const [terminalInput, setTerminalInput] = useState('');
  const [isTerminalLoading, setIsTerminalLoading] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [status, setStatus] = useState<BastillaStatus>({
    systemVersion: 'SVL Kernel',
    appCount: null,
    continuousMission: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const refreshStatus = async () => {
      try {
        const [infrastructureResponse, missionResponse, appsResponse] = await Promise.all([
          fetch('/api/infrastructure/status', { cache: 'no-store' }),
          fetch('/api/astyria/mission-status', { cache: 'no-store' }),
          fetch('/api/apps/list', { cache: 'no-store' }),
        ]);
        const responses = [infrastructureResponse, missionResponse, appsResponse];
        const failedResponse = responses.find((response) => !response.ok);
        if (failedResponse) {
          throw new Error(`Status API: HTTP ${failedResponse.status}`);
        }
        const [infrastructure, mission, apps] = await Promise.all(
          responses.map((response) => response.json())
        );
        if (!active) return;
        setStatus({
          systemVersion: String(infrastructure.sysVersion || mission.sysVersion || 'SVL Kernel'),
          appCount: Number.isFinite(apps.totalApps) ? apps.totalApps : null,
          continuousMission: typeof mission.continuousMissionEnabled === 'boolean'
            ? mission.continuousMissionEnabled
            : null,
          error: null,
        });
      } catch (error) {
        if (!active) return;
        setStatus((previous) => ({
          ...previous,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    };

    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const handleTerminalSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const command = terminalInput.trim();
    if (!command || isTerminalLoading) return;
    setIsTerminalLoading(true);
    setTerminalError(null);
    try {
      await onSendMessage(command);
      setTerminalInput('');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTerminalError(message);
    } finally {
      setIsTerminalLoading(false);
    }
  };

  const recentMessages = dataStore.chat_history.slice(-5);

  return (
    <section className="cyber-grid flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[#050b18] p-3 text-slate-100 sm:p-5 lg:p-7">
      <div className="mx-auto w-full max-w-[1500px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-400/20 bg-[#081326]/90 px-4 py-3 shadow-[0_12px_42px_rgba(2,8,23,0.6)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/30 bg-blue-950 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.16)]">
              <Orbit className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-[0.16em] text-white">BASTILLA<span className="text-cyan-300">OS</span></div>
              <div className="text-[10px] font-mono tracking-wider text-blue-200/60">DEBIAN 13 · SVL HYPERSPACE DESKTOP</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-950/40 px-2.5 py-1 text-emerald-300">
              <Radio className="h-3 w-3" /> JĄDRO {status.systemVersion}
            </span>
            <span className="rounded-full border border-blue-300/20 bg-blue-950/40 px-2.5 py-1 text-blue-200/80">
              {status.appCount === null ? 'APLIKACJE: —' : `${status.appCount} MODUŁÓW`}
            </span>
            <span className="rounded-full border border-blue-300/20 bg-blue-950/40 px-2.5 py-1 text-blue-200/80">
              {status.continuousMission === null ? 'MISJA: —' : status.continuousMission ? 'MISJA: AKTYWNA' : 'MISJA: WSTRZYMANA'}
            </span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-950/40 px-2.5 py-1 text-cyan-200">
              PROTOKÓŁ TRIADY · DETERMINISTYCZNY
            </span>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
          <section className="relative overflow-hidden rounded-2xl border border-blue-400/20 bg-gradient-to-br from-[#0c1b36] via-[#081326] to-[#07101e] p-5 sm:p-7">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-1/3 h-px w-2/3 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-mono font-bold tracking-[0.25em] text-cyan-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
                SYSTEM ONLINE · DEBIAN GNU/LINUX
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                Enter the <span className="text-transparent bg-gradient-to-r from-blue-300 to-cyan-200 bg-clip-text">Hyperspace</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-blue-100/65">
                Jeden pulpit dla poleceń jądra, protokołu Triady i narzędzi systemowych. Wybierz moduł albo wykonaj jawne polecenie w terminalu.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => onNavigate('terminal')} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-950/50 px-3.5 py-2 text-xs font-bold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-900/50">
                  <Terminal className="h-4 w-4" /> Pełny terminal <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onNavigate('comms')} className="inline-flex items-center gap-2 rounded-lg border border-blue-200/15 bg-blue-950/40 px-3.5 py-2 text-xs font-bold text-blue-100 transition hover:border-blue-200/40 hover:bg-blue-900/40">
                  <MessagesSquare className="h-4 w-4" /> Otwórz protokół Triady <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </section>

          <section className="flex flex-col justify-between gap-4 rounded-2xl border border-blue-300/15 bg-[#081326]/90 p-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-100">
                <Sparkles className="h-4 w-4 text-cyan-300" /> Polecenia Triady
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Wpisz wiadomość w czacie; rdzeń without_nlp zapisze ją i wykona deterministyczną analizę sygnału, bez interpretowania języka naturalnego.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('comms')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-gradient-to-r from-blue-700/80 to-cyan-700/70 px-4 py-3 text-xs font-bold text-white transition hover:brightness-110"
            >
              <MessagesSquare className="h-4 w-4" />
              Otwórz polecenia protokołu
            </button>
          </section>
        </div>

        {status.error && (
          <p role="status" className="rounded-xl border border-amber-400/20 bg-amber-950/20 px-4 py-2 text-xs text-amber-100">
            Nie udało się odświeżyć telemetrii ({status.error}). Pozostałe funkcje są dostępne.
          </p>
        )}

        <div className="grid min-h-[460px] gap-4 xl:grid-cols-2">
          <section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-2xl border border-blue-300/20 bg-[#081326]/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between border-b border-blue-200/10 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-50">
                <MessagesSquare className="h-4 w-4 text-cyan-300" /> CZAT WITHOUT_NLP
              </div>
              <span className="text-[10px] font-mono text-blue-200/50">{dataStore.chat_history.length} WIADOMOŚCI</span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              {recentMessages.length === 0 && <p className="text-xs text-slate-500">Wpisz wiadomość poniżej. Wynik deterministycznej analizy pojawi się tutaj.</p>}
              {recentMessages.map((message, index) => (
                <article key={`${message.agent}-${index}`} className={`rounded-xl border p-3 ${message.agent === 'Mateusz Mitek' || message.agent === 'Operator' ? 'ml-5 border-blue-300/15 bg-blue-950/40' : 'mr-5 border-cyan-300/15 bg-slate-950/50'}`}>
                  <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                    <CheckCircle2 className="h-3 w-3" /> {message.agent}
                  </div>
                  <FormattedMessage content={message.tekst} className="text-xs leading-relaxed text-slate-200" />
                </article>
              ))}
            </div>
          </section>

          <section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-2xl border border-blue-300/20 bg-[#060d1a] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between border-b border-blue-200/10 bg-[#0a1527] px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-50">
                <MessagesSquare className="h-4 w-4 text-cyan-300" /> WIADOMOŚĆ DO ASTYRII
              </div>
              <span className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> KERNEL LINK</span>
            </div>
            <div className="relative min-h-0 flex-1 overflow-y-auto p-4">
              <div aria-hidden="true" className="pointer-events-none absolute right-4 top-3 select-none text-right font-mono text-[9px] leading-4 tracking-[0.2em] text-cyan-300/[0.08]">
                01001000 01011001<br />01010000 01000101<br />01010010 01010011<br />01010000 01000001<br />01000011 01000101
              </div>
              <div aria-live="polite" className="relative space-y-3">
                {recentMessages.slice(-3).map((message, index) => (
                  <article key={`${message.agent}-${index}`} className={`rounded-lg border p-3 ${message.agent === 'Mateusz Mitek' || message.agent === 'Operator' ? 'border-purple-300/15 bg-purple-950/30' : 'border-cyan-300/15 bg-slate-950/60'}`}>
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-200">{message.agent}</div>
                    <FormattedMessage content={message.tekst} className="whitespace-pre-wrap text-[11px] leading-relaxed text-cyan-100/85" />
                  </article>
                ))}
              </div>
              {isTerminalLoading && <p role="status" className="mt-3 animate-pulse text-[10px] font-mono text-cyan-300">Analiza deterministyczna without_nlp…</p>}
              {terminalError && <p role="alert" className="mt-2 text-[10px] text-rose-300">{terminalError}</p>}
            </div>
            <form onSubmit={handleTerminalSubmit} className="border-t border-blue-200/10 bg-[#081326] p-3">
              <label htmlFor="hyperspace-command" className="mb-2 block text-[9px] font-mono tracking-wider text-blue-200/50">WIADOMOŚĆ · maksymalnie 2000 znaków</label>
              <div className="flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-[#030813] px-3 focus-within:border-cyan-300/50">
                <input
                  id="hyperspace-command"
                  type="text"
                  value={terminalInput}
                  onChange={(event) => setTerminalInput(event.target.value)}
                  maxLength={2000}
                  placeholder="Wpisz wiadomość do Astyrii…"
                  disabled={isTerminalLoading}
                  className="min-w-0 flex-1 bg-transparent py-3 font-mono text-xs text-white outline-none placeholder:text-slate-700"
                />
                <button type="submit" aria-label="Wyślij wiadomość" disabled={!terminalInput.trim() || isTerminalLoading} className="grid h-8 w-8 place-items-center rounded-md text-cyan-200 transition hover:bg-cyan-950 disabled:opacity-30">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </section>
        </div>

        <section className="pb-2">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-50">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Moduły systemowe
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">Narzędzia SVL dostępne w tym środowisku</p>
            </div>
            <span className="font-mono text-[9px] text-blue-200/45">BASTILLAOS · DEBIAN LIVE</span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {featureLaunchers.map(({ id, title, description, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className="group flex min-h-20 items-start gap-3 rounded-xl border border-blue-200/10 bg-[#081326]/80 p-3 text-left transition hover:border-cyan-300/30 hover:bg-[#0b1b34]"
              >
                <span className="rounded-lg border border-blue-200/10 bg-blue-950/60 p-2 text-cyan-200 transition group-hover:border-cyan-300/30">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[11px] font-bold text-slate-100">{title}</span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
};
