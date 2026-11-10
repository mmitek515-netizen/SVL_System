import React, { useState } from 'react';
import { SystemHealthDock } from './SystemHealthDock';
import { DataStore, SYS_VERSION, generatePythonMonolith } from '../kernel/svlKernel';
import { Terminal, Copy, Download, RefreshCw, MoreHorizontal } from 'lucide-react';

interface HeaderProps {
  dataStore: DataStore;
  onReset: () => void;
  onShowReport: () => void;
  onSyncSystem?: () => Promise<void>;
  kernelSyncStatus?: 'connecting' | 'online' | 'offline';
  onUnclog?: () => void;
  onRestoreBackup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ dataStore, onReset, onShowReport, onSyncSystem, kernelSyncStatus = 'connecting', onUnclog, onRestoreBackup }) => {
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const rawVersion =
    dataStore.config?.sys_version ||
    dataStore.update_history?.[dataStore.update_history.length - 1]?.wersja ||
    SYS_VERSION;
  const formattedVersion = String(rawVersion).startsWith('v') ? String(rawVersion) : `v${rawVersion}`;

  const handleCopyMonolith = async () => {
    try {
      await navigator.clipboard.writeText(generatePythonMonolith(dataStore));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setSyncError('Nie udało się skopiować kodu. Użyj pobierania.'); }
  };

  const handleDownloadMonolith = () => {
    const py = generatePythonMonolith(dataStore);
    const blob = new Blob([py], { type: 'text/x-python;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `svl_kernel_${String(rawVersion).toLowerCase().replace(/[^a-z0-9]/g, '_')}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTriggerSync = async () => {
    if (!onSyncSystem || syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await onSyncSystem();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Błąd synchronizacji z jądrem.');
    } finally {
      setSyncing(false);
    }
  };

  return <header className="workspace-header">
    <div className="workspace-brand">SVL_System<span>Bastilla OS · {formattedVersion}</span></div>
    <div className="workspace-header-actions">
      <span role="status" className={`text-[11px] ${kernelSyncStatus === 'online' ? 'text-emerald-300' : 'text-slate-400'}`}>
        {kernelSyncStatus === 'online' ? 'Połączono' : kernelSyncStatus === 'offline' ? 'Offline' : 'Łączenie…'}
      </span>
      {onSyncSystem && <button type="button" onClick={handleTriggerSync} disabled={syncing} aria-label="Synchronizuj system" title="Synchronizuj">
        <RefreshCw size={15} className={syncing ? 'animate-spin' : ''}/>
      </button>}
      <details><summary aria-label="Akcje systemu"><MoreHorizontal size={18}/></summary><div className="header-menu">
        <button type="button" onClick={handleCopyMonolith}><Copy size={14}/>{copied ? 'Skopiowano' : 'Kopiuj Python'}</button>
        <button type="button" onClick={handleDownloadMonolith}><Download size={14}/>Pobierz Python</button>
        <button type="button" onClick={onShowReport}><Terminal size={14}/>Raport</button>
        {onUnclog && <button onClick={onUnclog}>Odblokuj</button>}
        {onRestoreBackup && <button onClick={onRestoreBackup}>Przywróć backup</button>}
        <button type="button" onClick={onReset}>Przywróć stan bazowy</button>
        <SystemHealthDock />
      </div></details>
    </div>
    {syncError && <p role="alert" className="workspace-error">{syncError}</p>}
  </header>;
};
