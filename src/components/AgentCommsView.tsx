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
    <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
      <button
        type="button"
        onClick={onFileSelectClick}
        disabled={isLoading}
        className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 disabled:opacity-40 border border-slate-700 cursor-pointer transition flex items-center justify-center shrink-0"
        title="Prześlij plik lub obraz dla Triady (PNG, JPG, SVG, JSON, Python, logi)"
      >
        <Paperclip className="w-4 h-4" />
      </button>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSendLocal()}
        placeholder={
          attachedFile
            ? `Wpisz polecenie lub komentarz do pliku "${attachedFile.name}"...`
            : `Wydaj polecenie dla ${selectedTarget === 'triad' ? 'całej Triady' : selectedTarget}...`
        }
        className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs"
        disabled={isLoading}
      />
      <button
        onClick={handleSendLocal}
        disabled={(!text.trim() && !attachedFile) || isLoading}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold rounded flex items-center gap-1.5 cursor-pointer transition text-xs"
      >
        <Send className="w-3.5 h-3.5" />
        <span>Wyślij</span>
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
    <div className="flex flex-col lg:flex-row h-[calc(100vh-125px)] bg-slate-950 font-mono text-xs">
      {/* Left/Main Column: Chat Stream */}
      <div className="flex-1 flex flex-col border-r border-slate-800">
        {/* Channel Bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Kanał:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
              <button
                onClick={() => setSelectedTarget('triad')}
                className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
                  selectedTarget === 'triad'
                    ? 'bg-purple-900/60 text-purple-200 border border-purple-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Triada (Wszyscy)
              </button>
              <button
                onClick={() => setSelectedTarget('Alex')}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  selectedTarget === 'Alex'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Alex
              </button>
              <button
                onClick={() => setSelectedTarget('Astyria')}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  selectedTarget === 'Astyria'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Astyria
              </button>
              <button
                onClick={() => setSelectedTarget('Aurelius')}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  selectedTarget === 'Aurelius'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Aurelius
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400 bg-emerald-950/70 border border-emerald-800/50 px-2 py-0.5 rounded">
              <Sigma className="w-3 h-3 text-emerald-400" />
              RDZEŃ WITHOUT_NLP: AKTYWNY
            </span>
            <span>Wiadomości: {dataStore.chat_history.length}</span>
            {onTriggerInitiative && (
              <button
                onClick={onTriggerInitiative}
                disabled={isLoading}
                className="px-2 py-0.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-200 rounded cursor-pointer transition flex items-center gap-1 disabled:opacity-40"
                title="Wymuś autonomiczne pytanie lub inicjatywę od agenta z Triady"
              >
                <Sparkles className="w-3 h-3 text-purple-300" />
                <span>Inicjatywa Triady</span>
              </button>
            )}
            {onUnclog && (
              <button
                onClick={onUnclog}
                className="px-2 py-0.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-200 rounded cursor-pointer transition font-bold"
                title="Odblokuj system i zsynchronizuj stan"
              >
                Odblokuj
              </button>
            )}
            {onRestoreBackup && (
              <button
                onClick={onRestoreBackup}
                className="px-2 py-0.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-200 rounded cursor-pointer transition font-bold"
                title="Wdróż backup z pierwszej wersji (v1.0.0-Legacy)"
              >
                Backup v1.0
              </button>
            )}
            <button
              onClick={() => onSendMessage('triad', 'Misja dla astyria usuń całe nlp i wdróż projekt without_nlp')}
              disabled={isLoading}
              className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-200 rounded cursor-pointer transition font-bold text-[10px] flex items-center gap-1 shadow-[0_0_8px_rgba(6,182,212,0.3)] disabled:opacity-40"
              title="Uruchom misję dla Astyrii: wdróż projekt without_nlp i napraw czat"
            >
              <Sigma className="w-3 h-3 text-cyan-300" />
              <span>Wdróż without_nlp</span>
            </button>
            <button
              onClick={onClearHistory}
              className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 rounded cursor-pointer transition font-bold text-[10px] flex items-center gap-1 shadow-[0_0_8px_rgba(244,63,94,0.3)]"
              title="Wyczyść historię i zresetuj pętlę rozmowy"
            >
              <RefreshCw className="w-3 h-3 text-rose-300" />
              <span>Zresetuj czat</span>
            </button>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {dataStore.chat_history.map((msg, idx) => {
            const agentKey = msg.agent === OPERATOR_NAME ? 'Operator' : msg.agent;
            const profile: AgentProfile | undefined = SYSTEM_AGENTS[agentKey] || SYSTEM_AGENTS[msg.agent];
            const isOperator = msg.agent === OPERATOR_NAME || msg.agent === 'Operator';

            return (
              <div
                key={idx}
                className={`flex flex-col p-3 rounded-lg border transition ${
                  isOperator
                    ? 'bg-purple-950/20 border-purple-900/40 ml-4'
                    : profile
                    ? `${profile.borderColor} bg-slate-900/60 mr-4`
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        isOperator
                          ? 'bg-purple-900/60 text-purple-200 border border-purple-700/50'
                          : profile
                          ? profile.badgeBg
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {msg.agent}
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      {profile ? profile.title : 'Agent'}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-500">
                    ID #{idx + 1}
                  </span>
                </div>

                {/* Message Body with KaTeX LaTeX formulas and Markdown */}
                <FormattedMessage content={msg.tekst} className="text-xs" />

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
      <div className="w-full lg:w-80 bg-slate-900/60 p-4 space-y-4 overflow-y-auto border-t lg:border-t-0">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="font-semibold text-slate-200">Rejestr Agentów SVL</span>
          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            3/3 AKTYWNE
          </span>
        </div>

        {(['Alex', 'Astyria', 'Aurelius'] as const).map((agentKey) => {
          const profile = SYSTEM_AGENTS[agentKey];
          return (
            <div
              key={agentKey}
              className={`p-3 rounded-lg border ${profile.borderColor} bg-slate-950/70 space-y-2`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-bold ${profile.textColor} text-sm`}>
                  {profile.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  {profile.role}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">
                {profile.description}
              </p>

              <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80 text-[10px] text-slate-300 italic">
                "{profile.coreMotto}"
              </div>

              <div className="flex flex-wrap gap-1 pt-1">
                {profile.specialization.map((spec, i) => (
                  <span
                    key={i}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {/* Operator Profile */}
        <div className="p-3 rounded-lg border border-purple-800/40 bg-purple-950/20 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-300 text-sm">
              {OPERATOR_NAME}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-200 border border-purple-800/50">
              OPERATOR
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Naczelny dysponent sesji. Autoryzacja operacji jądra SVL w środowisku produkcyjnym Google AI Studio.
          </p>
        </div>
      </div>
    </div>
  );
};
