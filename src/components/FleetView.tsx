import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Database, RefreshCw, Satellite, ShieldCheck, Search, Plus, Map, List, LocateFixed, Download, ArrowUpDown } from 'lucide-react';

type Kind = 'ship' | 'station' | 'outpost' | 'relay';
type Position = { coordinateFrame: string; xAu: number; yAu: number; zAu: number };
type Vessel = {
  id: string; name: string; kind: Kind; missionPlan: string; missionStatus: string;
  connection: 'recent-authenticated-report' | 'unverified'; position: Position | null;
  lastObservationAt: string | null; positionAgeMs: number | null;
  provenance: { source: string; sourceId: string; sourceRef: string; receivedAt: string; reportedWanIp: string | null } | null;
  eta: null;
};
type Snapshot = { timestamp: string; source: string; vessels: Vessel[]; disclaimer: string };
type View = 'map' | 'list';
type Filter = 'all' | 'fresh' | 'unknown';
const kindLabels: Record<Kind, string> = {
  ship: 'Statek', station: 'Stacja', outpost: 'Placówka', relay: 'Przekaźnik',
};
const fmtDate = (stamp: string | null) => stamp ? new Date(stamp).toLocaleString('pl-PL') : 'Brak danych';
const finite = (n: number) => Number.isFinite(n) ? n.toFixed(5) + ' AU' : '—';

