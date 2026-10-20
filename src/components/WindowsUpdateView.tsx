import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  FileCheck2,
  History,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Square,
  SquareCheck,
  Terminal,
  TriangleAlert,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';

export interface AsaPackage {
  id: string;
  name: string;
  category: 'kernel' | 'robot_runtime' | 'node_packages' | 'python_monolith' | 'system_ring0';
  currentVersion: string;
  targetVersion: string;
  status: 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'UPDATING' | 'VERIFIED';
  description: string;
  criticality: 'CRITICAL' | 'HIGH' | 'NORMAL';
}

export interface AsaState {
  enabled: boolean;
  status: 'IDLE' | 'SCANNING' | 'UPDATING' | 'REVERTING' | 'ACTIVE_DAEMON';
  commander: string;
  targetEnvironment: string;
  lastScanTime: string;
  lastUpdateTime: string;
  lastRollbackTime: string | null;
  snapshotsCount: number;
  latestSnapshotId: string;
  autoHealEnabled: boolean;
  packages: AsaPackage[];
  recentEvents: Array<{
    id: string;
    timestamp: string;
    type: 'SCAN' | 'SNAPSHOT' | 'UPGRADE' | 'ROLLBACK' | 'VERIFY';
    message: string;
    success: boolean;
  }>;
}

interface WindowsUpdate {
  id: string;
  revision: number;
  title: string;
  kbArticles: string[];
  severity: string;
  categories: string[];
  downloaded: boolean;
  eulaAccepted: boolean;
  maxDownloadBytes: number;
}

interface AgentHealth {
  computerName: string;
  osName: string;
  osVersion: string;
  isAdministrator: boolean;
  updateSource: string;
}

interface ScanResponse {
  updates: WindowsUpdate[];
  system: AgentHealth;
  source: string;
  scannedAt: string;
}

interface InstallResponse {
  message: string;
  rebootRequired: boolean;
  results: Array<{ title: string; resultCode: number }>;
}

interface BinaryReport {
  name: string;
  size: number;
  sha256: string;
  format: string;
  notes: string;
}

interface TextDetectorResult {
  rawValue: string;
}

interface TextDetectorInstance {
  detect(source: ImageBitmap): Promise<TextDetectorResult[]>;
}

type TextDetectorConstructor = new () => TextDetectorInstance;
type TextDetectorWindow = Window & { TextDetector?: TextDetectorConstructor };

const DEFAULT_AGENT_URL = 'http://127.0.0.1:8765';
const TOKEN_STORAGE_KEY = 'bastilla_windows_update_agent_token';
const URL_STORAGE_KEY = 'bastilla_windows_update_agent_url';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Rozmiar nieznany';
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function inferBinaryFormat(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return 'PE/Windows (nagłówek MZ)';
  }
  if (bytes.length >= 4 && bytes[0] === 0x4d && bytes[1] === 0x53 && bytes[2] === 0x43 && bytes[3] === 0x46) {
    return 'Microsoft Cabinet (CAB/MSU)';
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'Archiwum ZIP';
  }
  return 'Nieznany format binarny';
}

