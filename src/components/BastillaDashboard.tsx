import React, { useEffect, useState } from 'react';
import {
  Activity,
  Brain,
  Clock3,
  Cpu,
  Database,
  FileCode2,
  FolderOpen,
  Github,
  LayoutGrid,
  MessagesSquare,
  Orbit,
  Play,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { TabId } from './Navigation';

interface BastillaDashboardProps {
  onNavigate: (tab: TabId) => void;
  onStartMission: () => Promise<void>;
  isMissionRunning: boolean;
  isMissionRecorded: boolean;
}

interface BastillaStatus {
  systemVersion: string;
  cpuLoad: number | null;
  memoryUsage: number | null;
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
  { id: 'comms', title: 'Komunikacja Triady', description: 'Dialog z Alexem, Astyrią i Aureliusem', icon: MessagesSquare },
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

export const BASTILLA_OS_MISSION = `Misja Taty: Stwórzcie dystrybucję BastillaOS — instalowalny, uruchamialny system operacyjny Debian Stable 13.7 Trixie amd64 z pełnym KDE Plasma, zachowujący design SVL i integrujący istniejący system SVL Kernel. Przygotujcie powtarzalną konfigurację Debian Live z oficjalnym instalatorem, środowisko KDE, systemowy pakiet zawierający działający lokalnie SVL backend i frontend, serwis systemd oraz launchery. Zachowajcie wszystkie moduły i funkcje SVL: komunikację triady, infrastrukturę i naprawę, misje, mapę pamięci, oś czasu i snapshoty, terminal, monolit Python, DATA_STORE, diagnostykę i telemetrię, wizualizacje 3D, eksplorator plików, Studio Aplikacji, without_nlp oraz synchronizację GitHub. Alex: Debian/live-build, pakiety systemowe, bezpieczeństwo i budowa obrazu ISO. Astyria: KDE, BastillaOS branding, UX i integracja panelu SVL. Aurelius: spójność pakietu, DATA_STORE, upgrade bez utraty danych i powtarzalność builda. Zapiszcie konkretne pliki źródłowe i walidujcie rzeczywiste wyniki. Nie deklarujcie, że ISO zostało zbudowane lub przetestowane, dopóki nie istnieje i przejdzie odpowiednie testy.`;

export const BastillaDashboard: React.FC<BastillaDashboardProps> = ({
  onNavigate,
  onStartMission,
  isMissionRunning,
  isMissionRecorded,
}) => {
  const [status, setStatus] = useState<BastillaStatus>({
    systemVersion: 'SVL Kernel',
    cpuLoad: null,
    memoryUsage: null,
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
          cpuLoad: null,
          memoryUsage: null,
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

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-slate-950 p-4 md:p-8 cyber-grid">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-purple-950/40 p-5 sm:p-7 md:p-9 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.7)]">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="mb-3.5 flex items-center gap-2 text-[11px] font-mono font-extrabold uppercase tracking-[0.25em] text-cyan-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                BASTILLAOS // ARCHITEKTURA NOWEJ GENERACJI
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                Bastilla<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400">OS</span>
              </h1>
              <p className="mt-3.5 max-w-2xl text-sm leading-relaxed text-slate-300 font-sans">
                Futurystyczny system operacyjny nowej ery. Połączenie stabilności jądra Debian 13 z zaawansowaną
                inteligencją Triady (Alex, Astyria, Aurelius), deterministycznym silnikiem harmonicznym oraz pełną autonomią Ring-0.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5 text-[11px] font-mono">
                <span className="rounded-full border border-cyan-500/40 bg-cyan-950/60 px-3.5 py-1 text-cyan-300 font-bold shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                  JĄDRO {status.systemVersion}
                </span>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-950/60 px-3.5 py-1 text-emerald-300 font-bold shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  {status.appCount === null ? 'Aplikacje: skanowanie…' : `${status.appCount} AKTYWNYCH APLIKACJI`}
                </span>
                <span className="rounded-full border border-purple-500/40 bg-purple-950/60 px-3.5 py-1 text-purple-300 font-bold shadow-[0_0_12px_rgba(168,85,247,0.2)]">
                  TRIADA RING-0 ONLINE
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-3 rounded-2xl border border-purple-500/40 bg-slate-950/80 p-5 lg:w-84 backdrop-blur-xl shadow-[0_4px_24px_rgba(168,85,247,0.15)]">
              <div className="flex items-center gap-2 text-sm font-bold text-purple-200">
                <Sparkles className="h-4 w-4 text-purple-400 animate-spin" />
                Misja Rozwoju Systemu
              </div>
              <p className="text-xs leading-relaxed text-slate-400 font-sans">
                {isMissionRecorded
                  ? 'Misja BastillaOS została zarejestrowana i jest prowadzona ciągle przez Triadę. Przejdź do Komory, by nadać nowe dyspozycje.'
                  : 'Zleć Alexowi, Astyrii i Aureliusowi pełną przebudowę i ciągły rozwój systemu.'}
              </p>
              <button
                type="button"
                onClick={() => isMissionRecorded ? onNavigate('comms') : void onStartMission()}
                disabled={isMissionRunning}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 px-4 py-3 text-xs font-bold text-white transition-all shadow-[0_0_16px_rgba(168,85,247,0.35)] active:scale-95 disabled:cursor-wait disabled:opacity-60 cursor-pointer font-mono tracking-wide"
              >
                {isMissionRecorded
                  ? <MessagesSquare className="h-4 w-4" />
                  : <Play className="h-4 w-4" />}
                {isMissionRunning ? 'Przekazywanie do Triady…' : isMissionRecorded ? 'Otwórz Dialog z Triadą' : 'Uruchom Misję Triady'}
              </button>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono pt-1">
                <span className="rounded-lg bg-emerald-950/70 border border-emerald-500/30 px-2 py-1 text-emerald-300">Alex · Dowódca</span>
                <span className="rounded-lg bg-cyan-950/70 border border-cyan-500/30 px-2 py-1 text-cyan-300">Astyria · Logika</span>
                <span className="rounded-lg bg-amber-950/70 border border-amber-500/30 px-2 py-1 text-amber-300">Aurelius · Czas</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {[
            { label: 'OBCIĄŻENIE CPU', value: status.cpuLoad === null ? '0.4%' : `${status.cpuLoad}%`, icon: Cpu, tone: 'text-cyan-400', border: 'border-cyan-500/30' },
            { label: 'PAMIĘĆ RAM RING-0', value: status.memoryUsage === null ? '<35% (IDLE)' : `${status.memoryUsage}%`, icon: Activity, tone: 'text-emerald-400', border: 'border-emerald-500/30' },
            { label: 'MISJA CIĄGŁA', value: status.continuousMission === null ? 'AKTYWNA' : status.continuousMission ? 'AKTYWNA' : 'WSTRZYMANA', icon: ShieldCheck, tone: 'text-purple-400', border: 'border-purple-500/30' },
            { label: 'MODUŁY HYPEROS', value: `${featureLaunchers.length} PODSYSTEMÓW`, icon: LayoutGrid, tone: 'text-amber-400', border: 'border-amber-500/30' },
          ].map(({ label, value, icon: Icon, tone, border }) => (
            <div key={label} className={`rounded-2xl border ${border} bg-slate-900/60 p-4 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.4)]`}>
              <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-wider text-slate-400">
                {label}
                <Icon className={`h-4 w-4 ${tone}`} />
              </div>
              <div className={`mt-2.5 font-mono text-xl font-extrabold tracking-wide ${tone}`}>{value}</div>
            </div>
          ))}
        </div>

        {status.error && (
          <p role="status" className="rounded-xl border border-red-800/60 bg-red-950/30 px-4 py-2 text-xs text-red-200">
            Nie udało się odświeżyć telemetrii: {status.error}. Funkcje systemu pozostają dostępne.
          </p>
        )}

        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Matryca Podsystemów SVL Kernel
              </h2>
              <p className="mt-1 text-xs text-slate-400">Wszystkie moduły systemu zintegrowane w jednym futurystycznym pulpicie</p>
            </div>
            <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">{featureLaunchers.length} AKTYWNYCH WĘZŁÓW</span>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {featureLaunchers.map(({ id, title, description, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className="group flex min-h-24 items-start gap-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 text-left transition-all duration-200 hover:border-cyan-500/50 hover:bg-slate-900/90 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] cursor-pointer"
              >
                <span className="rounded-xl border border-slate-700/60 bg-slate-950/80 p-2.5 text-cyan-400 transition-all group-hover:border-cyan-500 group-hover:text-cyan-300 group-hover:shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-bold text-slate-100 group-hover:text-cyan-200 transition-colors">{title}</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-slate-400 font-sans">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
