import React, { useState } from 'react';
import { Terminal, MessagesSquare, FileCode2, Database, History, Activity, Cpu, GitBranch, Clock, Sigma, FolderOpen, HardDrive, LayoutGrid, Brain, Github, Home, ClipboardCheck, Radio, Satellite, MoreHorizontal } from 'lucide-react';

export type TabId =
  | 'home'
  | 'comms'
  | 'approvals'
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
  | 'hyper_com'
  | 'fleet'
  | 'without_nlp'
  | 'github';

export const TAB_IDS: readonly TabId[] = [
  'home', 'comms', 'approvals', 'process_matrix', 'astyria_mission', 'schema_graph', 'temporal',
  'terminal', 'monolith', 'datastore', 'diagnostics', 'visualizer', 'file_explorer',
  'apps', 'hyper_com', 'fleet', 'without_nlp', 'github',
];

/** Widok startowy z adresu, np. /?view=without_nlp (launchery KDE w BastillaOS). */
export function initialTabFromLocation(): TabId {
  try {
    const view = new URLSearchParams(window.location.search).get('view');
    return view && (TAB_IDS as readonly string[]).includes(view) ? (view as TabId) : 'home';
  } catch {
    return 'home';
  }
}

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
      id: 'home' as TabId,
      label: 'Pulpit',
      icon: Home,
      badge: 'SYSTEM'
    },
    {
      id: 'comms' as TabId,
      label: 'Czat',
      icon: MessagesSquare,
      badge: `${messageCount}`
    },
    {
      id: 'approvals' as TabId,
      label: 'Akceptacje',
      icon: ClipboardCheck,
      badge: 'DECYZJE'
    },
    {
      id: 'process_matrix' as TabId,
      label: 'Infrastruktura',
      icon: Cpu,
      badge: 'DOWÓDCA'
    },
    {
      id: 'astyria_mission' as TabId,
      label: 'Misje',
      icon: GitBranch,
      badge: 'VM v8.5'
    },
    {
      id: 'schema_graph' as TabId,
      label: 'Pamięć',
      icon: GitBranch,
      badge: 'ASTYRIA'
    },
    {
      id: 'temporal' as TabId,
      label: 'Historia',
      icon: Clock,
      badge: 'AURELIUS'
    },
    {
      id: 'terminal' as TabId,
      label: 'Terminal',
      icon: Terminal,
      badge: 'PY 3.10'
    },
    {
      id: 'monolith' as TabId,
      label: 'Python',
      icon: FileCode2,
      badge: 'CODE'
    },
    {
      id: 'datastore' as TabId,
      label: 'Dane',
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
      label: 'Wizualizator',
      icon: Sigma,
      badge: '3D'
    },
    {
      id: 'file_explorer' as TabId,
      label: 'Pliki',
      icon: HardDrive,
      badge: 'STORAGE'
    },
    {
      id: 'apps' as TabId,
      label: 'Aplikacje',
      icon: LayoutGrid,
      badge: 'FORGE'
    },
    {
      id: 'fleet' as TabId,
      label: 'Flota',
      icon: Satellite,
      badge: 'DANE'
    },
    {
      id: 'hyper_com' as TabId,
      label: 'Transmisje',
      icon: Radio,
      badge: 'HYPERCOM'
    },
    {
      id: 'without_nlp' as TabId,
      label: 'Silnik',
      icon: Sigma,
      badge: 'EULER'
    },
    {
      id: 'github' as TabId,
      label: 'GitHub',
      icon: Github,
      badge: 'GIT'
    }
  ];

  const [more, setMore] = useState(false);
  const primary = ['home', 'comms', 'fleet', 'terminal'];
  return <nav aria-label="Nawigacja BastillaOS" className="workspace-nav">
    <div className="nav-brand">OBSZAR ROBOCZY</div>
    {tabs.map(({id, label, icon: Icon}) => <button key={id} type="button" title={label} aria-label={label}
      aria-current={activeTab === id ? 'page' : undefined} onClick={() => { onSelectTab(id); setMore(false); }}
      className={`nav-item ${primary.includes(id) ? 'nav-primary' : 'nav-secondary'} ${more ? 'nav-visible' : ''}`}>
      <Icon size={17}/><span>{label}</span>{id === 'comms' && messageCount > 0 && <small>{messageCount}</small>}
    </button>)}
    <button type="button" className={`nav-more ${!primary.includes(activeTab) ? "nav-more-active" : ""}`} aria-expanded={more} onClick={() => setMore(!more)}><MoreHorizontal size={19}/><span>{more ? 'Zamknij' : 'Więcej'}</span></button>
  </nav>;
};