export const FleetView: React.FC = () => {
  const [tokenInput, setTokenInput] = useState('');
  const [token, setToken] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('ship');
  const [missionPlan, setMissionPlan] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [kindFilter, setKindFilter] = useState<Kind | 'all'>('all');
  const [sort, setSort] = useState<'name' | 'recent'>('name');
  const requestRef = useRef<AbortController | null>(null);
  const sessionRef = useRef(0);
  const freshPosition = (v: Vessel) => v.position !== null && v.connection === 'recent-authenticated-report';

  const refresh = useCallback(async () => {
    if (!token) { setSnapshot(null); return; }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const response = await fetch('/api/fleet', {
        signal: controller.signal, cache: 'no-store', headers: { Authorization: 'Bearer ' + token },
      });
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== 'object' ||
          (data as { success?: boolean }).success !== true ||
          !Array.isArray((data as { vessels?: unknown }).vessels)) {
        const msg = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error : 'Nie można pobrać rejestru';
        throw new Error(msg + ' (HTTP ' + response.status + ')');
      }
      if (controller.signal.aborted) return;
      setSnapshot(data as Snapshot);
      setError(null);
    } catch (e) {
      if (controller.signal.aborted) return;
      setSnapshot(null);
      setError(e instanceof Error ? e.message : 'Brak połączenia z Flotą');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void refresh();
    const interval = autoRefresh ? window.setInterval(() => void refresh(), 15000) : null;
    window.addEventListener('focus', refresh);
    return () => {
      if (interval) window.clearInterval(interval);
      requestRef.current?.abort();
      window.removeEventListener('focus', refresh);
    };
  }, [refresh, token, autoRefresh]);

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !name.trim() || saving) return;
    const session = sessionRef.current;
    setSaving(true);
    try {
      const response = await fetch('/api/fleet/ships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name: name.trim(), kind, missionPlan }),
      });
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error(data.error || 'Błąd zapisu');
      if (session !== sessionRef.current) return;
      setName(''); setMissionPlan(''); setFormOpen(false); setSelectedId(data.id);
      await refresh();
    } catch (e) {
      if (session === sessionRef.current) setError(e instanceof Error ? e.message : 'Nie udało się zarejestrować obiektu');
    } finally { setSaving(false); }
  };

  const fresh = useMemo(() => snapshot?.vessels.filter(freshPosition) ?? [], [snapshot]);
  const visible = useMemo(() => (snapshot?.vessels ?? []).filter(v =>
    (filter === 'all' || (filter === 'fresh' ? freshPosition(v) : !freshPosition(v))) &&
    (kindFilter === 'all' || v.kind === kindFilter) &&
    (v.name + ' ' + v.id + ' ' + v.missionPlan).toLocaleLowerCase('pl-PL').includes(search.toLocaleLowerCase('pl-PL'))
  ).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'pl') :
    (Date.parse(b.lastObservationAt || '') || 0) - (Date.parse(a.lastObservationAt || '') || 0)), [snapshot, filter, search, kindFilter, sort]);
  const visiblePoints = visible.filter(v => freshPosition(v) && v.position?.coordinateFrame === 'heliocentric_ecliptic_J2000');
  const scale = Math.max(1, ...fresh.map(v => Math.max(Math.abs(v.position!.xAu),
    Math.abs(v.position!.yAu)))) * 1.2;
  const selected = snapshot?.vessels.find(v => v.id === selectedId) ?? null;

  return <section className="module-view min-h-0 flex-1 overflow-y-auto bg-slate-950 p-3 text-slate-100 md:p-6">
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-cyan-100">
            <Satellite className="h-5 w-5" /> Flota
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Rejestr · telemetria · misje
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void refresh()} disabled={!token || loading}
            className="flex items-center gap-2 rounded border border-cyan-800 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40">
            <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /> Odśwież
          </button>
          <button type="button" onClick={() => setFormOpen(v => !v)} disabled={!token}
            className="flex items-center gap-2 rounded bg-cyan-800 px-3 py-2 text-xs font-bold disabled:opacity-40">
            <Plus className="h-4 w-4" /> Dodaj obiekt
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-slate-700 bg-slate-900/90 p-3">
        <form onSubmit={e => { e.preventDefault(); requestRef.current?.abort(); sessionRef.current++; setSnapshot(null); setSelectedId(null); setError(null); if (tokenInput.trim() === token) void refresh(); else setToken(tokenInput.trim()); }}
          className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs text-slate-300">
            Token operatora
            <input type="password" autoComplete="off" value={tokenInput} onChange={e => setTokenInput(e.target.value)}
              placeholder="Token dostępu" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 outline-none focus:border-cyan-400"/>
          </label>
          <button type="submit" disabled={!tokenInput.trim()}
            className="rounded border border-cyan-700 px-3 py-2 text-xs text-cyan-100 disabled:opacity-40">Połącz</button>
          <button type="button" onClick={() => {requestRef.current?.abort(); sessionRef.current++; setToken(''); setTokenInput(''); setSnapshot(null); setError(null); setSelectedId(null); setFormOpen(false); setLoading(false);}}
            className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-300">Odłącz</button>
        </form>
        {error && <div role="alert" className="mt-2 flex items-center gap-2 text-xs text-rose-300">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>}
        <p className="mt-2 text-[11px] text-slate-500">
          {snapshot ? 'API połączone · ostatni odczyt ' + fmtDate(snapshot.timestamp) :
            'API offline / niezweryfikowane'}
        </p>
      </div>

      {formOpen && <form onSubmit={register} className="grid gap-3 rounded-xl border border-cyan-800 bg-slate-900 p-4 md:grid-cols-2">
        <div className="md:col-span-2 text-sm font-semibold">Nowy wpis w rejestrze</div>
        <label className="text-xs">Nazwa
          <input required maxLength={120} value={name} onChange={e => setName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
        </label>
        <label className="text-xs">Typ
          <select value={kind} onChange={e => setKind(e.target.value as Kind)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2">
            {Object.entries(kindLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs md:col-span-2">Plan misji
          <textarea rows={2} maxLength={1000} value={missionPlan} onChange={e => setMissionPlan(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
        </label>
        <button type="button" onClick={() => setFormOpen(false)} className="rounded border border-slate-700 px-4 py-2 text-xs">Anuluj</button>
        <button type="submit" disabled={!token || saving || !name.trim()}
          className="rounded bg-cyan-800 px-4 py-2 text-xs font-bold disabled:opacity-40">
          {saving ? 'Zapisuję…' : 'Zapisz do rejestru'}
        </button>
      </form>}

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <label className="flex items-center gap-2"><input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}/>Auto · 15 s</label>
        <span className="ml-auto">Token tylko w pamięci karty</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Zarejestrowane', snapshot?.vessels.length],
          ['Świeże raporty', snapshot ? fresh.length : null],
          ['Pozycja nieznana', snapshot ? snapshot.vessels.length - fresh.length : null],
          ['Źródło', snapshot?.source],
        ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <div className="text-[10px] uppercase text-slate-500">{label}</div>
          <div className="mt-1 text-lg font-bold text-cyan-200">{value ?? '—'}</div>
        </div>)}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input aria-label="Szukaj obiektu" value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj obiektu…"
            className="min-w-0 bg-transparent py-2 text-xs outline-none" />
        </div>
        <div className="flex gap-1">
          {([['all', 'Wszystkie'], ['fresh', 'Z telemetrią'], ['unknown', 'Bez pozycji']] as const)
            .map(([id, label]) => <button type="button" key={id} onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={'rounded px-2 py-2 text-[11px] ' +
                (filter === id ? 'bg-cyan-900 text-cyan-100' : 'bg-slate-800 text-slate-400')}>
              {label}
            </button>)}
        </div>
        <div className="flex gap-1">
          <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}
            className={'flex items-center gap-1 rounded px-2 py-2 text-xs ' +
              (view === 'map' ? 'bg-cyan-900 text-cyan-100' : 'bg-slate-800')}>
            <Map className="h-4 w-4" /> Mapa
          </button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}
            className={'flex items-center gap-1 rounded px-2 py-2 text-xs ' +
              (view === 'list' ? 'bg-cyan-900 text-cyan-100' : 'bg-slate-800')}>
            <List className="h-4 w-4" /> Lista
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select aria-label="Typ obiektu" value={kindFilter} onChange={e => setKindFilter(e.target.value as typeof kindFilter)} className="rounded border border-slate-700 bg-slate-900 p-2">
          <option value="all">Wszystkie typy</option>{Object.entries(kindLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <ArrowUpDown size={14}/><select aria-label="Sortowanie" value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="rounded border border-slate-700 bg-slate-900 p-2"><option value="name">Nazwa A–Z</option><option value="recent">Ostatni raport</option></select>
        <span className="text-slate-400">{visible.length} wyników</span>
        <button type="button" disabled={!snapshot} onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify({ timestamp: snapshot?.timestamp, vessels: visible }, null, 2)], {type:'application/json'}));
          const link = document.createElement('a'); link.href = url; link.download = 'flota.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }} className="ml-auto flex items-center gap-2 rounded border border-slate-700 px-3 py-2"><Download size={14}/>Eksport</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(290px,1fr)]">
        <div className="rounded-xl border border-cyan-900 bg-[#081629] p-4">
          {view === 'map' ? <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-cyan-100">
                <Activity className="h-4 w-4" /> Pozycje XY · J2000
              </h2>
              <button type="button" onClick={() => {setZoom(1);setOffsetX(0);setOffsetY(0);}}
                className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300">
                <LocateFixed className="h-3 w-3" /> Wyśrodkuj
              </button>
            </div>
            <svg viewBox="0 0 500 500" className="mx-auto mt-2 w-full max-w-[560px]"
              role="group" aria-label="Interaktywna mapa faktycznie zgłoszonych pozycji XY">
              <rect width="500" height="500" rx="12" fill="#071020"/>
              <g transform={'translate(' + (offsetX + 250) + ' ' + (offsetY + 250) + ') scale(' + zoom + ') translate(-250 -250)'}>
                {[80, 160, 240].map(r => <circle key={r} cx="250" cy="250" r={r}
                  stroke="#23405a" fill="none" strokeDasharray="4 8"/>)}
                <path d="M25 250H475 M250 25V475" stroke="#294255" strokeWidth="1"/>
                <circle cx="250" cy="250" r="7" fill="#facc15"/>
                <text x="262" y="242" fill="#fde68a" fontSize="11">Słońce</text>
                {visiblePoints.map(v => <g key={v.id} tabIndex={0} role="button"
                  aria-label={'Wybierz ' + v.name} aria-pressed={selectedId === v.id}
                  onKeyDown={e => {if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(v.id); }}}
                  onClick={() => setSelectedId(v.id)} style={{cursor:'pointer'}}>
                  <circle cx={250 + v.position!.xAu / scale * 195} cy={250 - v.position!.yAu / scale * 195}
                    r={selectedId === v.id ? 9 : 6} fill={selectedId === v.id ? '#facc15' : '#22d3ee'}
                    stroke="#0e7490" strokeWidth="2"/>
                  <text x={260 + v.position!.xAu / scale * 195} y={240 - v.position!.yAu / scale * 195}
                    fill="#ddf9ff" fontSize="11">{v.name.slice(0,22)}</text>
                </g>)}
              </g>
              <text x="12" y="488" fill="#9ca3af" fontSize="10">
                X/Y: jednostki AU · widok poglądowy, bez obliczania orbit
              </text>
            </svg>
            <label className="flex items-center gap-3 text-xs text-slate-400">
              Powiększenie <input type="range" min={0.5} max={3} step={0.1}
                value={zoom} onChange={e => setZoom(Number(e.target.value))} className="flex-1" />
              {zoom.toFixed(1)}×
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-slate-400">
              <label>Przesunięcie X
                <input type="range" min={-160} max={160} value={offsetX}
                  onChange={e => setOffsetX(Number(e.target.value))} className="w-full"/>
              </label>
              <label>Przesunięcie Y
                <input type="range" min={-160} max={160} value={offsetY}
                  onChange={e => setOffsetY(Number(e.target.value))} className="w-full"/>
              </label>
            </div>
            {snapshot && visiblePoints.length === 0 &&
              <p className="mt-3 rounded border border-amber-900 bg-amber-950/20 p-3 text-xs text-amber-200">
                Brak pozycji J2000.
              </p>}
          </> : <>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Database className="h-4 w-4"/> Rejestr obiektów</h2>
            <div className="space-y-2">
              {visible.map(v => <button key={v.id} type="button" onClick={() => setSelectedId(v.id)}
                aria-pressed={selectedId === v.id} className={'flex w-full items-center justify-between gap-3 rounded border p-3 text-left text-xs ' +
                  (selectedId === v.id ? 'border-cyan-500 bg-cyan-950/50' : 'border-slate-800 bg-slate-900')}>
                <span><strong>{v.name}</strong><span className="ml-2 text-slate-400">{kindLabels[v.kind]}</span></span>
                <span className={freshPosition(v) ? 'text-cyan-300' : 'text-amber-300'}>
                  {freshPosition(v) ? 'Raport aktualny' : 'Niezweryfikowane'}
                </span>
              </button>)}
              {visible.length === 0 && <div className="chat-empty"><Satellite size={26}/><p>{!snapshot ? 'Połącz rejestr floty.' : snapshot.vessels.length === 0 ? 'Rejestr jest pusty.' : 'Brak wyników.'}</p>
                {snapshot && <button type="button" onClick={() => { if (snapshot.vessels.length === 0) setFormOpen(true); else { setSearch(''); setFilter('all'); setKindFilter('all'); } }}>{snapshot.vessels.length === 0 ? 'Dodaj obiekt' : 'Wyczyść filtry'}</button>}</div>}
            </div>
          </>}
        </div>

        <aside className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-cyan-100">
            <ShieldCheck className="h-4 w-4"/> Szczegóły
          </h2>
          {!selected ? <p className="text-xs text-slate-400">Wybierz obiekt.</p> :
            <div className="space-y-3 text-xs">
              <div><strong className="text-base text-white">{selected.name}</strong>
                <p className="text-slate-500">{selected.id}</p></div>
              <div className="rounded border border-slate-800 p-2">Typ: {kindLabels[selected.kind]}</div>
              <div className="rounded border border-slate-800 p-2">
                Status: <strong className={freshPosition(selected) ? 'text-cyan-300' : 'text-amber-300'}>
                  {freshPosition(selected) ? 'Raport aktualny' : 'Niezweryfikowane'}
                </strong>
              </div>
              <div className="rounded border border-slate-800 p-2">
                Plan misji: {selected.missionPlan || 'Nie określono'}<br/>
                Realizacja misji: niezweryfikowana · ETA: brak danych
              </div>
              <div className="rounded border border-slate-800 p-2">
                X: {selected.position ? finite(selected.position.xAu) : '—'}<br/>
                Y: {selected.position ? finite(selected.position.yAu) : '—'}<br/>
                Z: {selected.position ? finite(selected.position.zAu) : '—'}
              </div>
              <details className="rounded border border-slate-800 p-2"><summary>Źródło raportu</summary>
                Ostatnia obserwacja: {fmtDate(selected.lastObservationAt)}<br/>
                Źródło: {selected.provenance?.sourceId || 'Brak'}<br/>
                Raport: {selected.provenance?.sourceRef || 'Brak'}<br/>
                IP raportowany: {selected.provenance?.reportedWanIp || 'Brak'}
              </details>
              <p className="text-[11px] text-amber-300">
                Źródło: raport uwierzytelniony.
              </p>
            </div>}
        </aside>
      </div>

    </div>
  </section>;
};