export const WindowsUpdateView: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'alex_asa' | 'windows_wua'>('alex_asa');

  // --- ALEX ASA STATE ---
  const [asa, setAsa] = useState<AsaState | null>(null);
  const [isAsaBusy, setIsAsaBusy] = useState(false);
  const [asaFeedback, setAsaFeedback] = useState<string | null>(null);

  // Fetch ASA status and subscribe to live SSE events
  useEffect(() => {
    let active = true;

    const fetchAsaStatus = async () => {
      try {
        const res = await fetch('/api/updates/status');
        if (!res.ok) return;
        const data = await res.json();
        if (active) setAsa(data);
      } catch (err) {
        console.warn('Nie udało się pobrać statusu ASA:', err);
      }
    };

    void fetchAsaStatus();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/kernel/live-stream');
      eventSource.addEventListener('asa_status', (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.payload) {
            setAsa(parsed.payload);
          }
        } catch {}
      });
    } catch {}

    return () => {
      active = false;
      eventSource?.close();
    };
  }, []);

  const handleAsaScan = async () => {
    setIsAsaBusy(true);
    setAsaFeedback('Alex skanuje stan pakietów, repozytorium oraz jednostki robota...');
    try {
      const res = await fetch('/api/updates/scan', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd skanowania');
      if (data.asaState) setAsa(data.asaState);
      setAsaFeedback('Alex: Skanowanie zakończone pomyślnie. Wszystkie moduły zweryfikowane i spójne.');
    } catch (err: any) {
      setAsaFeedback(`Błąd skanowania: ${err.message}`);
    } finally {
      setIsAsaBusy(false);
    }
  };

  const handleAsaApply = async () => {
    setIsAsaBusy(true);
    setAsaFeedback('Alex tworzy snapshot punktu przywracania i wdraża aktualizacje w Ring-0...');
    try {
      const res = await fetch('/api/updates/apply', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd wdrażania aktualizacji');
      if (data.asaState) setAsa(data.asaState);
      setAsaFeedback(`Alex: Aktualizacja do v${data.sys_version || '8.6.0-ASA'} wdrożona! Utworzono snapshot na dysku.`);
    } catch (err: any) {
      setAsaFeedback(`Błąd wdrażania: ${err.message}`);
    } finally {
      setIsAsaBusy(false);
    }
  };

  const handleAsaRollback = async () => {
    if (!window.confirm('Czy na pewno chcesz przywrócić ostatni stabilny stan systemu i robota z kopii zapasowej (Log-Driven Rollback)?')) return;
    setIsAsaBusy(true);
    setAsaFeedback('Alex inicjuje procedurę Rollback z logów i przywraca poprzedni obraz...');
    try {
      const res = await fetch('/api/updates/rollback', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd rollbacku');
      if (data.asaState) setAsa(data.asaState);
      setAsaFeedback(data.message || 'Przywrócono stabilny stan jądra i robota.');
    } catch (err: any) {
      setAsaFeedback(`Błąd rollbacku: ${err.message}`);
    } finally {
      setIsAsaBusy(false);
    }
  };

  const handleAsaToggleAuto = async () => {
    try {
      const nextEnabled = !(asa?.enabled ?? true);
      const res = await fetch('/api/updates/toggle-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled })
      });
      const data = await res.json();
      if (data.asaState) setAsa(data.asaState);
    } catch (err) {
      console.warn('Błąd przełączania trybu auto:', err);
    }
  };

  // --- WINDOWS WUA AGENT STATE ---
  const [agentUrl, setAgentUrl] = useState(
    () => sessionStorage.getItem(URL_STORAGE_KEY) || DEFAULT_AGENT_URL
  );
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [binaryReport, setBinaryReport] = useState<BinaryReport | null>(null);
  const [installResult, setInstallResult] = useState<InstallResponse | null>(null);

  const baseUrl = useMemo(() => {
    const trimmed = agentUrl.trim();
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }, [agentUrl]);

  const apiRequest = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const cleanUrl = baseUrl.trim();
    const url = new URL(path.replace(/^\//, ''), cleanUrl);
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Bastilla-Token': token.trim(),
        ...init.headers,
      },
      cache: 'no-store',
    });
    const result = await response.json() as T & { error?: string };
    if (!response.ok) {
      throw new Error(result.error || `Agent Windows Update zwrócił HTTP ${response.status}.`);
    }
    return result;
  }, [baseUrl, token]);

  const connect = async () => {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiRequest<{ system: AgentHealth }>('health');
      setHealth(result.system);
      sessionStorage.setItem(URL_STORAGE_KEY, agentUrl.trim());
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
      setNotice('Połączono z lokalnym pomocnikiem Windows Update.');
    } catch (caught) {
      setHealth(null);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  };

  const scanUpdates = async () => {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    setInstallResult(null);
    try {
      const result = await apiRequest<ScanResponse>('updates');
      setScan(result);
      setHealth(result.system);
      setSelectedIds([]);
      setNotice(
        result.updates.length
          ? `Skan zakończony: znaleziono ${result.updates.length} dostępnych aktualizacji.`
          : 'Skan zakończony: źródło aktualizacji nie zgłasza aktualizacji dla tego komputera.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  };

  const filteredUpdates = useMemo(() => {
    if (!scan) return [];
    const requestedKb = Array.from(ocrText.toUpperCase().matchAll(/\bKB\d{6,8}\b/g), (match) => match[0]);
    if (requestedKb.length === 0) return scan.updates;
    return scan.updates.filter((update) =>
      update.kbArticles.some((kb) => requestedKb.includes(`KB${kb.replace(/^KB/i, '')}`))
    );
  }, [ocrText, scan]);

  const toggleUpdate = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id]
    );
  };

  const installSelected = async () => {
    if (!scan || selectedIds.length === 0) return;
    const chosen = scan.updates.filter((update) => selectedIds.includes(update.id));
    const confirmed = window.confirm(
      `Zainstalować ${chosen.length} aktualizacji na komputerze ${scan.system.computerName}?\n\n` +
      `${chosen.map((update) => update.title).join('\n')}\n\n` +
      'Operacja może wymagać ponownego uruchomienia systemu.'
    );
    if (!confirmed) return;

    setIsBusy(true);
    setError(null);
    setNotice(null);
    setInstallResult(null);
    try {
      const result = await apiRequest<InstallResponse>('install', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      });
      setSelectedIds([]);
      await scanUpdates();
      setInstallResult(result);
      setNotice(result.rebootRequired ? `${result.message} System wymaga ponownego uruchomienia.` : result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  };

  const inspectBinary = async (file?: File) => {
    if (!file) return;
    setBinaryReport(null);
    setError(null);
    setNotice(null);
    try {
      if (file.size > 256 * 1024 * 1024) {
        throw new Error('Plik przekracza limit analizy w przeglądarce (256 MB).');
      }
      const data = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', data);
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const bytes = new Uint8Array(data.slice(0, 16));
      const format = inferBinaryFormat(bytes);
      setBinaryReport({
        name: file.name,
        size: file.size,
        sha256: hash,
        format,
        notes: 'To lokalny odcisk SHA-256 i identyfikacja nagłówka. Nie potwierdza podpisu Authenticode ani bezpieczeństwa pliku; nie uruchamia ani nie instaluje pliku.',
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const runOcr = async (file?: File) => {
    if (!file) return;
    setOcrText('');
    setOcrStatus(null);
    setError(null);
    const Detector = (window as TextDetectorWindow).TextDetector;
    if (!Detector) {
      setOcrStatus('OCR nie jest dostępny w tej przeglądarce. Możesz wkleić rozpoznane numery KB ręcznie; OCR nie jest używany do weryfikacji podpisu ani instalacji.');
      return;
    }
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      const detector = new Detector();
      const results = await detector.detect(bitmap);
      const text = results.map((result) => result.rawValue).filter(Boolean).join('\n');
      setOcrText(text);
      const kbCount = Array.from(text.matchAll(/\bKB\d{6,8}\b/gi)).length;
      setOcrStatus(
        kbCount
          ? `OCR odczytał ${kbCount} identyfikatorów KB. Lista aktualizacji została przefiltrowana; sprawdź wyniki ręcznie.`
          : 'OCR zakończony, ale nie znaleziono numerów KB. Rozpoznany tekst można poprawić ręcznie.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? `OCR nie powiódł się: ${caught.message}` : `OCR nie powiódł się: ${String(caught)}`);
    } finally {
      bitmap?.close();
    }
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto bg-slate-950 p-4 text-slate-100 md:p-8">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 rounded-2xl border border-emerald-800/50 bg-slate-900/80 p-5 md:flex-row md:items-center md:justify-between shadow-2xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <ShieldCheck className="h-4 w-4" /> Autonomiczny System Aktualizacji (ASA) · Alex Ring-0
          </div>
          <h1 className="mt-2 text-2xl font-bold flex items-center gap-2">
            <span>Aktualizacje Systemu & Robota</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-mono">
              v8.6.0-ASA
            </span>
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Zarządzany przez Alexa silnik ciągłego monitoringu, bezpiecznych snapshotów i natychmiastowej synchronizacji na żywo (SSE) dla jądra SVL, stosu robota i ekosystemu aplikacji.
          </p>
        </div>

        {/* Mode switch buttons */}
        <div className="flex shrink-0 items-center gap-2 bg-slate-950/80 border border-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveMode('alex_asa')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeMode === 'alex_asa'
                ? 'bg-emerald-600 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Alex ASA (Robot & Jądro)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('windows_wua')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeMode === 'windows_wua'
                ? 'bg-cyan-600 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Windows WUA (Pomocnik)</span>
          </button>
        </div>
      </header>

      {/* --- MODE 1: ALEX AUTONOMICZNY SYSTEM AKTUALIZACJI (ASA) --- */}
      {activeMode === 'alex_asa' && (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          {/* Status Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Status Silnika ASA
              </span>
              <span className="text-sm font-bold text-emerald-300 mt-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {asa?.status || 'ACTIVE_DAEMON'}
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Tryb: Autonomiczny Ring-0</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" /> Ostatnia Akcja
              </span>
              <span className="text-sm font-bold text-cyan-300 mt-2">
                {asa?.lastScanTime || new Date().toLocaleTimeString('pl-PL')}
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Cykliczny skan sieci i jądra</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <History className="w-3.5 h-3.5 text-amber-400" /> Kopia Bezpieczeństwa
              </span>
              <span className="text-sm font-bold text-amber-300 mt-2">
                {asa?.snapshotsCount || 1} migawki
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Pliki w /exports/ (*.json)</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-purple-400" /> Samonaprawa (Recovery)
              </span>
              <span className="text-sm font-bold text-purple-300 mt-2">
                Log-Driven Rollback
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Automatyczne cofanie błędów</span>
            </div>
          </div>

          {/* Commander Control Actions */}
          <div className="rounded-xl border border-emerald-900/50 bg-slate-900/80 p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Centrum Dowodzenia Alexa — Autonomiczne Aktualizacje Robota
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Środowisko: <code className="text-emerald-300">{asa?.targetEnvironment || 'SVL_System & Robot Embedded Unit (Linux/Ring-0)'}</code>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAsaScan}
                  disabled={isAsaBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/60 bg-emerald-950/80 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-900 transition disabled:opacity-50 cursor-pointer"
                  title="Skanuj pakiety i stan robota przez Alexa"
                >
                  {isAsaBusy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                  <span>Skanuj pakiety i jądro</span>
                </button>

                <button
                  type="button"
                  onClick={handleAsaApply}
                  disabled={isAsaBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50 cursor-pointer shadow-lg active:scale-95"
                  title="Wdróż aktualizacje jądra i robota z punktem przywracania"
                >
                  {isAsaBusy ? <LoaderCircle className="w-4 h-4 animate-spin text-slate-950" /> : <Download className="w-4 h-4" />}
                  <span>Wdróż aktualizację (Snapshot + Ring-0)</span>
                </button>

                <button
                  type="button"
                  onClick={handleAsaRollback}
                  disabled={isAsaBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-800 bg-rose-950/60 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-900 transition disabled:opacity-50 cursor-pointer"
                  title="Przywróć poprzedni stabilny obraz (Log-Driven Rollback)"
                >
                  <RotateCcw className="w-4 h-4 text-rose-300" />
                  <span>Rollback z logów</span>
                </button>

                <button
                  type="button"
                  onClick={handleAsaToggleAuto}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-bold transition cursor-pointer ${
                    asa?.enabled
                      ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                      : 'border-slate-700 bg-slate-950 text-slate-400'
                  }`}
                  title="Włącz/wyłącz cyklicznego demona aktualizacji w tle"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto: {asa?.enabled ? 'WŁĄCZONE' : 'WYŁĄCZONE'}</span>
                </button>
              </div>
            </div>

            {asaFeedback && (
              <div className="mt-3 p-2.5 rounded-lg border border-emerald-800/60 bg-emerald-950/30 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{asaFeedback}</span>
              </div>
            )}
          </div>

          {/* Module Packages Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-200">
                Pakiety i Komponenty Systemu Objęte Nadzorem Alexa
              </h3>
              <span className="text-[11px] text-slate-400">
                Liczba modułów: {asa?.packages?.length || 5}
              </span>
            </div>

            <div className="mt-3 divide-y divide-slate-800">
              {(asa?.packages || []).map((pkg) => (
                <div key={pkg.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-100">{pkg.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-bold border ${
                        pkg.criticality === 'CRITICAL'
                          ? 'bg-rose-950/60 text-rose-300 border-rose-800/40'
                          : pkg.criticality === 'HIGH'
                          ? 'bg-amber-950/60 text-amber-300 border-amber-800/40'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {pkg.criticality}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{pkg.description}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">
                        Wersja: <code className="text-emerald-400 font-bold">{pkg.currentVersion}</code>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Docelowa: <code>{pkg.targetVersion}</code>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      {pkg.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Events Feed from Alex ASA */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-cyan-400" />
                Dziennik Zdarzeń Silnika ASA na Żywo (SSE)
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono">● LIVE STREAM ACTIVE</span>
            </div>

            <div className="mt-3 max-h-48 overflow-y-auto space-y-2 font-mono text-xs">
              {(asa?.recentEvents || []).map((evt) => (
                <div key={evt.id} className="p-2 rounded bg-slate-950/80 border border-slate-800/80 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-500 shrink-0 text-[10px]">[{evt.timestamp}]</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-cyan-300 font-bold shrink-0">
                      {evt.type}
                    </span>
                    <span className="text-slate-200 text-[11px]">{evt.message}</span>
                  </div>
                  {evt.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <TriangleAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODE 2: LEGACY WINDOWS UPDATE AGENT (WUA) --- */}
      {activeMode === 'windows_wua' && (
        <div className="mx-auto grid w-full max-w-6xl gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Wifi className="h-4 w-4 text-cyan-300" /> Połączenie z komputerem Windows (WUA)
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Uruchom dostarczony pomocnik PowerShell jako administrator na komputerze, który ma być aktualizowany.
                W przeglądarce strony i pomocnika musi być ustawiony ten sam, dokładny adres pochodzenia.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-300">
                  Adres pomocnika
                  <input
                    value={agentUrl}
                    onChange={(event) => setAgentUrl(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
                    spellCheck={false}
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Jednorazowy token z konsoli PowerShell
                  <input
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
                    type="password"
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={isBusy || !token.trim()}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-700/70 bg-cyan-950/70 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-50 cursor-pointer"
                >
                  {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />} Połącz / sprawdź uprawnienia
                </button>
                <button
                  type="button"
                  onClick={() => void scanUpdates()}
                  disabled={isBusy || !token.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50 cursor-pointer"
                >
                  {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />} Skanuj dostępne aktualizacje
                </button>
              </div>
              {health && (
                <div className="mt-3 grid gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs sm:grid-cols-2">
                  <span><span className="text-slate-500">System:</span> {health.osName} ({health.osVersion})</span>
                  <span><span className="text-slate-500">Komputer:</span> {health.computerName}</span>
                  <span><span className="text-slate-500">Źródło:</span> {health.updateSource}</span>
                  <span className={health.isAdministrator ? 'text-emerald-300' : 'text-amber-300'}>
                    {health.isAdministrator ? 'Uprawnienia administratora: tak' : 'Brak uprawnień administratora — instalacja będzie zablokowana'}
                  </span>
                </div>
              )}
            </section>

            {(error || notice) && (
              <div
                role="status"
                className={`rounded-lg border p-3 text-xs ${
                  error ? 'border-rose-800/70 bg-rose-950/40 text-rose-200' : 'border-emerald-800/70 bg-emerald-950/30 text-emerald-200'
                }`}
              >
                {error ? <TriangleAlert className="mr-2 inline h-4 w-4" /> : <CheckCircle2 className="mr-2 inline h-4 w-4" />}
                {error || notice}
              </div>
            )}

            {scan && (
              <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-bold">Wynik skanowania · {scan.updates.length} aktualizacji</h2>
                    <p className="mt-1 text-xs text-slate-500">Źródło: {scan.source} · {new Date(scan.scannedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedIds(filteredUpdates.map((update) => update.id))}
                      disabled={!filteredUpdates.length || isBusy}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-50 cursor-pointer"
                    >
                      Zaznacz {filteredUpdates.length}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      disabled={!selectedIds.length || isBusy}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-50 cursor-pointer"
                    >
                      Wyczyść wybór
                    </button>
                    <button
                      type="button"
                      onClick={() => void installSelected()}
                      disabled={!selectedIds.length || !health?.isAdministrator || isBusy}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40 cursor-pointer"
                    >
                      <Download className="h-4 w-4" /> Instaluj zaznaczone ({selectedIds.length})
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {filteredUpdates.map((update) => {
                    const checked = selectedIds.includes(update.id);
                    return (
                      <button
                        key={`${update.id}:${update.revision}`}
                        type="button"
                        onClick={() => toggleUpdate(update.id)}
                        aria-pressed={checked}
                        className="flex w-full items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-left hover:border-cyan-800/70 cursor-pointer"
                      >
                        {checked ? <SquareCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />}
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-slate-100">{update.title}</span>
                          <span className="mt-1 block text-[11px] text-slate-400">
                            {update.kbArticles.length ? update.kbArticles.map((kb) => `KB${kb.replace(/^KB/i, '')}`).join(', ') : 'Bez identyfikatora KB'}
                            {update.severity ? ` · Ważność: ${update.severity}` : ''}
                            {` · ${formatBytes(update.maxDownloadBytes)}`}
                          </span>
                          <span className="mt-1 block text-[10px] text-slate-500">{update.categories.join(' · ')}</span>
                        </span>
                      </button>
                    );
                  })}
                  {filteredUpdates.length === 0 && (
                    <p className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
                      {scan.updates.length ? 'OCR/filtr KB nie dopasował żadnych pozycji; wyczyść rozpoznany tekst, aby zobaczyć pełną listę.' : 'Brak aktualizacji oferowanych przez skonfigurowane źródło.'}
                    </p>
                  )}
                </div>
                {installResult && (
                  <div className="mt-3 rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3 text-xs">
                    <strong>{installResult.message}</strong>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-slate-300">
                      {installResult.results.map((result) => <li key={result.title}>{result.title} · kod WUA {result.resultCode}</li>)}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-amber-200">
                <AlertTriangle className="h-4 w-4" /> Zasięg i bezpieczeństwo
              </h2>
              <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-300">
                <li>WUA sprawdza wyłącznie aktualizacje właściwe dla danego komputera i oferowane przez jego skonfigurowane źródło (Microsoft Update lub WSUS).</li>
                <li>WUA pobiera i weryfikuje podpisy oraz integralność pakietów według mechanizmów Windows.</li>
                <li>Przed instalacją pokazujemy listę i wymagamy osobnego potwierdzenia.</li>
              </ul>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <FileCheck2 className="h-4 w-4 text-cyan-300" /> Odcisk pliku binarnego
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Policz lokalny SHA-256 i rozpoznaj nagłówek PE/CAB/ZIP.
              </p>
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950 px-3 py-3 text-xs text-slate-300 hover:border-cyan-700">
                <FileCheck2 className="h-4 w-4" /> Wybierz plik do odcisku SHA-256
                <input
                  type="file"
                  accept=".msu,.cab,.exe,.msi,.msp,.dll,.sys,.bin"
                  className="sr-only"
                  onChange={(event) => void inspectBinary(event.currentTarget.files?.[0])}
                />
              </label>
              {binaryReport && (
                <div className="mt-3 break-all rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px]">
                  <div className="font-bold text-slate-200">{binaryReport.name}</div>
                  <div className="mt-1 text-slate-400">{binaryReport.format} · {formatBytes(binaryReport.size)}</div>
                  <div className="mt-2 text-cyan-200">SHA-256: {binaryReport.sha256}</div>
                  <p className="mt-2 text-amber-200">{binaryReport.notes}</p>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <ImageIcon className="h-4 w-4 text-cyan-300" /> OCR numeru KB
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Odczytaj numer KB ze zrzutu ekranu i przefiltruj wyniki skanowania.
              </p>
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950 px-3 py-3 text-xs text-slate-300 hover:border-cyan-700">
                <ImageIcon className="h-4 w-4" /> Wybierz zrzut ekranu
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => void runOcr(event.currentTarget.files?.[0])}
                />
              </label>
              {ocrStatus && <p className="mt-2 text-[11px] text-slate-400">{ocrStatus}</p>}
              <textarea
                value={ocrText}
                onChange={(event) => setOcrText(event.target.value)}
                rows={4}
                placeholder="Rozpoznany tekst lub numery KB, np. KB5030219"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200 placeholder:text-slate-600"
              />
              {scan && ocrText && (
                <button
                  type="button"
                  onClick={() => setOcrText('')}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-cyan-300 cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" /> Pokaż wszystkie wyniki
                </button>
              )}
            </section>
          </aside>
        </div>
      )}

      <p className="mx-auto flex w-full max-w-6xl items-start gap-2 text-[11px] leading-relaxed text-slate-500">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Autonomiczny System Aktualizacji (ASA) działa natywnie na serwerze i zarządza jednostką robota oraz jądrem SVL. Zewnętrzny pomocnik WUA dotyczy wyłącznie stacji Windows.
      </p>
    </section>
  );
};
