import React, { useState, useEffect } from 'react';
import { EmptyState, ModuleHeader, Panel } from './WorkspaceUI';
import { Download, FileArchive, FileText, RefreshCw, FolderOpen, ShieldCheck, Rocket, GitBranch, UploadCloud } from 'lucide-react';

interface FileInfo {
  name: string;
  size: string;
  type: 'archive' | 'text';
  ctime: string;
}

export const FileExplorer: React.FC = () => {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [readError, setReadError] = useState<string|null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeploys, setPendingDeploys] = useState<string[]>([]);
  const [deploying, setDeploying] = useState<string | 'all' | null>(null);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleGithubSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setDeployMessage(null);
    try {
      const res = await fetch('/api/triad/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'triad', message: 'Synchronizacja prac Triady z GitHub' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeployMessage(data.sha
          ? `Zapisano commit ${data.sha} i wysłano do origin/${data.branch}.`
          : `Brak nowych zmian do commita; origin/${data.branch} jest zsynchronizowane.`);
      } else {
        setDeployMessage(`Błąd synchronizacji z GitHub: ${data.error || `HTTP ${res.status}`}`);
      }
    } catch (e: any) {
      setDeployMessage(`Błąd synchronizacji z GitHub: ${e?.message || 'brak połączenia'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleCommit = async () => {
    if (committing) return;
    setCommitting(true);
    setDeployMessage(null);
    try {
      const res = await fetch('/api/triad/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'triad', message: 'Zapis prac Triady (artefakty, aplikacje, eksporty)' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeployMessage(
          data.committed
            ? `Zapisano w repozytorium: commit ${data.sha} · autor: ${data.author}`
            : data.message || 'Brak zmian do zapisania.'
        );
      } else {
        setDeployMessage(`Błąd zapisu do repo: ${data.error || `HTTP ${res.status}`}`);
      }
    } catch (e: any) {
      setDeployMessage(`Błąd zapisu do repo: ${e?.message || 'brak połączenia'}`);
    } finally {
      setCommitting(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/explorer/files');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFiles(data.files || []); setReadError(null);
    } catch (e) {
      setReadError(e instanceof Error ? e.message : 'Brak połączenia');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeployStatus = async () => {
    try {
      const res = await fetch('/api/triad/deploy/status');
      if (res.ok) {
        const data = await res.json();
        setPendingDeploys(Array.isArray(data.pending) ? data.pending : []);
      }
    } catch {}
  };

  const handleDeploy = async (filename?: string) => {
    if (deploying) return;
    setDeploying(filename ?? 'all');
    setDeployMessage(null);
    try {
      const res = await fetch('/api/triad/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filename ? { filename } : {}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeployMessage(
          data.deployed?.length > 0
            ? `Wdrożono: ${data.deployed.map((d: { name: string }) => d.name).join(', ')}${data.version ? ` · v${data.version}` : ''}`
            : data.message || 'Brak nowych artefaktów do wdrożenia.'
        );
      } else {
        setDeployMessage(`Błąd wdrożenia: ${data.error || `HTTP ${res.status}`}`);
      }
    } catch (e: any) {
      setDeployMessage(`Błąd wdrożenia: ${e?.message || 'brak połączenia'}`);
    } finally {
      setDeploying(null);
      await fetchDeployStatus();
      await fetchFiles();
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchDeployStatus();
    const interval = setInterval(() => {
      fetchFiles();
      fetchDeployStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const visible=files.filter(file=>(kindFilter==='all'||file.type===kindFilter)&&file.name.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl'))).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'pl'):Date.parse(b.ctime)-Date.parse(a.ctime));
  return <section className="module-view module-page">
    <ModuleHeader title="Pliki" meta={`${files.length} plików`}>
      <button type="button" disabled={loading} onClick={()=>{setLoading(true);void fetchFiles();void fetchDeployStatus();}}><RefreshCw size={14}/>Odśwież</button>
      <button type="button" onClick={()=>void handleDeploy()} disabled={deploying!==null||!pendingDeploys.length}><Rocket size={14}/>Wdróż nowe ({pendingDeploys.length})</button>
      <details className="module-disclosure"><summary>Repozytorium</summary><div className="module-actions"><button type="button" onClick={()=>void handleCommit()} disabled={committing}>Zapisz commit</button><button type="button" onClick={()=>void handleGithubSync()} disabled={syncing}>Commit + push</button></div></details>
    </ModuleHeader>
    {readError&&<p role="alert">{readError}</p>}{deployMessage&&<p role="status">{deployMessage}</p>}
    <div className="module-actions"><input aria-label="Szukaj plików" placeholder="Nazwa pliku…" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Typ pliku" value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="all">Wszystkie typy</option><option value="archive">Archiwa</option><option value="text">Tekst</option></select><select aria-label="Sortowanie plików" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Nazwa A–Z</option><option value="date">Najnowsze</option></select></div>
    <Panel title="Eksporty">{visible.length?<div className="module-list">{visible.map(file=><div key={file.name} className="module-row"><div className="flex min-w-0 flex-1 items-center gap-3">{file.type==='archive'?<FileArchive size={18}/>:<FileText size={18}/>}<div className="min-w-0"><strong className="break-all">{file.name}</strong><p>{file.size} · {new Date(file.ctime).toLocaleString('pl')}</p></div></div><div className="module-actions">{pendingDeploys.includes(file.name)&&<button type="button" onClick={()=>void handleDeploy(file.name)} disabled={deploying!==null}>Wdróż</button>}<a className="control-link" href={`/api/explorer/download/${encodeURIComponent(file.name)}`} download aria-label={`Pobierz ${file.name}`}><Download size={14}/>Pobierz</a></div></div>)}</div>:<EmptyState>{loading?'Odczyt…':files.length?'Brak wyników.':'Brak eksportów.'}</EmptyState>}</Panel>
  </section>;
};
