import React, { useState } from 'react';
import { Check, Copy, CornerDownRight, FileText } from 'lucide-react';
import { FormattedMessage } from './FormattedMessage';

export function ChatMessage({ agent, content, index, onQuote, file }: {
  agent: string; content: string; index: number; onQuote?: (text: string) => void;
  file?: { name: string; type?: string; dataUrl?: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState('');
  const long = content.length > 1800 || content.split('\n').length > 24;
  const operator = agent === 'Mateusz Mitek' || agent === 'Operator';
  return <article className={`chat-message ${operator ? 'chat-message-operator' : ''}`}>
    <header>
      <span className={`agent-label agent-${agent.toLowerCase().replace(/[^a-z]/g, '')}`}>{agent}</span>
      <span className="message-sequence">#{String(index + 1).padStart(3, '0')}</span>
    </header>
    <div className={long && !expanded ? 'message-preview' : ''}>
      <FormattedMessage content={content}/>
    </div>
    {file && <details className="message-file"><summary><FileText size={14}/>{file.name}</summary>
      <span>{file.type || 'Plik'}</span>
      {file.dataUrl && /^(data:(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain);)/i.test(file.dataUrl) &&
        <a href={file.dataUrl} download={file.name}>Pobierz</a>}
    </details>}
    <footer>
      {long && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Zwiń' : 'Rozwiń'}</button>}
      <button type="button" aria-label={`Kopiuj wiadomość ${index + 1}`} onClick={async () => {
        try { await navigator.clipboard.writeText(content); setCopyState('Skopiowano'); }
        catch { setCopyState('Błąd kopiowania'); }
      }}>{copyState === 'Skopiowano' ? <Check size={14}/> : <Copy size={14}/>}<span role="status">{copyState}</span></button>
      {onQuote && <button type="button" onClick={() => onQuote(content)} aria-label={`Cytuj wiadomość ${index + 1}`}><CornerDownRight size={14}/>Cytuj</button>}
    </footer>
  </article>;
}
