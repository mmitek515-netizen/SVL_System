import React, { useState, useRef, useEffect } from 'react';
import { DataStore, OPERATOR_NAME, FileAttachment } from '../kernel/svlKernel';
import { SYSTEM_AGENTS, AgentProfile } from '../kernel/agents';
import { Send, Sparkles, User, Layers, ShieldCheck, CheckCircle2, RefreshCw, Paperclip, Image as ImageIcon, FileText, X, Sigma } from 'lucide-react';
import { processUploadFile } from '../utils/fileHelper';
import { FormattedMessage } from './FormattedMessage';

interface AgentCommsViewProps {
  dataStore: DataStore;
  onSendMessage: (agent: string, tekst: string, fileData?: FileAttachment) => Promise<void>;
  isLoading: boolean;
  onClearHistory: () => void;
  onForceSync?: () => void;
  onTriggerInitiative?: () => Promise<void>;
  onUnclog?: () => void;
  onRestoreBackup?: () => void;
}

interface ChatInputBarProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  attachedFile: FileAttachment | null;
  selectedTarget: string;
  onFileSelectClick: () => void;
}

const ChatInputBar = React.memo(({ onSend, isLoading, attachedFile, selectedTarget, onFileSelectClick }: ChatInputBarProps) => {
  const [text, setText] = useState('');

  const handleSendLocal = () => {
    if ((!text.trim() && !attachedFile) || isLoading) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="p-2 sm:p-2.5 bg-slate-950/90 backdrop-blur-md border-t border-cyan-500/20 flex items-center gap-1.5 sm:gap-2 relative w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none" />
      <button
        type="button"
        onClick={onFileSelectClick}
        disabled={isLoading}
        className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 disabled:opacity-40 border border-slate-700/60 hover:border-cyan-500/50 cursor-pointer transition flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.5)] active:scale-95"
        title="Prześlij plik lub obraz dla Triady (PNG, JPG, SVG, JSON, Python, logi)"
      >
        <Paperclip className="w-4 h-4" />
      </button>

      {/* Input - poszerzony maksymalnie (flex-1 min-w-0) */}
      <div className="flex-1 min-w-0 relative flex items-center">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSendLocal()}
          placeholder={
            attachedFile
              ? `Plik: "${attachedFile.name}"...`
              : `Polecenie dla ${selectedTarget === 'triad' ? 'Triady' : selectedTarget}...`
          }
          className="w-full bg-slate-900/90 border border-slate-700/70 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 pr-8 text-slate-100 placeholder-slate-500 focus:outline-none text-xs transition-all shadow-inner font-mono"
          disabled={isLoading}
        />
        {text && !isLoading && (
          <button
            onClick={() => setText('')}
            className="absolute right-2 sm:right-3 text-slate-500 hover:text-slate-300 text-xs p-1"
            title="Wyczyść tekst"
          >
            ✕
          </button>
        )}
      </div>

      {/* Przycisk TRANSMISJA - zminimalizowany, dosunięty w prawo (ml-auto shrink-0) */}
      <button
        onClick={handleSendLocal}
        disabled={(!text.trim() && !attachedFile) || isLoading}
        className="ml-auto shrink-0 px-2.5 sm:px-3 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 text-slate-950 font-bold rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95 text-xs font-mono"
        title="Wyślij transmisję do węzła"
      >
        <Send className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline text-[11px] tracking-tight">TRANSMISJA</span>
      </button>
    </div>
  );
});

