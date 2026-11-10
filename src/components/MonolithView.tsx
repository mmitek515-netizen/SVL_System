import React, { useState } from 'react';
import { ModuleHeader } from './WorkspaceUI';
import { DataStore, generatePythonMonolith, parsePythonMonolith, SYS_VERSION, OPERATOR_NAME } from '../kernel/svlKernel';
import { Copy, Download, Upload, Check, AlertTriangle, FileCode2, RefreshCw } from 'lucide-react';

interface MonolithViewProps {
  dataStore: DataStore;
  onSetDataStore: (newStore: DataStore) => void;
}

export const MonolithView: React.FC<MonolithViewProps> = ({ dataStore, onSetDataStore }) => {
  const [query, setQuery] = useState('');
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [diskCode, setDiskCode] = useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/kernel/script')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.code) {
          setDiskCode(data.code);
        }
      })
      .catch(() => {});
  }, [dataStore]);

  const fullCode = diskCode || generatePythonMonolith(dataStore);
  const linesCount = fullCode.split('\n').length;
  const byteSize = new Blob([fullCode]).size;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullCode).then(()=>setCopied(true)).catch(()=>setImportError('Błąd kopiowania.'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([fullCode], { type: 'text/x-python;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `svl_kernel_${SYS_VERSION.toLowerCase().replace(/[^a-z0-9]/g, '_')}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunImport = async () => {
    if (!importText.trim()) return;
    setImportError(null);
    setImportSuccess(null);

    const result = parsePythonMonolith(importText);
    if (!result.success || !result.dataStore) {
      setImportError(result.error || 'Nieprawidłowy format kodu monolitu.');
      return;
    }

    try {
      const res = await fetch('/api/kernel/save-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: result.dataStore }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      {
        const data = await res.json();
        if (data?.state?.store) {
          onSetDataStore(data.state.store);
        }
      }
    } catch (error) { setImportError(error instanceof Error ? error.message : 'Błąd zapisu'); return; }

    setImportSuccess('Zapisano import.');
    setTimeout(() => {
      setIsImporting(false);
      setImportText('');
      setImportSuccess(null);
    }, 1500);
  };

  return (
    <div className="module-view flex-1 min-h-0 flex flex-col bg-slate-950 text-xs overflow-hidden">
      <ModuleHeader title="Python" meta={`${linesCount} linii · ${byteSize} B`}>
        <button type="button" aria-expanded={isImporting} onClick={()=>setIsImporting(!isImporting)}><Upload size={14}/>{isImporting?'Anuluj import':'Importuj'}</button>
        <button type="button" onClick={handleCopy}><Copy size={14}/>{copied?'Skopiowano':'Kopiuj'}</button>
        <button type="button" onClick={handleDownload}><Download size={14}/>Pobierz</button>
      </ModuleHeader>
      <div className="module-actions p-3"><input aria-label="Szukaj w kodzie Python" placeholder="Filtruj linie…" value={query} onChange={e=>setQuery(e.target.value)}/><label className="flex items-center gap-2"><input type="checkbox" checked={wrap} onChange={e=>setWrap(e.target.checked)}/>Zawijaj linie</label></div>
      {/* Import Drawer (if open) */}
      {isImporting && (
        <div className="p-4 bg-slate-900 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200">
              Wklej zmodyfikowany kod Pythona ze znacznikami &lt;&lt;&lt;DATA_STORE_START&gt;&gt;&gt;
            </span>
            <span className="text-[11px] text-slate-400">
              Jądro zaktualizuje rejestr i czat automatycznie
            </span>
          </div>

          <textarea
            aria-label="Import kodu Python"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Kod lub JSON…"
            rows={5}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-700 font-mono text-xs"
          />

          {importError && (
            <div role="alert" className="flex items-center gap-2 text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-900/40 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {importSuccess && (
            <div role="status" className="flex items-center gap-2 text-emerald-400 bg-slate-900 p-2 rounded border border-slate-700 text-[11px]">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{importSuccess}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setIsImporting(false);
                setImportError(null);
              }}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              Anuluj
            </button>
            <button
              onClick={handleRunImport}
              className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-800 text-slate-950 font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Zapisz import</span>
            </button>
          </div>
        </div>
      )}

      {/* Code Viewer */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-950 select-text">
        <pre className={`text-slate-300 leading-relaxed font-mono text-xs ${wrap?"whitespace-pre-wrap":"whitespace-pre"}`}>
          {fullCode.split('\n').map((line, idx) => {
            if (query && !line.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl'))) return null;
            const lineNum = idx + 1;
            const isTag = line.includes('<<<DATA_STORE_START>>>') || line.includes('<<<DATA_STORE_END>>>');
            const isHeader = line.startsWith('# ==') || line.startsWith('# SVL KERNEL');

            let lineStyle = 'text-slate-300';
            if (isTag) lineStyle = 'text-emerald-400 bg-emerald-950/60 font-bold px-1 rounded';
            else if (isHeader) lineStyle = 'text-purple-400 font-semibold';
            else if (line.startsWith('#')) lineStyle = 'text-slate-500 italic';
            else if (line.includes('class SVLStudioKernel') || line.includes('def ')) lineStyle = 'text-blue-400 font-semibold';

            return (
              <div key={idx} className="flex hover:bg-slate-900/50 py-0.5">
                <span className="w-12 text-right pr-4 text-slate-600 select-none text-[11px]">
                  {lineNum}
                </span>
                <span className={lineStyle}>{line}</span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
};
