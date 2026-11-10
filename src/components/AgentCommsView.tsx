import React, { useEffect, useRef, useState } from 'react';
import { DataStore } from '../kernel/svlKernel';
import { ChatMessage } from './ChatMessage';
import { Sparkles, ShieldCheck, RefreshCw, FileText, MessagesSquare, Paperclip, Send, X } from 'lucide-react';
import { Search, SlidersHorizontal } from 'lucide-react';
import {
  ASTYRIA_MISSION_ACTIONS,
  ASTYRIA_MISSION_LABELS,
  AGENT_PROTOCOL_COMMANDS,
  AGENT_PROTOCOL_LABELS,
  AstyriaMissionAction,
  AgentProtocolCommand,
  AgentProtocolReply,
  AgentProtocolRequest,
} from '../kernel/agentProtocol';
import {
  CHAT_ATTACHMENT_ACCEPT,
  ChatAttachment,
  MAX_CHAT_ATTACHMENTS,
  readChatAttachmentFile,
  validateChatAttachments,
} from '../kernel/chatAttachments';

interface AgentCommsViewProps {
  dataStore: DataStore;
  onSendProtocol: (request: AgentProtocolRequest) => Promise<AgentProtocolReply | undefined>;
  onSendMessage: (
    message: string,
    agent: 'triad' | 'Alex' | 'Astyria' | 'Aurelius' | 'si_1',
    attachments?: ChatAttachment[],
  ) => Promise<void>;
  onRunAstyriaMission: (action: AstyriaMissionAction) => Promise<void>;
  isLoading: boolean;
  sendError?: string | null;
  onClearHistory: () => void;
  onForceSync?: () => void;
  onTriggerInitiative?: () => Promise<void>;
  onUnclog?: () => void;
  onRestoreBackup?: () => void;
}

