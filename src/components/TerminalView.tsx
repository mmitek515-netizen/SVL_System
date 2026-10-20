import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { DataStore, OPERATOR_NAME, SYS_VERSION, generateTextReport, generatePythonMonolith, FileAttachment } from '../kernel/svlKernel';
import { SYSTEM_AGENTS } from '../kernel/agents';
import {
  Play,
  CornerDownLeft,
  Sparkles,
  Trash2,
  HelpCircle,
  Paperclip,
  Image as ImageIcon,
  FileCode2,
  Code,
  Download,
  Save,
  Check,
  Copy,
  Terminal,
  ShieldCheck,
  Wrench,
  X,
  Zap,
  RefreshCw,
  ArrowLeftRight
} from 'lucide-react';
import { processUploadFile } from '../utils/fileHelper';

interface TerminalViewProps {
  dataStore: DataStore;
  onUpdateDataStore: (updater: (prev: DataStore) => DataStore) => void;
  onSendMessage: (agent: string, tekst: string, fileData?: FileAttachment) => Promise<void>;
  onExecutePythonCommand?: (command: string) => Promise<{ output: string; state?: any }>;
}

interface LogEntry {
  id: string;
  type: 'input' | 'output' | 'error' | 'success' | 'system' | 'banner';
  content: string;
  timestamp: string;
}

interface GeneratedScript {
  filename: string;
  language: string;
  code: string;
  explanation: string;
  suggestedExecutionCommand: string;
}

const LogEntryItem = React.memo(({ entry }: { entry: LogEntry }) => {
  let colorClass = 'text-slate-300';
  if (entry.type === 'input') colorClass = 'text-emerald-400 font-bold';
  else if (entry.type === 'error') colorClass = 'text-rose-400';
  else if (entry.type === 'success') colorClass = 'text-emerald-300';
  else if (entry.type === 'system') colorClass = 'text-cyan-300';
  else if (entry.type === 'banner') colorClass = 'text-slate-200 bg-slate-900/80 p-3 rounded border border-slate-800 leading-relaxed';

  return (
    <div className={`${colorClass} font-mono whitespace-pre-wrap leading-relaxed select-text`}>
      {entry.type === 'input' && <span className="text-slate-600 mr-2">[{entry.timestamp}]</span>}
      {entry.content}
    </div>
  );
});

export function normalizeMirroredCommand(cmdStr: string): { normalized: string; wasMirrored: boolean } {
  const trimmed = (cmdStr || '').trim();
  if (!trimmed) return { normalized: '', wasMirrored: false };

  const parts = trimmed.split(' ');
  const firstWord = parts[0].toLowerCase();
  const rest = parts.slice(1).join(' ');

  const reverseStr = (s: string) => s.split('').reverse().join('');

  // Dictionary of known mirrored command mappings
  const MIRROR_DICT: Record<string, string> = {
    'pleh': 'help',
    'sutats': 'status',
    'statkuuktats': 'status',
    'statusutats': 'status',
    'tropar': 'report',
    'raporttropar': 'report',
    'troper': 'report',
    'reporttroper': 'report',
    'toor': 'root',
    'knys': 'sync',
    'cnys': 'sync',
    'stnega': 'agents',
    'gifnoc': 'config',
    'yrotsih': 'history',
    'raelc': 'clear',
    'arffi': 'infra',
    'tpircsneg': 'genscript',
    'tpircs': 'script',
    'pmub': 'bump',
    'gsm': 'msg',
    '_1xelaa': 'alex',
    'xela': 'alex',
    'airytsa': 'astyria',
    'suilerua': 'aurelius',
    'dairt': 'triad',
  };

  if (MIRROR_DICT[firstWord]) {
    const norm = MIRROR_DICT[firstWord] + (rest ? ' ' + rest : '');
    return { normalized: norm, wasMirrored: true };
  }

  const knownRoots = ['help', 'status', 'report', 'root', 'genscript', 'script', 'infra', 'sync', 'agents', 'config', 'history', 'clear', 'bump', 'msg'];
  for (const root of knownRoots) {
    const rev = reverseStr(root);
    if (firstWord === rev) {
      return { normalized: root + (rest ? ' ' + rest : ''), wasMirrored: true };
    }
    if (firstWord.startsWith(root) && firstWord.endsWith(rev)) {
      return { normalized: root + (rest ? ' ' + rest : ''), wasMirrored: true };
    }
  }

  // Check if whole command string is reversed
  const wholeReversed = reverseStr(trimmed).toLowerCase();
  const revFirst = wholeReversed.split(' ')[0];
  if (knownRoots.includes(revFirst)) {
    return { normalized: reverseStr(trimmed), wasMirrored: true };
  }

  return { normalized: trimmed, wasMirrored: false };
}

