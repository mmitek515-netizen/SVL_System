import React, { useState, useEffect } from 'react';
import { Github, Send, Lock, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, DownloadCloud, FolderCheck } from 'lucide-react';

interface GitHubExportViewProps {
  onSyncComplete?: () => void;
}

export const GitHubExportView: React.FC<GitHubExportViewProps> = ({ onSyncComplete }) => {
  const [username, setUsername] = useState('u6930438163-code');
  const [repoName, setRepoName] = useState('SVL_Kernel');
  const [token, setToken] = useState('');
  const [commitMessage, setCommitMessage] = useState('Synchronizacja SVL Kernel v8.5.1-Desktop-Ready (Misja Astyrii)');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [actionType, setActionType] = useState<'export' | 'pull' | null>(null);
  const [message, setMessage] = useState('');
  const [syncedModules, setSyncedModules] = useState<string[]>(['Nowy_system', 'svl_kernel.py', 'apps/without_nlp', 'apps/raw_socket_rx_monitor']);

  useEffect(() => {
    fetch('/api/github/status')
      .then((r) => r.json())
      .then((data) => {
        if (data?.username) setUsername(data.username);
        if (data?.repoName) setRepoName(data.repoName);
        if (data?.hasToken && data?.maskedToken) {
          setToken(data.token || '');
        }
        if (Array.isArray(data?.syncedModules) && data.syncedModules.length > 0) {
          setSyncedModules(data.syncedModules);
        }
      })
      .catch(() => {});
  }, []);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !repoName) return;

    setStatus('loading');
    setActionType('export');
    setMessage('Wykonywanie commit & push do repozytorium GitHub...');

    try {
      const res = await fetch('/api/github/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, repoName, token, commitMessage }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Eksport do GitHub zakończony sukcesem!');
        onSyncComplete?.();
      } else {
        setStatus('error');
        setMessage(data.error || 'Wystąpił błąd podczas eksportu.');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Błąd połączenia z serwerem.');
    }
  };

  const handlePullSync = async () => {
    if (!username || !repoName) return;

    setStatus('loading');
    setActionType('pull');
    setMessage('Pobieranie i bezpieczna synchronizacja zmian z repozytorium GitHub (branch: main)...');

    try {
      const res = await fetch('/api/github/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, repoName, token }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Pomyślnie pobrano i zsynchronizowano zmiany z GitHub!');
        if (Array.isArray(data.syncedModules)) {
          setSyncedModules(data.syncedModules);
        }
        onSyncComplete?.();
      } else {
        setStatus('error');
        setMessage(data.error || 'Wystąpił błąd podczas synchronizacji z GitHub.');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Błąd połączenia z serwerem.');
    }
  };

  return (
    <div className="flex-1 bg-slate-950 flex flex-col font-mono p-4 md:p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-white">
                <Github className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-3">
                  Integracja & Synchronizacja GitHub
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] uppercase">
                    ACTIVE SYNC
                  </span>
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Dwukierunkowa synchronizacja SVL Kernel v8.5.1-Desktop-Ready z repozytorium GitHub (Push & Pull).
                </p>
              </div>
            </div>
            <a
              href={`https://github.com/${username || 'u6930438163-code'}/${repoName || 'SVL_Kernel'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 px-3 py-2 rounded-lg transition-colors"
            >
              Otwórz GitHub <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Synchronized modules status */}
        <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2.5 flex items-center gap-2">
            <FolderCheck className="w-4 h-4" />
            Zsynchronizowane Moduły z Repozytorium ({username}/{repoName}):
          </h3>
          <div className="flex flex-wrap gap-2">
            {syncedModules.map((mod) => (
              <span
                key={mod}
                className="px-2.5 py-1 rounded-md bg-slate-900 border border-emerald-800/60 text-emerald-300 text-xs font-mono"
              >
                {mod}
              </span>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-950/20 border border-blue-900/50 rounded-xl p-4">
          <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Instrukcja Obsługi GitHub Sync:
          </h3>
          <ol className="text-[11px] text-slate-300 space-y-2 list-decimal ml-4">
            <li>
              <strong>Synchronizuj z GitHub (Pull)</strong>: Pobiera nowe pliki i pakiety (np. <code className="text-emerald-300">Nowy_system</code>) wprowadzone na GitHubie i włącza je do <code className="text-blue-300">DATA_STORE</code>.
            </li>
            <li>
              <strong>Eksportuj do GitHub (Push)</strong>: Zapisuje bieżący kod systemu, aplikacje i stan jądra na gałęzi <code className="text-emerald-400">main</code>.
            </li>
            <li>
              Dane repozytorium i token PAT są bezpiecznie zapamiętane po pierwszym połączeniu.
            </li>
          </ol>
        </div>

        {/* Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <form onSubmit={handleExport} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Użytkownik GitHub</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="np. u6930438163-code"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:border-emerald-500 outline-none transition-colors"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Nazwa Repozytorium</label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="np. SVL_Kernel"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:border-emerald-500 outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">
                Personal Access Token (PAT — opcjonalny jeśli już zapisany na serwerze)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Zapisany token w pamięci serwera (.github_credentials.json)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:border-emerald-500 outline-none transition-colors font-mono"
                />
                <Lock className="absolute right-3 top-2.5 w-4 h-4 text-slate-600" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Opis Commita (dla Push)</label>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Opis zmian..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:border-emerald-500 outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handlePullSync}
                disabled={status === 'loading'}
                className={`py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  status === 'loading'
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950 cursor-pointer shadow-lg shadow-cyan-900/20'
                }`}
              >
                {status === 'loading' && actionType === 'pull' ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <DownloadCloud className="w-5 h-5" />
                )}
                {status === 'loading' && actionType === 'pull'
                  ? 'Synchronizowanie...'
                  : 'Synchronizuj z GitHub (Pull)'}
              </button>

              <button
                type="submit"
                disabled={status === 'loading'}
                className={`py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  status === 'loading'
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 cursor-pointer shadow-lg shadow-emerald-900/20'
                }`}
              >
                {status === 'loading' && actionType === 'export' ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {status === 'loading' && actionType === 'export'
                  ? 'Eksportowanie...'
                  : 'Eksportuj do GitHub (Push)'}
              </button>
            </div>
          </form>
        </div>

        {/* Status Message */}
        {status !== 'idle' && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
              status === 'success'
                ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400'
                : status === 'error'
                ? 'bg-red-950/30 border-red-800 text-red-400'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            {status === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : status === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0" />
            ) : (
              <RefreshCw className="w-5 h-5 animate-spin shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-bold">
                {status === 'success' ? 'Sukces!' : status === 'error' ? 'Błąd' : 'Przetwarzanie'}
              </p>
              <p className="text-xs mt-1 leading-relaxed whitespace-pre-line">{message}</p>
              {status === 'success' && (
                <a
                  href={`https://github.com/${username}/${repoName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-600 text-slate-950 px-3 py-1.5 rounded hover:bg-emerald-500 transition-colors"
                >
                  Zobacz Repozytorium <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
