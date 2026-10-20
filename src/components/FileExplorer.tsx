import React, { useState, useEffect } from 'react';
import { Download, FileArchive, FileText, RefreshCw, FolderOpen, ShieldCheck } from 'lucide-react';

interface FileInfo {
  name: string;
  size: string;
  type: 'archive' | 'text';
  ctime: string;
}

export const FileExplorer: React.FC = () => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/explorer/files');
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (e) {
      console.warn('Failed to fetch files:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(fetchFiles, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 bg-slate-950 flex flex-col font-mono">
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              Eksplorator Plików DATA_STORE
              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">RING-0 FS</span>
            </h2>
            <p className="text-[10px] text-slate-500">Zdalny dostęp do wyeksportowanych zasobów i raportów Triady.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            UPRAWNIENIA: POBIERANIE AKTYWNE
          </div>
          {loading && <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {files.length === 0 && !loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">
            <FolderOpen className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-xs uppercase tracking-widest">Katalog wyjściowy jest pusty</p>
            <p className="text-[10px] mt-1 italic">Wydaj polecenie agentom, aby wygenerowali plik lub raport.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map((file) => (
              <div 
                key={file.name} 
                className="group p-3 bg-slate-900 border border-slate-800 rounded-lg hover:border-emerald-500/50 transition-all flex items-center gap-4"
              >
                <div className={`p-2.5 rounded-lg border ${file.type === 'archive' ? 'bg-cyan-950/20 border-cyan-800/40 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {file.type === 'archive' ? <FileArchive className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-200 truncate group-hover:text-emerald-300 transition-colors">
                    {file.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500 font-mono">
                    <span>{file.size}</span>
                    <span>•</span>
                    <span className="truncate">{new Date(file.ctime).toLocaleString('pl-PL')}</span>
                  </div>
                </div>
                <a 
                  href={`/api/explorer/download/${file.name}`} 
                  className="p-2 bg-slate-950 border border-slate-800 text-emerald-400 hover:bg-emerald-600 hover:text-slate-950 hover:border-emerald-500 rounded-md transition-all active:scale-90"
                  title="Pobierz plik do katalogu Pobrane"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 border-t border-slate-800 p-3 flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> STATUS: POŁĄCZONO</span>
          <span>POJEMNOŚĆ SZYN: 50MB</span>
        </div>
        <div className="flex items-center gap-2 italic">
          Misja Astyria: System Zarządzania Plikami v1.0
        </div>
      </div>
    </div>
  );
};
