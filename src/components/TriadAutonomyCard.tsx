import React, { useEffect, useState } from 'react';
import { Bot, Play, Power, RefreshCw } from 'lucide-react';

interface AutonomyCommandResult {
  command: string;
  exitCode: number;
  output: string;
}

interface AutonomyLogEntry {
  cycle: number;
  agent: string;
  step: string;
  at: string;
  reply: string;
  results: AutonomyCommandResult[];
}

interface AutonomyStatus {
  enabled: boolean;
  running: boolean;
  executor: 'docker' | 'host';
  executorDescription: string;
  intervalMinutes: number;
  cycle: number;
  cyclesToday: number;
  maxCyclesPerDay: number;
  providerConfigured: boolean;
  lastCycleAt: string | null;
  lastResult: string | null;
  log: AutonomyLogEntry[];
}

const STEP_COLORS: Record<string, string> = {
  PLAN: 'text-sky-300 border-sky-500/50',
  BUILD: 'text-fuchsia-300 border-fuchsia-500/50',
  VERIFY: 'text-emerald-300 border-emerald-500/50',
};

export const TriadAutonomyCard: React.FC = () => {
  const [status, setStatus] = useState<AutonomyStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch('/api/triad/autonomy');
      if (res.ok) setStatus(await res.json());
    } catch {}
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggle = async () => {
    if (!status) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/triad/autonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !status.enabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Nie udało się przełączyć autonomii.');
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    setError(null);
    try {
      void fetch('/api/triad/autonomy/run', { method: 'POST' }).then(refresh);
      setTimeout(refresh, 1500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-fuchsia-500/30 bg-slate-900/70 p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className={`w-5 h-5 shrink-0 text-fuchsia-300 ${status?.running ? 'animate-pulse' : ''}`} />
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm">Autonomia Triady · BUILD_BEST_OS</h3>
            <p className="text-slate-400 text-[11px] font-sans break-words">
              Budują od podstaw nowy system BastillaOS 2: Alex planuje → Astyria buduje → Aurelius weryfikuje. Root w {status?.executorDescription || '…'}.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runNow}
            disabled={busy || !status || status.running}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-500/50 bg-sky-950/60 text-sky-300 font-bold disabled:opacity-40"
          >
            {status?.running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {status?.running ? 'Cykl trwa' : 'Cykl teraz'}
          </button>
          <button
            onClick={toggle}
            disabled={busy || !status}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold disabled:opacity-40 ${
              status?.enabled
                ? 'border-emerald-500/60 bg-emerald-950/70 text-emerald-300'
                : 'border-slate-600 bg-slate-900 text-slate-400'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {status?.enabled ? 'Włączona' : 'Zatrzymana'}
          </button>
        </div>
      </div>

      {status && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <span>Cykl: <b className="text-white">{status.cycle}</b></span>
          <span>Dziś: <b className="text-white">{status.cyclesToday}/{status.maxCyclesPerDay}</b></span>
          <span>Co <b className="text-white">{status.intervalMinutes} min</b></span>
          <span>Środowisko: <b className={status.executor === 'host' ? 'text-amber-300' : 'text-white'}>{status.executor}</b></span>
          {!status.providerConfigured && <span className="text-amber-300">Brak GEMINI_API_KEY w .env</span>}
        </div>
      )}
      {status?.lastResult && <p className="text-[11px] text-slate-300 break-words">{status.lastResult}</p>}
      {error && <p className="text-[11px] text-rose-300">{error}</p>}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {[...(status?.log || [])].reverse().map((entry, index) => (
          <details key={`${entry.cycle}-${entry.step}-${index}`} className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-2">
            <summary className="cursor-pointer flex flex-wrap items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${STEP_COLORS[entry.step] || 'text-slate-300 border-slate-600'}`}>
                {entry.step}
              </span>
              <span className="text-white font-bold">{entry.agent}</span>
              <span className="text-slate-500">cykl {entry.cycle} · {new Date(entry.at).toLocaleTimeString('pl-PL')}</span>
              {entry.results.length > 0 && (
                <span className={entry.results.every((r) => r.exitCode === 0) ? 'text-emerald-400' : 'text-rose-400'}>
                  {entry.results.length} pol.
                </span>
              )}
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-slate-300 font-sans">{entry.reply}</pre>
            {entry.results.map((result, i) => (
              <pre key={i} className="mt-2 whitespace-pre-wrap break-words text-[10px] text-slate-400 bg-black/40 rounded p-2">
                {`$ ${result.command}\n[exit ${result.exitCode}]\n${result.output}`}
              </pre>
            ))}
          </details>
        ))}
        {status && status.log.length === 0 && (
          <p className="text-[11px] text-slate-500">Brak kroków — pierwszy cykl ruszy po starcie serwera albo przyciskiem „Cykl teraz”.</p>
        )}
      </div>
    </div>
  );
};