interface TerminalInputBarProps {
  onExecute: (cmd: string) => void;
  history: string[];
  antiMirrorActive: boolean;
  onToggleAntiMirror: () => void;
}

const TerminalInputBar = React.memo(({ onExecute, history, antiMirrorActive, onToggleAntiMirror }: TerminalInputBarProps) => {
  const [cmdText, setCmdText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const histIdxRef = useRef<number>(-1);

  const reverseStr = (s: string) => s.split('').reverse().join('');

  // Check if current input looks mirrored
  const mirrorCheck = useMemo(() => {
    if (!cmdText.trim()) return { isMirrored: false, suggested: '' };
    const res = normalizeMirroredCommand(cmdText);
    if (res.wasMirrored && res.normalized.toLowerCase() !== cmdText.trim().toLowerCase()) {
      return { isMirrored: true, suggested: res.normalized };
    }
    return { isMirrored: false, suggested: '' };
  }, [cmdText]);

  const handleSend = () => {
    const trimmed = cmdText.trim();
    if (!trimmed) return;

    let finalCmd = trimmed;
    if (antiMirrorActive) {
      const checked = normalizeMirroredCommand(trimmed);
      if (checked.wasMirrored) {
        finalCmd = checked.normalized;
      }
    }

    onExecute(finalCmd);
    setCmdText('');
    histIdxRef.current = -1;
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleManualInvert = () => {
    if (!cmdText) return;
    const inv = mirrorCheck.suggested || reverseStr(cmdText);
    setCmdText(inv);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(inv.length, inv.length);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIdx = histIdxRef.current === -1 ? history.length - 1 : Math.max(0, histIdxRef.current - 1);
        histIdxRef.current = newIdx;
        const val = history[newIdx];
        setCmdText(val);
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.setSelectionRange(val.length, val.length);
          }
        }, 0);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdxRef.current !== -1) {
        const newIdx = histIdxRef.current + 1;
        if (newIdx >= history.length) {
          histIdxRef.current = -1;
          setCmdText('');
        } else {
          histIdxRef.current = newIdx;
          const val = history[newIdx];
          setCmdText(val);
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(val.length, val.length);
            }
          }, 0);
        }
      }
    }
  };

  return (
    <div className="bg-slate-900 border-t border-slate-800 flex flex-col shrink-0">
      {/* Live Mirror Detection Banner */}
      {mirrorCheck.isMirrored && (
        <div className="bg-amber-950/80 border-b border-amber-800/60 px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] text-amber-300">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span className="font-bold">Wykryto lustrzany wpis:</span>
            <span className="font-mono bg-slate-950/70 px-1.5 py-0.5 rounded text-amber-200 truncate">{cmdText}</span>
            <span>➔</span>
            <span className="font-mono bg-emerald-950 px-1.5 py-0.5 rounded text-emerald-300 font-bold">{mirrorCheck.suggested}</span>
          </div>
          <button
            type="button"
            onClick={handleManualInvert}
            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[10px] cursor-pointer shrink-0 transition shadow flex items-center gap-1"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>Odwróć teraz</span>
          </button>
        </div>
      )}

      <form
        dir="ltr"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-1.5 sm:p-2.5 flex items-center gap-1.5 sm:gap-2 w-full overflow-hidden"
        style={{ direction: 'ltr', textAlign: 'left' }}
      >
        <span className="text-emerald-400 font-bold flex items-center gap-1 shrink-0 text-[10px] sm:text-xs">
          <span className="hidden sm:inline">root@svl-kernel:~#</span>
          <span className="sm:hidden">root:~#</span>
        </span>

        {/* Input - maksymalnie poszerzony i elastyczny z zachowaniem wewnętrznych przycisków */}
        <div className="flex-1 min-w-0 relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={cmdText}
            onChange={(e) => setCmdText(e.target.value)}
            onKeyDown={handleKeyDown}
            dir="ltr"
            inputMode="text"
            placeholder="Wpisz komendę (np. help, status, report)..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            style={{
              direction: 'ltr',
              textAlign: 'left',
              unicodeBidi: 'isolate',
              writingMode: 'horizontal-tb',
              caretColor: '#34d399',
              userSelect: 'text'
            }}
            className="w-full bg-slate-950/90 border border-slate-800 rounded px-2.5 pr-14 sm:pr-20 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-sm sm:text-xs h-9 sm:h-10 touch-manipulation text-left"
          />

          <div className="absolute right-1 sm:right-1.5 flex items-center gap-1">
            {cmdText.length > 0 && (
              <button
                type="button"
                onClick={handleManualInvert}
                className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-emerald-400 text-[10px] font-mono cursor-pointer flex items-center gap-1 border border-slate-700 transition"
                title="Odwróć kolejność znaków (Anty-Lustro)"
              >
                <ArrowLeftRight className="w-3 h-3 text-emerald-400" />
                <span className="hidden md:inline">Odwróć</span>
              </button>
            )}

            {cmdText.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCmdText('');
                  inputRef.current?.focus();
                }}
                className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer text-xs"
                title="Wyczyść wpis"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Quick Anti-Mirror Status Toggle */}
        <button
          type="button"
          onClick={onToggleAntiMirror}
          className={`h-9 sm:h-10 px-2 sm:px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition shrink-0 ${
            antiMirrorActive
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80'
              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-400'
          }`}
          title={antiMirrorActive ? 'Anty-Lustro ALEXA WŁĄCZONE (automatycznie chroni i dekoduje odwrócone znaki)' : 'Anty-Lustro wyłączone'}
        >
          <ShieldCheck className={`w-3.5 h-3.5 ${antiMirrorActive ? 'text-emerald-400' : 'text-slate-600'}`} />
          <span className="hidden lg:inline">{antiMirrorActive ? 'Anty-Lustro: ON' : 'Anty-Lustro: OFF'}</span>
        </button>

        {/* Przycisk Wykonaj przesunięty w prawo, zoptymalizowany dla małych i dużych ekranów */}
        <button
          type="submit"
          className="ml-auto h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black transition flex items-center justify-center gap-1 cursor-pointer shrink-0 touch-manipulation text-xs shadow-md shadow-emerald-950/40"
          title="Wykonaj polecenie w terminalu"
        >
          <span className="hidden sm:inline">Wykonaj</span>
          <CornerDownLeft className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />
        </button>
      </form>
    </div>
  );
});