export const AgentCommsView: React.FC<AgentCommsViewProps> = ({
  dataStore,
  onSendProtocol,
  onSendMessage,
  onRunAstyriaMission,
  isLoading,
  sendError,
  onClearHistory,
  onForceSync,
  onTriggerInitiative,
  onUnclog,
  onRestoreBackup,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<'triad' | 'Alex' | 'Astyria' | 'Aurelius' | 'si_1'>('triad');
  const [selectedCommand, setSelectedCommand] = useState<AgentProtocolCommand>('SYSTEM_STATUS');
  const [signal, setSignal] = useState('');
  const [omega, setOmega] = useState('');
  const [time, setTime] = useState('');
  const [selectedMissionAction, setSelectedMissionAction] = useState<AstyriaMissionAction>('deep_scan');
  const [messageText, setMessageText] = useState('');
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const followLatestMessagesRef = useRef(true);

  useEffect(() => {
    const chatScroll = chatScrollRef.current;
    if (chatScroll && followLatestMessagesRef.current) {
      chatScroll.scrollTop = chatScroll.scrollHeight;
    }
  }, [dataStore.chat_history.length, isLoading]);

  const handleSendProtocol = async () => {
    if (isLoading) return;
    const payload = selectedCommand === 'SIGNAL_ANALYSIS'
      ? {
          ...(signal.trim() ? { signal: signal.trim() } : {}),
          ...(omega !== '' ? { omega: Number(omega) } : {}),
          ...(time !== '' ? { time: Number(time) } : {}),
        }
      : undefined;

    try {
      await onSendProtocol({
        command: selectedCommand,
        agent: selectedTarget,
        ...(payload && Object.keys(payload).length > 0 ? { payload } : {}),
      });
    } catch {
      // The parent exposes protocol errors in the chat status.
    }
  };

  const handleRunAstyriaMission = async () => {
    if (isLoading) return;
    setSelectedTarget('Astyria');
    try {
      await onRunAstyriaMission(selectedMissionAction);
    } catch {
      // The parent exposes mission errors in the chat status.
    }
  };

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = messageText.startsWith('/propose write-file ')
      ? messageText
      : messageText.trim();
    if ((!message && chatAttachments.length === 0) || isLoading) return;
    try {
      await onSendMessage(message, selectedTarget, chatAttachments);
      setMessageText('');
      setChatAttachments([]);
      setAttachmentError(null);
    } catch {
      // The parent exposes transmission errors in the chat status.
    }
  };

  const handleAttachmentSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setAttachmentError(null);
    if (files.length === 0) return;
    if (chatAttachments.length + files.length > MAX_CHAT_ATTACHMENTS) {
      setAttachmentError(`Możesz dołączyć maksymalnie ${MAX_CHAT_ATTACHMENTS} pliki.`);
      return;
    }
    let incoming: ChatAttachment[];
    try {
      incoming = await Promise.all(files.map(readChatAttachmentFile));
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Nie udało się odczytać wybranego pliku.');
      return;
    }
    const validation = validateChatAttachments([...chatAttachments, ...incoming]);
    if (!validation.valid) {
      setAttachmentError(validation.error);
      return;
    }
    setChatAttachments(validation.attachments);
  };

  return (
    <section className="chat-workspace">
      <aside className="chat-sidebar">
        <div className="workspace-section-title">Rozmowa <span>{dataStore.chat_history.length}</span></div>
        <label className="workspace-search"><Search size={15}/><input aria-label="Szukaj wiadomości" placeholder="Szukaj…" value={search} onChange={e => setSearch(e.target.value)}/></label>
        <div className="chat-targets" aria-label="Odbiorca wiadomości">
          {([['triad', 'Wszyscy'], ['Alex', 'Alex'], ['Astyria', 'Astyria'], ['Aurelius', 'Aurelius'], ['si_1', 'Aria']] as const).map(([id, label]) =>
            <button type="button" key={id} aria-pressed={selectedTarget === id} onClick={() => setSelectedTarget(id)}><MessagesSquare size={15}/>{label}</button>)}
        </div>
        <details className="workspace-tools">
          <summary><SlidersHorizontal size={15}/>Narzędzia</summary>
          <label>Polecenie<select aria-label="Polecenie strukturalne" value={selectedCommand} onChange={e => setSelectedCommand(e.target.value as AgentProtocolCommand)} disabled={isLoading}>
            {AGENT_PROTOCOL_COMMANDS.map(command => <option key={command} value={command}>{AGENT_PROTOCOL_LABELS[command]}</option>)}
          </select></label>
          {selectedCommand === 'SIGNAL_ANALYSIS' && <>
            <label>Sygnał<input aria-label="Sygnał do analizy" maxLength={256} value={signal} onChange={e => setSignal(e.target.value)}/></label>
            <label>ω<input aria-label="Częstotliwość omega" type="number" min="0.001" max="1000" step="any" value={omega} onChange={e => setOmega(e.target.value)}/></label>
            <label>Czas<input aria-label="Czas analizy" type="number" min="0" max="1000000" value={time} onChange={e => setTime(e.target.value)}/></label>
          </>}
          <button type="button" disabled={isLoading || (selectedCommand === 'SIGNAL_ANALYSIS' && !signal.trim())} onClick={() => void handleSendProtocol()}><ShieldCheck size={14}/>Wykonaj</button>
          <label>Misja Astyrii<select aria-label="Misja dla Astyrii" value={selectedMissionAction} onChange={e => setSelectedMissionAction(e.target.value as AstyriaMissionAction)} disabled={isLoading}>
            {ASTYRIA_MISSION_ACTIONS.map(action => <option key={action} value={action}>{ASTYRIA_MISSION_LABELS[action]}</option>)}
          </select></label>
          <button type="button" disabled={isLoading} onClick={() => void handleRunAstyriaMission()}><Sparkles size={14}/>Uruchom misję</button>
          {onTriggerInitiative && <button disabled={isLoading} onClick={onTriggerInitiative}>Inicjatywa</button>}
          {onUnclog && <button onClick={onUnclog}>Odblokuj</button>}
          {onRestoreBackup && <button onClick={onRestoreBackup}>Backup</button>}
          <button type="button" onClick={onClearHistory}>Wyczyść historię</button>
        </details>
      </aside>
      <div className="chat-main">
        <header className="chat-toolbar"><div><MessagesSquare size={17}/><h1>{selectedTarget === 'triad' ? 'Czat zespołu' : selectedTarget === 'si_1' ? 'Aria' : selectedTarget}</h1></div>
          <span role="status">{sendError ? 'Błąd' : isLoading ? 'Przetwarzanie…' : 'Gotowy'}</span>
          {onForceSync && <button type="button" onClick={onForceSync} aria-label="Odśwież czat"><RefreshCw size={15}/></button>}
        </header>
        <div className="chat-stream" ref={chatScrollRef} onScroll={e => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
          followLatestMessagesRef.current = scrollHeight - scrollTop - clientHeight < 120;
        }}>
          {sendError && <p role="alert" className="workspace-error">{sendError}</p>}
          {dataStore.chat_history.length === 0 && <div className="chat-empty"><MessagesSquare size={24}/><h2>Rozpocznij rozmowę</h2><button type="button" onClick={() => { setSelectedCommand('SYSTEM_STATUS'); setMessageText('SYSTEM_STATUS'); }}>Sprawdź status</button></div>}
          {dataStore.chat_history.map((msg, index) => ({msg, index})).filter(({msg}) => (msg.tekst + ' ' + msg.agent).toLocaleLowerCase('pl').includes(search.toLocaleLowerCase('pl'))).map(({msg, index}) =>
            <ChatMessage key={index} agent={msg.agent} content={msg.tekst} index={index} file={msg.file} onQuote={text => {
              setMessageText(text.split('\n').map(line => '> ' + line).join('\n') + '\n\n');
              document.getElementById('triad-chat-message')?.focus();
            }}/>) }
          {search && !dataStore.chat_history.some(msg => (msg.tekst + ' ' + msg.agent).toLocaleLowerCase('pl').includes(search.toLocaleLowerCase('pl'))) && <p className="text-slate-400">Brak wyników.</p>}
          {isLoading && <p role="status" className="flex items-center gap-2 text-sm text-slate-400"><RefreshCw className="animate-spin" size={14}/>Przetwarzanie…</p>}
        </div>
        <form onSubmit={handleSendMessage} className="chat-composer">
          {chatAttachments.length > 0 && <ul aria-label="Załączone pliki" className="composer-files">{chatAttachments.map((file, index) => <li key={index}><FileText size={14}/>{file.name}<button type="button" aria-label={'Usuń ' + file.name} onClick={() => setChatAttachments(files => files.filter((_, i) => i !== index))}><X size={14}/></button></li>)}</ul>}
          {attachmentError && <p role="alert" className="workspace-error">{attachmentError}</p>}
          <textarea id="triad-chat-message" aria-label="Wiadomość" placeholder="Wiadomość lub polecenie…" value={messageText} onChange={e => setMessageText(e.target.value)} maxLength={20500} rows={3} disabled={isLoading}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}/>
          <div className="composer-toolbar">
            <label className="attachment-button" title="Dołącz plik"><Paperclip size={16}/><span>Dołącz</span><input type="file" accept={CHAT_ATTACHMENT_ACCEPT} multiple disabled={isLoading || chatAttachments.length >= MAX_CHAT_ATTACHMENTS} onChange={e => void handleAttachmentSelection(e)} aria-label="Dołącz pliki" className="sr-only"/></label>
            <span className="composer-hint">Enter ↵ · Shift+Enter nowa linia</span>
            <button type="submit" className="send-button" aria-label="Wyślij wiadomość" disabled={isLoading || (!messageText.trim() && !chatAttachments.length)}><Send size={16}/></button>
          </div>
        </form>
      </div>
    </section>
  );
};
