import React from 'react';
import { Terminal, MessagesSquare, FileCode2, Database, History, Activity, Cpu, GitBranch, Clock, Sigma, FolderOpen, HardDrive, LayoutGrid, Brain, Github } from 'lucide-react';

export type TabId =
  | 'comms'
  | 'process_matrix'
  | 'astyria_mission'
  | 'schema_graph'
  | 'temporal'
  | 'terminal'
  | 'monolith'
  | 'datastore'
  | 'diagnostics'
  | 'visualizer'
  | 'file_explorer'
  | 'apps'
  | 'without_nlp'
  | 'github';

interface NavigationProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  messageCount: number;
  versionCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  messageCount,
  versionCount,
}) => {
  const tabs = [
    {
      id: 'comms' as TabId,
      label: 'Komora Triady & Dialog',
      icon: MessagesSquare,
      badge: `${messageCount}`
    },
    {
      id: 'process_matrix' as TabId,
      label: 'Infrastruktura & Naprawa z Logów [Alex]',
      icon: Cpu,
      badge: 'DOWÓDCA'
    },
    {
      id: 'astyria_mission' as TabId,
      label: 'Misja Astyria & VM_Ten_System',
      icon: GitBranch,
      badge: 'VM v8.5'
    },
    {
      id: 'schema_graph' as TabId,
      label: 'Mapa Pamięci [Astyria]',
      icon: GitBranch,
      badge: 'ASTYRIA'
    },
    {
      id: 'temporal' as TabId,
      label: 'Oś Czasu & Migawki [Aurelius]',
      icon: Clock,
      badge: 'AURELIUS'
    },
    {
      id: 'terminal' as TabId,
      label: 'Konsola CLI',
      icon: Terminal,
      badge: 'PY 3.10'
    },
    {
      id: 'monolith' as TabId,
      label: 'Monolit Python (.py)',
      icon: FileCode2,
      badge: 'CODE'
    },
    {
      id: 'datastore' as TabId,
      label: 'Rejestr DATA_STORE',
      icon: Database,
      badge: 'JSON'
    },
    {
      id: 'diagnostics' as TabId,
      label: 'Telemetria',
      icon: Activity,
      badge: 'LIVE'
    },
    {
      id: 'visualizer' as TabId,
      label: 'Wizualizator Triady',
      icon: Sigma,
      badge: '3D'
    },
    {
      id: 'file_explorer' as TabId,
      label: 'Eksplorator RING-0',
      icon: HardDrive,
      badge: 'STORAGE'
    },
    {
      id: 'apps' as TabId,
      label: 'Aplikacje [Terminal Forge]',
      icon: LayoutGrid,
      badge: 'FORGE'
    },
    {
      id: 'without_nlp' as TabId,
      label: 'Rdzeń without_nlp [Astyria]',
      icon: Sigma,
      badge: 'EULER'
    },
    {
      id: 'github' as TabId,
      label: 'Eksport GitHub',
      icon: Github,
      badge: 'GIT'
    }
  ];

  return (
    <nav className="border-b border-slate-800 bg-slate-900/60 px-4">
      <div className="max-w-7xl mx-auto flex items-center space-x-1 overflow-x-auto py-1 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-mono font-medium rounded-t-md transition-all whitespace-nowrap cursor-pointer border-b-2 ${
                isActive
                  ? 'border-emerald-400 text-slate-100 bg-slate-800/80'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isActive
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