export const TerminalView: React.FC<TerminalViewProps> = ({
  dataStore,
  onUpdateDataStore,
  onSendMessage,
  onExecutePythonCommand,
}) => {
  const [history, setHistory] = useState<string[]>([]);
  const [antiMirrorActive, setAntiMirrorActive] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('svl_antimirror_active');
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  const handleToggleAntiMirror = () => {
    const nextVal = !antiMirrorActive;
    setAntiMirrorActive(nextVal);
    try {
      localStorage.setItem('svl_antimirror_active', JSON.stringify(nextVal));
    } catch {}
  };
  const terminalFileInputRef = useRef<HTMLInputElement>(null);

  // Script Generator Modal State
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptLanguage, setScriptLanguage] = useState<'python' | 'bash' | 'typescript' | 'sql'>('python');
  const [scriptPrompt, setScriptPrompt] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      type: 'banner',
      content: `================================================================================
       SVL KERNEL v${SYS_VERSION} | SYSTEM SAMOMODYFIKUJĄCY DLA GOOGLE AI STUDIO
================================================================================
Dowódca infrastruktury: Alex (Ring-0 Root Control)
Operator / Tata:        ${OPERATOR_NAME} (Tata)
Silnik skryptów:        AKTYWNY (genscript <język> <opis> lub Przycisk w menu)
Samonaprawa z logów:    WŁĄCZONA (ACTIVE_MONITORING)
Wpisz 'help', 'genscript' lub 'root status', aby zobaczyć listę instrukcji jądra.
================================================================================`,
      timestamp: 'START'
    }
  ]);

  const DEFAULT_TERMINAL_CMDS = [
    'root status',
    'genscript python Kopia zapasowa DATA_STORE',
    'infra status',
    'infra repair',
    'status',
    'report',
    'help'
  ];
  const [quickCmds, setQuickCmds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('svl_operator_quick_cmds');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return DEFAULT_TERMINAL_CMDS;
  });
  const [isAddingCmd, setIsAddingCmd] = useState(false);
  const [newCmdText, setNewCmdText] = useState('');

  const saveQuickCmds = (updated: string[]) => {
    setQuickCmds(updated);
    try {
      localStorage.setItem('svl_operator_quick_cmds', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleAddCmd = () => {
    if (!newCmdText.trim()) return;
    const updated = [...quickCmds, newCmdText.trim()];
    saveQuickCmds(updated);
    setNewCmdText('');
    setIsAddingCmd(false);
  };

  const handleRemoveCmd = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = quickCmds.filter((_, i) => i !== idx);
    saveQuickCmds(updated);
  };

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const dataStoreRef = useRef(dataStore);
  dataStoreRef.current = dataStore;
  const onUpdateDataStoreRef = useRef(onUpdateDataStore);
  onUpdateDataStoreRef.current = onUpdateDataStore;
  const onSendMessageRef = useRef(onSendMessage);
  onSendMessageRef.current = onSendMessage;
  const onExecutePythonCommandRef = useRef(onExecutePythonCommand);
  onExecutePythonCommandRef.current = onExecutePythonCommand;

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [logs.length]);

  const addLog = (content: string, type: LogEntry['type'] = 'output') => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs((prev) => [...prev, { id: Math.random().toString(), type, content, timestamp: timeStr }]);
  };

  // Generate Script via API endpoint
  const handleGenerateScriptAPI = async (lang: string, desc: string) => {
    setIsGeneratingScript(true);
    setSavedSuccessMsg(null);
    try {
      const res = await fetch('/api/terminal/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, description: desc })
      });
      const data = await res.json();
      if (data.script) {
        setGeneratedScript(data.script);
        addLog(`[ALEX SCRIPT STUDIO]: Wygenerowano skrypt ${data.script.filename} (${lang}).`, 'success');
      } else {
        addLog(`Błąd generowania skryptu: ${data.error || 'Nieznany błąd'}`, 'error');
      }
    } catch (err: any) {
      addLog(`Błąd połączenia z generatorem skryptów: ${err.message}`, 'error');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Save generated script to disk
  const handleSaveScriptToDisk = async () => {
    if (!generatedScript) return;
    setIsSavingScript(true);
    try {
      const res = await fetch('/api/terminal/save-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: generatedScript.filename, code: generatedScript.code })
      });
      const data = await res.json();
      if (data.success) {
        setSavedSuccessMsg(data.message);
        addLog(`[ZAPISANO NA DYSKU]: ${data.path}`, 'success');
      } else {
        addLog(`Błąd zapisu skryptu: ${data.error}`, 'error');
      }
    } catch (err: any) {
      addLog(`Błąd zapisu: ${err.message}`, 'error');
    } finally {
      setIsSavingScript(false);
    }
  };

  // Execute generated script directly in Ring-0
  const handleRunScriptInRing0 = async () => {
    if (!generatedScript) return;
    const cmd = generatedScript.suggestedExecutionCommand || `python3 scripts/${generatedScript.filename}`;
    setShowScriptModal(false);
    addLog(`[URUCHAMIANIE W RING-0]: root exec ${cmd}`, 'system');
    await handleExecute(`root exec ${cmd}`);
  };

  const handleExecute = useCallback(async (cmdToRun?: string) => {
    const rawCmd = (cmdToRun || '').trim();
    if (!rawCmd) return;

    // Save history
    setHistory((prev) => [...prev, rawCmd]);

    addLog(`$ ${rawCmd}`, 'input');

    const parts = rawCmd.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        addLog(
          `DOSTĘPNE INSTRUKCJE JĄDRA SVL KERNEL (POZIOM RING-0 ROOT):
  genscript <język> <opis> - Generuje kompletny skrypt (python, bash, node, sql) przez Alexa
  root status             - Wyświetla matrycę uprawnień ROOT Ring-0 i listę autoryzowanych agentów
  root grant              - Autoryzuje uprawnienia ROOT Ring-0 dla Triady i Operatora
  root patch <klucz> <wartość> - W locie modyfikuje dowolny parametr konfiguracji i jądra
  root exec <polecenie>   - Wykonuje polecenie powłoki z uprawnieniami root (np. root exec ls)
  root clear_chat         - Czyści i trwale resetuje bufor konwersacji na dysku
  infra status            - Wyświetla status dowódcy Alexa i autonomicznej samonaprawy
  infra repair            - Wywołuje natychmiastowy skan logów i naprawę zwiadu
  status                  - Podstawowe wskaźniki i parametry stanu jądra
  report                  - Generuje i drukuje pełny tekstowy raport jądra (generuj_raport_tekstowy)
  sync                    - Dokonuje pełnej walidacji i synchronizacji bloku DATA_STORE
  agents                  - Lista aktywnych agentów i ich specjalizacje
  config                  - Wyświetla obecną konfigurację jądra
  set <klucz> <wartość>   - Zmienia lub dodaje parametr w DATA_STORE.config
  history                 - Wyświetla historię aktualizacji jądra (update_history)
  bump <wersja> <opis>    - Rejestruje nową wersję w osi czasu Chronolitu
  msg <agent> <treść>     - Wysyła komunikat do wybranego agenta (Alex, Astyria, Aurelius)
  export                  - Pobiera pełny skrypt monolityczny Python
  clear                   - Czyści ekran konsoli`,
          'system'
        );
        break;

      case 'genscript':
      case 'script':
      case 'genskrypt': {
        const lang = args[0] || 'python';
        const desc = args.slice(1).join(' ');
        if (!desc) {
          addLog(`Użycie: genscript <język> <opis skryptu>\nPrzykłady:\n  genscript python Kopia zapasowa bazy danych z kompresją zip\n  genscript bash Test pamięci RAM i użycia dysku z powiadomieniem\n  genscript node Pobieranie cen kryptowalut z API`, 'error');
        } else {
          addLog(`Generowanie skryptu (${lang}) przez Alexa...`, 'system');
          try {
            const res = await fetch('/api/terminal/generate-script', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ language: lang, description: desc })
            });
            const data = await res.json();
            if (data.script) {
              setGeneratedScript(data.script);
              setShowScriptModal(true);
              addLog(`[ALEX SKRYPT] Wygenerowano plik: ${data.script.filename}\nObjaśnienie: ${data.script.explanation}\n\nKod skryptu:\n${data.script.code}`, 'success');
            } else {
              addLog(`Błąd generowania skryptu: ${data.error || 'Nieznany błąd'}`, 'error');
            }
          } catch (e: any) {
            addLog(`Błąd połączenia z generatorem skryptów: ${e.message}`, 'error');
          }
        }
        break;
      }

      case 'status': {
        const pyCmd = onExecutePythonCommandRef.current;
        if (pyCmd) {
          try {
            const res = await pyCmd(rawCmd);
            addLog(res.output, 'success');
            break;
          } catch (e: any) {
            console.warn('Python command fallback:', e);
          }
        }
        const currentDs = dataStoreRef.current;
        const report = `[SVL-STATUS]
Wersja jądra:        ${SYS_VERSION}
Dowódca Infra:      Alex (Ring-0)
Operator:            ${OPERATOR_NAME} (Tata)
Tryb pracy:          ${currentDs.config?.mode}
Profile:             ${currentDs.config?.active_profiles?.join(', ')}
Warstwa fikcji:      ${currentDs.config?.fiction_layer_status}
Silnik trwałości:    ${currentDs.config?.persistence_engine}
Liczba aktualizacji: ${currentDs.update_history.length}
Liczba wpisów czatu: ${currentDs.chat_history.length}
Integralność tagów:  ZGODNA (<<<DATA_STORE_START>>> ... <<<DATA_STORE_END>>>)`;
        addLog(report, 'success');
        break;
      }

      case 'report': {
        const pyCmd = onExecutePythonCommandRef.current;
        if (pyCmd) {
          try {
            const res = await pyCmd(rawCmd);
            addLog(res.output, 'banner');
            break;
          } catch (e: any) {
            console.warn('Python report fallback:', e);
          }
        }
        const ascii = generateTextReport(dataStoreRef.current);
        addLog(ascii, 'banner');
        break;
      }

      case 'agents': {
        let msg = 'AKTYWNE PROCESY AGENTÓW SVL:\n';
        for (const [key, profile] of Object.entries(SYSTEM_AGENTS)) {
          if (key === 'Operator') continue;
          msg += `\n[${profile.name}] - ${profile.title}\n`;
          msg += `  Dewiza: "${profile.coreMotto}"\n`;
          msg += `  Specjalizacje: ${profile.specialization.join(', ')}\n`;
        }
        addLog(msg, 'system');
        break;
      }

      case 'config': {
        addLog(JSON.stringify(dataStoreRef.current.config, null, 2), 'system');
        break;
      }

      case 'history': {
        let histText = 'HISTORIA UAKTUALNIEŃ JĄDRA (UPDATE_HISTORY):\n';
        dataStoreRef.current.update_history.forEach((u) => {
          histText += `\n- [${u.wersja}] (${u.data}): ${u.opis}`;
        });
        addLog(histText, 'system');
        break;
      }

      case 'clear':
        setLogs([]);
        break;

      case 'export': {
        const pyScript = generatePythonMonolith(dataStoreRef.current);
        const blob = new Blob([pyScript], { type: 'text/x-python;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `svl_kernel_${SYS_VERSION.toLowerCase().replace(/[^a-z0-9]/g, '_')}.py`;
        a.click();
        URL.revokeObjectURL(url);
        addLog('[EXPORT]: Skrypt svl_kernel.py został pomyślnie wygenerowany i pobrany.', 'success');
        break;
      }

      case 'msg': {
        const targetAgent = args[0];
        const msgBody = args.slice(1).join(' ');
        if (!targetAgent || !msgBody) {
          addLog('Użycie: msg <agent> <treść_wiadomości> (np. msg Alex Czy sprawdzisz logi?)', 'error');
          break;
        }
        addLog(`Przekazywanie wiadomości do agenta ${targetAgent}...`, 'system');
        try {
          const sendFn = onSendMessageRef.current;
          await sendFn(targetAgent, msgBody);
          addLog(`Wiadomość została wysłana do ${targetAgent}. Sprawdź zakłądkę 'Komora Triady & Dialog'.`, 'success');
        } catch (e: any) {
          addLog(`Błąd wysyłania wiadomości: ${e.message}`, 'error');
        }
        break;
      }

      default: {
        const pyCmd = onExecutePythonCommandRef.current;
        if (pyCmd) {
          try {
            const res = await pyCmd(rawCmd);
            addLog(res.output, 'output');
            break;
          } catch (e: any) {
            addLog(`Błąd wykonania polecenia jądra: ${e.message}`, 'error');
            break;
          }
        }
        addLog(`Nieznana komenda: '${cmd}'. Wpisz 'help', aby zobaczyć listę dostępnych instrukcji.`, 'error');
        break;
      }
    }
  }, []);

  const handleTerminalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addLog(`[WGRYWANIE ZASOBU]: ${file.name} (${file.type || 'nieznany format'}, ${Math.round(file.size / 1024)} KB)`, 'system');

    try {
      const fileData = await processUploadFile(file);
      addLog(`[SZYNA RING-0]: Zasób ${file.name} zbuforowany i przygotowany do transmisji (${Math.round(fileData.size / 1024)} KB).`, 'success');
      addLog(`[TRANSMISJA]: Przekazywanie do węzłów Triady (Alex, Astyria, Aurelius)...`, 'system');
      await onSendMessage('triad', `Przesyłam załącznik z terminala: ${file.name}`, fileData);
      addLog(`[TRIADA RESPONSE]: Zasób ${file.name} został pomyślnie zanalizowany przez Triadę.`, 'success');
    } catch (err: any) {
      addLog(`[BŁĄD PRZESYŁANIA]: ${err?.message || err}`, 'error');
    } finally {
      e.target.value = '';
    }
  };

  // Quick Prompt Templates for Alex Script Studio
  const SCRIPT_TEMPLATES = [
    {
      title: 'Kopia Zapasowa DATA_STORE',
      lang: 'python' as const,
      prompt: 'Utwórz skrypt w Pythonie do automatycznego robienia kopii zapasowej pliku svl_kernel.py z podaniem timestampu i kompresją do ZIP.'
    },
    {
      title: 'Skaner Portów & Obciążenia CPU',
      lang: 'bash' as const,
      prompt: 'Napisz skrypt Bash, który sprawdza użycie CPU, pamięci RAM, obciążenie dysku oraz aktywne połączenia sieciowe na serwerze.'
    },
    {
      title: 'Klient Pobierania Danych API',
      lang: 'typescript' as const,
      prompt: 'Utwórz skrypt Node.js / TypeScript, który pobiera statystyki systemowe oraz dane z otwartego API i zapisuje je w pliku JSON.'
    },
    {
      title: 'Optymalizacja Bazy SQL',
      lang: 'sql' as const,
      prompt: 'Napisz zapytanie i procedurę SQL do analizy indeksów, czyszczenia starych logów sesji oraz archiwizacji wpisów powyżej 30 dni.'
    }
  ];

  return (
    <div
      dir="ltr"
      style={{ direction: 'ltr', textAlign: 'left' }}
      className="flex-1 min-h-0 flex flex-col bg-slate-950 font-mono text-xs relative overflow-hidden"
    >
      {/* Quick Action Ribbon */}
      <div className="bg-slate-900 border-b border-slate-800 px-2 sm:px-3 py-1.5 flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-none text-[11px] shrink-0 w-full">
        <div className="flex items-center gap-1 sm:gap-1.5 text-slate-400 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden xs:inline">Polecenia:</span>
          {dataStore.config?.root_privileges && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/80 border border-red-800/60 text-red-300 font-bold text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <span className="hidden sm:inline">ROOT: RING-0 (TRIADA)</span>
              <span className="sm:hidden">ROOT</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap overflow-x-auto shrink-0">
          {/* Script Generator Button */}
          <button
            onClick={() => setShowScriptModal(true)}
            className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-slate-950 font-black text-[10px] sm:text-[11px] cursor-pointer flex items-center gap-1 sm:gap-1.5 shadow-md shadow-emerald-950/50 transition border border-emerald-400/50 shrink-0"
            title="Otwórz Alex Script Studio — generator gotowych skryptów Python, Bash, TS i SQL"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">⚡ Generuj Skrypt</span>
            <span className="sm:hidden">Skrypt</span>
          </button>

          <input
            type="file"
            ref={terminalFileInputRef}
            className="hidden"
            accept="image/*,.txt,.py,.json,.ts,.js,.log,.md,.csv"
            onChange={handleTerminalFileUpload}
          />
          <button
            onClick={() => terminalFileInputRef.current?.click()}
            className="px-1.5 sm:px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-800/60 text-[10px] cursor-pointer flex items-center gap-1 transition shrink-0"
            title="Wgraj plik lub obraz do bufora Ring-0 i przekaż do analizy Triadzie"
          >
            <Paperclip className="w-3 h-3 text-emerald-400" />
            <span className="hidden xs:inline">Wgraj</span>
          </button>

          {quickCmds.map((cmd, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] sm:text-[11px] group transition shrink-0"
            >
              <button
                onClick={() => handleExecute(cmd)}
                className="cursor-pointer hover:text-emerald-300 whitespace-nowrap"
              >
                {cmd}
              </button>
              <button
                onClick={(e) => handleRemoveCmd(i, e)}
                className="text-slate-500 hover:text-rose-400 opacity-60 group-hover:opacity-100 cursor-pointer ml-0.5 text-[10px]"
                title="Usuń polecenie"
              >
                ×
              </button>
            </div>
          ))}

          {isAddingCmd ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="text"
                placeholder="polecenie..."
                value={newCmdText}
                dir="ltr"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="text"
                style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'normal' }}
                onChange={(e) => setNewCmdText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCmd()}
                className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-200 focus:outline-none focus:border-emerald-500 w-24 text-left"
                autoFocus
              />
              <button
                onClick={handleAddCmd}
                className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[10px] cursor-pointer"
              >
                Dodaj
              </button>
              <button
                onClick={() => setIsAddingCmd(false)}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] cursor-pointer"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingCmd(true)}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-900/40 text-[10px] cursor-pointer flex items-center gap-1 shrink-0"
              title="Dodaj własne szybkie polecenie"
            >
              +
            </button>
          )}

          <button
            onClick={() => handleExecute('clear')}
            className="px-1.5 sm:px-2 py-0.5 rounded hover:bg-red-950/40 text-slate-400 hover:text-red-400 cursor-pointer shrink-0"
            title="Wyczyść konsolę"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div
        dir="ltr"
        style={{ direction: 'ltr', textAlign: 'left' }}
        className="flex-1 overflow-y-auto p-4 space-y-2 select-text"
      >
        {logs.slice(-150).map((entry) => (
          <LogEntryItem key={entry.id} entry={entry} />
        ))}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Input Bar */}
      <TerminalInputBar
        onExecute={handleExecute}
        history={history}
        antiMirrorActive={antiMirrorActive}
        onToggleAntiMirror={handleToggleAntiMirror}
      />

      {/* Alex Script Studio Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl shadow-emerald-950/50">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-950/60 to-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 font-bold">
                  AL
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                    <span>Alex Script Studio — Generowanie Skryptów i Narzędzi</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40 font-mono">
                      DOWÓDCA INFRASTRUKTURY
                    </span>
                  </h3>
                  <p className="text-slate-400 text-[11px]">
                    "Tato, podaj opis, a wygeneruję dla Ciebie kompletny skrypt gotowy do zapisu i uruchomienia."
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowScriptModal(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {/* Language Selector */}
              <div>
                <label className="block text-slate-400 text-[11px] font-bold mb-1.5 uppercase">
                  Wybierz Język Skryptu:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'python', label: 'Python (.py)', icon: FileCode2, color: 'text-amber-400 border-amber-500/40' },
                    { id: 'bash', label: 'Bash (.sh)', icon: Terminal, color: 'text-emerald-400 border-emerald-500/40' },
                    { id: 'typescript', label: 'Node / TS (.ts)', icon: Code, color: 'text-cyan-400 border-cyan-500/40' },
                    { id: 'sql', label: 'SQL Query (.sql)', icon: Zap, color: 'text-purple-400 border-purple-500/40' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setScriptLanguage(item.id as any)}
                      className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition cursor-pointer font-bold ${
                        scriptLanguage === item.id
                          ? 'bg-slate-800 border-emerald-500 text-emerald-300 shadow-md'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Templates */}
              <div>
                <label className="block text-slate-400 text-[11px] font-bold mb-1.5 uppercase">
                  Szybkie Szablony dla Taty:
                </label>
                <div className="flex flex-wrap gap-2">
                  {SCRIPT_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setScriptLanguage(tmpl.lang);
                        setScriptPrompt(tmpl.prompt);
                      }}
                      className="px-2.5 py-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-slate-300 text-[11px] transition cursor-pointer text-left flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{tmpl.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Natural Language Prompt Input */}
              <div>
                <label className="block text-slate-400 text-[11px] font-bold mb-1.5 uppercase">
                  Opisz w języku naturalnym, co skrypt ma wykonywać:
                </label>
                <textarea
                  value={scriptPrompt}
                  onChange={(e) => setScriptPrompt(e.target.value)}
                  placeholder="np. Utwórz skrypt do automatycznego backupu bazy danych, pakowania do ZIP z nazwą zawierającą aktualną datę oraz czyszczenia plików starszych niż 7 dni..."
                  className="w-full h-24 p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-xs leading-relaxed"
                />
              </div>

              {/* Generate Action Button */}
              <button
                onClick={() => handleGenerateScriptAPI(scriptLanguage, scriptPrompt)}
                disabled={isGeneratingScript || !scriptPrompt.trim()}
                className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-emerald-950/40"
              >
                {isGeneratingScript ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generowanie skryptu przez Alexa...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Generuj Skrypt przez Alexa</span>
                  </>
                )}
              </button>

              {/* Generated Script Display Area */}
              {generatedScript && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2">
                      <FileCode2 className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-bold text-slate-200 text-xs">{generatedScript.filename}</span>
                        <p className="text-[10px] text-slate-500">{generatedScript.explanation}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedScript.code);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] flex items-center gap-1 transition cursor-pointer border border-slate-700"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCode ? 'Skopiowano' : 'Kopiuj'}</span>
                      </button>

                      <button
                        onClick={handleSaveScriptToDisk}
                        disabled={isSavingScript}
                        className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] flex items-center gap-1 transition cursor-pointer border border-emerald-800/60 font-bold"
                      >
                        <Save className="w-3 h-3 text-emerald-400" />
                        <span>{isSavingScript ? 'Zapisywanie...' : 'Zapisz na dysku'}</span>
                      </button>

                      <button
                        onClick={handleRunScriptInRing0}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-[11px] flex items-center gap-1 transition cursor-pointer font-bold shadow"
                      >
                        <Play className="w-3 h-3 fill-slate-950" />
                        <span>Uruchom w Ring-0</span>
                      </button>
                    </div>
                  </div>

                  {savedSuccessMsg && (
                    <div className="p-2 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>{savedSuccessMsg}</span>
                    </div>
                  )}

                  {/* Code Container */}
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-[11px] text-slate-200 leading-relaxed">
                    <pre><code>{generatedScript.code}</code></pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