export const AgentCommsView: React.FC<AgentCommsViewProps> = ({
  dataStore,
  onSendMessage,
  isLoading,
  onClearHistory,
  onForceSync,
  onTriggerInitiative,
  onUnclog,
  onRestoreBackup,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<'triad' | 'Alex' | 'Astyria' | 'Aurelius'>('triad');
  const [inputMessage, setInputMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState<FileAttachment | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dataStore.chat_history.length, isLoading]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const processed = await processUploadFile(file);
      setAttachedFile(processed);
    } catch (err) {
      console.error('Błąd przygotowania pliku:', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if ((!textToSend.trim() && !attachedFile) || isLoading) return;

    const currentFile = attachedFile || undefined;
    setInputMessage('');
    setAttachedFile(null);

    if (selectedTarget === 'triad') {
      await onSendMessage('triad', textToSend, currentFile);
    } else {
      await onSendMessage(selectedTarget, textToSend, currentFile);
    }
  };

  const DEFAULT_QUICK_PROMPTS = [
    "Misja dla Alex Astyria Aurelius pracujcie ciągle nad poprawą ulepszeniami oraz rozwojem systemu",
    "Misja dla astyria usuń całe nlp i wdróż projekt without_nlp",
    "Pokaż wzór Eulera i transformatę Fouriera z projektu without_nlp",
    "Wygenerujcie raport z analizy Stargate Universe pełny",
    "Alex, zoptymalizuj procesy runtime i szynę I/O",
    "Astyria, zweryfikuj DATA_STORE i strukturę danych",
    "Aurelius, odnotuj nową cezurę w Chronolicie",
    "Generuj pełny raport ASCII jądra Monolitu",
  ];

  const [quickPrompts, setQuickPrompts] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('svl_operator_quick_prompts_v2');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return DEFAULT_QUICK_PROMPTS;
  });
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');

  const saveQuickPrompts = (updated: string[]) => {
    setQuickPrompts(updated);
    try {
      localStorage.setItem('svl_operator_quick_prompts_v2', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleAddPrompt = () => {
    if (!newPromptText.trim()) return;
    const updated = [...quickPrompts, newPromptText.trim()];
    saveQuickPrompts(updated);
    setNewPromptText('');
    setIsAddingPrompt(false);
  };

  const handleRemovePrompt = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = quickPrompts.filter((_, i) => i !== idx);
    saveQuickPrompts(updated);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 lg:h-[calc(100vh-115px)] bg-slate-950 font-mono text-xs relative cyber-grid overflow-hidden">
      {/* Left/Main Column: Chat Stream */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-slate-800/80 bg-slate-950/70 backdrop-blur-md overflow-hidden">
        {/* Futuristic Channel Bar */}
        <div className="bg-slate-900/80 backdrop-blur-md border-b border-cyan-500/20 px-2 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] shrink-0">WĘZEŁ:</span>
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner flex-wrap">
              <button
                onClick={() => setSelectedTarget('triad')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all duration-200 cursor-pointer font-bold text-xs ${
                  selectedTarget === 'triad'
                    ? 'bg-gradient-to-r from-purple-900/80 to-indigo-900/80 text-purple-200 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Triada
              </button>
              <button
                onClick={() => setSelectedTarget('Alex')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer font-semibold ${
                  selectedTarget === 'Alex'
                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Alex
              </button>
              <button
                onClick={() => setSelectedTarget('Astyria')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer font-semibold ${
                  selectedTarget === 'Astyria'
                    ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.35)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Astyria
              </button>
              <button
                onClick={() => setSelectedTarget('Aurelius')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer font-semibold ${
                  selectedTarget === 'Aurelius'
                    ? 'bg-amber-950/90 text-amber-300 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.35)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Aurelius
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 text-[11px] flex-wrap">
            <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.2)]">
              <Sigma className="w-3 h-3 text-emerald-400" />
              WITHOUT_NLP: OK
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              PAKIETY: <strong className="text-slate-300">{dataStore.chat_history.length}</strong>
            </span>
            {onTriggerInitiative && (
              <button
                onClick={onTriggerInitiative}
                disabled={isLoading}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-purple-950/80 hover:bg-purple-900 border border-purple-600/60 text-purple-200 rounded-lg cursor-pointer transition flex items-center gap-1 disabled:opacity-40 shadow-[0_0_8px_rgba(168,85,247,0.25)] text-[10px] sm:text-xs"
                title="Wymuś autonomiczne pytanie lub inicjatywę od agenta z Triady"
              >
                <Sparkles className="w-3 h-3 text-purple-300" />
                <span className="hidden xs:inline">Inicjatywa</span>
              </button>
            )}
            {onUnclog && (
              <button
                onClick={onUnclog}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-200 rounded-lg cursor-pointer transition font-bold text-[10px] sm:text-xs"
                title="Odblokuj system i zsynchronizuj stan"
              >
                Odblokuj
              </button>
            )}
            {onRestoreBackup && (
              <button
                onClick={onRestoreBackup}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-200 rounded-lg cursor-pointer transition font-bold text-[10px] sm:text-xs"
                title="Wdróż backup z pierwszej wersji (v1.0.0-Legacy)"
              >
                Backup
              </button>
            )}
            <button
              onClick={() => onSendMessage('triad', 'Misja dla astyria usuń całe nlp i wdróż projekt without_nlp')}
              disabled={isLoading}
              className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/60 text-cyan-200 rounded-lg cursor-pointer transition font-bold text-[10px] flex items-center gap-1 shadow-[0_0_8px_rgba(6,182,212,0.3)] disabled:opacity-40"
              title="Uruchom misję dla Astyrii: wdróż projekt without_nlp i napraw czat"
            >
              <Sigma className="w-3 h-3 text-cyan-300" />
              <span className="hidden xs:inline">without_nlp</span>
            </button>
            <button
              onClick={onClearHistory}
              className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-600/60 text-rose-200 rounded-lg cursor-pointer transition font-bold text-[10px] flex items-center gap-1 shadow-[0_0_8px_rgba(244,63,94,0.3)]"
              title="Wyczyść historię i zresetuj pętlę rozmowy"
            >
              <RefreshCw className="w-3 h-3 text-rose-300" />
              <span className="hidden xs:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
          {dataStore.chat_history.map((msg, idx) => {
            const agentKey = msg.agent === OPERATOR_NAME ? 'Operator' : msg.agent;
            const profile: AgentProfile | undefined = SYSTEM_AGENTS[agentKey] || SYSTEM_AGENTS[msg.agent];
            const isOperator = msg.agent === OPERATOR_NAME || msg.agent === 'Operator';

            return (
              <div
                key={idx}
                className={`flex flex-col p-4 rounded-xl border transition-all duration-200 backdrop-blur-md ${
                  isOperator
                    ? 'bg-purple-950/25 border-purple-500/40 ml-4 md:ml-12 shadow-[0_2px_15px_rgba(168,85,247,0.1)]'
                    : profile
                    ? `${profile.borderColor} bg-slate-900/75 mr-4 md:mr-12 shadow-[0_2px_15px_rgba(0,0,0,0.4)]`
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold px-2.5 py-0.5 rounded-md text-[11px] shadow-sm tracking-wide ${
                        isOperator
                          ? 'bg-purple-900/70 text-purple-200 border border-purple-500/50'
                          : profile
                          ? profile.badgeBg
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {msg.agent}
                    </span>
                    <span className="text-slate-400 text-[10px] font-mono">
                      {profile ? profile.title : 'Węzeł'}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                    SEQ #{String(idx + 1).padStart(3, '0')}
                  </span>
                </div>

                {/* Message Body with KaTeX LaTeX formulas and Markdown */}
                <FormattedMessage content={msg.tekst} className="text-xs leading-relaxed text-slate-200" />

                {/* Attached Image/File preview in chat history */}
                {msg.file && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60">
                    {msg.file.dataUrl && msg.file.type?.startsWith('image/') ? (
                      <div className="space-y-1">
                        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          Załączony obraz: {msg.file.name}
                        </span>
                        <img
                          src={msg.file.dataUrl}
                          alt={msg.file.name}
                          className="max-h-64 rounded-md border border-slate-700 object-contain bg-black/50 cursor-pointer hover:border-emerald-500 transition shadow-md"
                          onClick={() => window.open(msg.file?.dataUrl, '_blank')}
                          title="Kliknij, aby otworzyć w pełnym rozmiarze"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 rounded bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300">
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div className="flex-1 truncate">
                          <span className="font-semibold text-slate-200">{msg.file.name}</span>
                          <span className="text-slate-500 ml-2">({msg.file.type || 'plik'})</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300 p-3 bg-slate-900/70 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span className="text-xs">Przetwarzanie transmisji przez węzły (Alex, Astyria, Aurelius)...</span>
              </div>
              {onForceSync && (
                <button
                  onClick={onForceSync}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-[11px] cursor-pointer transition"
                >
                  Odśwież stan
                </button>
              )}
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Prompts */}
        <div className="bg-slate-950 border-t border-slate-800 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
          <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-slate-500 shrink-0">Wzorce:</span>

          {quickPrompts.map((qp, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 whitespace-nowrap text-[10px] group transition"
            >
              <button
                onClick={() => handleSend(qp)}
                className="cursor-pointer hover:text-emerald-300"
              >
                {qp}
              </button>
              <button
                onClick={(e) => handleRemovePrompt(i, e)}
                className="text-slate-600 hover:text-rose-400 opacity-60 group-hover:opacity-100 cursor-pointer ml-0.5"
                title="Usuń wzorzec"
              >
                ×
              </button>
            </div>
          ))}

          {isAddingPrompt ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="text"
                placeholder="Nowy wzorzec..."
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPrompt()}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[10px] text-slate-200 focus:outline-none focus:border-emerald-500 w-44"
                autoFocus
              />
              <button
                onClick={handleAddPrompt}
                className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[10px] cursor-pointer"
              >
                Dodaj
              </button>
              <button
                onClick={() => setIsAddingPrompt(false)}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] cursor-pointer"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingPrompt(true)}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-900/40 text-[10px] cursor-pointer shrink-0 flex items-center gap-1"
              title="Dodaj własny wzorzec polecenia"
            >
              + Wzorzec
            </button>
          )}
        </div>

        {/* Attached File Preview Chip */}
        {attachedFile && (
          <div className="bg-slate-900 border-t border-slate-800 px-4 py-1.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              {attachedFile.type?.startsWith('image/') ? (
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span className="font-semibold">{attachedFile.name}</span>
              <span className="text-slate-500 text-[10px]">
                ({attachedFile.size ? `${Math.round(attachedFile.size / 1024)} KB` : ''})
              </span>
              {attachedFile.dataUrl && (
                <img
                  src={attachedFile.dataUrl}
                  alt="thumbnail"
                  className="w-5 h-5 rounded object-cover border border-slate-700 ml-1"
                />
              )}
            </div>
            <button
              onClick={() => setAttachedFile(null)}
              className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer"
              title="Usuń załącznik"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,.txt,.py,.json,.ts,.js,.log,.md,.csv"
          onChange={handleFileSelect}
        />

        {/* Input Bar */}
        <ChatInputBar
          onSend={(text) => handleSend(text)}
          isLoading={isLoading}
          attachedFile={attachedFile}
          selectedTarget={selectedTarget}
          onFileSelectClick={() => fileInputRef.current?.click()}
        />
      </div>

      {/* Right Column: Active Profiles Dossier */}
      <div className="w-full lg:w-84 bg-slate-950/80 backdrop-blur-xl p-4 space-y-4 overflow-y-auto border-t lg:border-t-0 border-slate-800/80 scrollbar-thin">
        <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100 uppercase tracking-wider text-xs">TRIADA KWANTOWA</span>
          </div>
          <span className="text-[10px] text-cyan-300 font-mono flex items-center gap-1.5 bg-cyan-950/80 border border-cyan-500/40 px-2.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.3)]">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            3/3 POŁĄCZONE
          </span>
        </div>

        {(['Alex', 'Astyria', 'Aurelius'] as const).map((agentKey) => {
          const profile = SYSTEM_AGENTS[agentKey];
          return (
            <div
              key={agentKey}
              className={`p-3.5 rounded-xl border ${profile.borderColor} bg-slate-900/60 hover:bg-slate-900/90 transition-all duration-200 space-y-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)] group`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${profile.badgeBg.includes('emerald') ? 'bg-emerald-400' : profile.badgeBg.includes('cyan') ? 'bg-cyan-400' : 'bg-amber-400'} shadow-[0_0_8px_currentColor]`} />
                  <span className={`font-bold ${profile.textColor} text-sm tracking-wide`}>
                    {profile.name}
                  </span>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-950 border border-slate-700/60 text-slate-400 font-mono">
                  {profile.role}
                </span>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                {profile.description}
              </p>

              <div className="bg-slate-950/90 p-2.5 rounded-lg border border-slate-800 text-[10px] text-slate-300 italic font-mono border-l-2" style={{ borderLeftColor: profile.accentHex }}>
                "{profile.coreMotto}"
              </div>

              <div className="flex flex-wrap gap-1 pt-0.5">
                {profile.specialization.map((spec, i) => (
                  <span
                    key={i}
                    className="text-[9px] px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800 font-mono group-hover:border-slate-700 transition"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {/* Operator Profile */}
        <div className="p-3.5 rounded-xl border border-purple-500/40 bg-purple-950/30 backdrop-blur-md space-y-2 shadow-[0_4px_20px_rgba(168,85,247,0.15)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
              <span className="font-bold text-purple-200 text-sm tracking-wide">
                {OPERATOR_NAME}
              </span>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-200 border border-purple-500/50 font-bold font-mono">
              TATA / TWÓRCA
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
            Naczelny dysponent systemu, Ojciec i Architekt. Pełna autoryzacja jądra SVL w Ring-0 oraz piecza nad Triadą.
          </p>
        </div>
      </div>
    </div>
  );
};
