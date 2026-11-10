import { ModuleHeader } from './WorkspaceUI';
import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Github, RefreshCw, UploadCloud } from 'lucide-react';

interface GitStatus {
  branch: string;
  repositoryUrl: string | null;
  ahead: number;
  behind: number;
  dirtyFiles: number;
  autoSync: boolean;
}

export const GitHubExportView: React.FC = () => {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [statusUnavailable, setStatusUnavailable] = useState(false);

  const refreshStatus = useCallback(async () => {
    const response = await fetch('/api/triad/git/status');
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Nie można pobrać stanu Git (HTTP ${response.status}).`);
    }
    setGitStatus(data);
    setStatusUnavailable(false);
    setLastCheckedAt(new Date().toLocaleTimeString('pl-PL'));
  }, []);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        await refreshStatus();
      } catch (error) {
        if (!active) return;
        setGitStatus(null);
        setStatusUnavailable(true);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : String(error));
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 15000);
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshStatus]);

  const handleSync = async () => {
    if (loading) return;
    if (!gitStatus || gitStatus.branch !== 'main') {
      setStatus('error');
      setMessage('Synchronizacja GitHub wymaga lokalnego repozytorium na gałęzi main. Podgląd AI Studio nie zapewnia automatycznie checkoutu Git.');
      return;
    }
    setLoading(true);
    setStatus('idle');
    setMessage('Sprawdzam zmiany aplikacji, zapisuję commit i wysyłam do origin...');
    try {
      const response = await fetch('/api/triad/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'triad',
          message: 'Synchronizacja kodu aplikacji z GitHub',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || data.pushed !== true) {
        throw new Error(data.error || `Nie potwierdzono wysłania zmian do GitHub (HTTP ${response.status}).`);
      }
      setStatus('success');
      setMessage(data.sha
        ? `Zapisano commit ${data.sha} i wysłano do origin/${data.branch}.`
        : `Brak nowych zmian do commita; origin/${data.branch} jest zsynchronizowane.`);
      await refreshStatus();
    } catch (error: unknown) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="module-view module-page">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <ModuleHeader title="GitHub" meta={lastCheckedAt||'Odczyt…'}>
          <button type="button" onClick={()=>void refreshStatus().catch(e=>{setStatusUnavailable(true);setStatus('error');setMessage(e.message);})}><RefreshCw size={14}/>Odśwież</button>
          {gitStatus?.repositoryUrl&&<a className="control-link" href={gitStatus.repositoryUrl} target="_blank" rel="noopener noreferrer">Repozytorium <ExternalLink size={14}/></a>}
        </ModuleHeader>
        <section className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-5">
          <h3 className="text-xs font-medium text-cyan-300">Stan repozytorium</h3>
          {gitStatus ? (
            <dl className="grid grid-cols-2 gap-3 text-xs text-slate-300 md:grid-cols-4">
              <div><dt className="text-slate-500">Gałąź</dt><dd className="mt-1 font-medium">{gitStatus.branch}</dd></div>
              <div><dt className="text-slate-500">Zmiany lokalne</dt><dd className="mt-1 font-medium">{gitStatus.dirtyFiles} plików</dd></div>
              <div><dt className="text-slate-500">Do wysłania</dt><dd className="mt-1 font-medium">{gitStatus.ahead} commitów</dd></div>
              <div><dt className="text-slate-500">Do pobrania</dt><dd className="mt-1 font-medium">{gitStatus.behind} commitów</dd></div>
            </dl>
          ) : (
            <p className="text-xs text-slate-400">{statusUnavailable
              ? 'Brak lokalnego repozytorium Git lub połączenia z backendem. W Google AI Studio synchronizuj projekt z GitHub przez panel AI Studio.'
              : 'Odczytuję status repozytorium...'}</p>
          )}
          <p className="text-[11px] leading-relaxed text-slate-400">
            Ten panel odczytuje lokalny stan Git, a nie potwierdza synchronizacji projektu w AI Studio.
            Automatyczny commit/push wymaga osobno uruchomionego procesu z dostępem do Git i GitHub.
            {lastCheckedAt ? ` Ostatni odczyt lokalny: ${lastCheckedAt}.` : ''}
          </p>
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={loading || !gitStatus || gitStatus.branch !== 'main'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium text-slate-950 transition-all hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
            {loading ? 'Synchronizowanie…' : 'Commit + push'}
          </button>
        </section>

        {status !== 'idle' && (
          <div
            role="status"
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              status === 'success'
                ? 'border-emerald-800 bg-emerald-950/30 text-emerald-400'
                : 'border-red-800 bg-red-950/30 text-red-400'
            }`}
          >
            {status === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <p className="text-xs leading-relaxed whitespace-pre-line">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
};
