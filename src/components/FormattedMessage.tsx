import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Download } from 'lucide-react';

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const element = React.isValidElement<{ children?: React.ReactNode; className?: string }>(children) ? children : null;
  const code = String(element?.props.children ?? '').replace(/\n$/, '');
  const language = element?.props.className?.replace('language-', '') || 'tekst';
  return <details className="message-code" open>
    <summary><span>{language}</span><span className="text-slate-500">Kod</span></summary>
    <div className="message-code-actions">
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(code); setCopied(true); setError(false); }
        catch { setError(true); }
      }} aria-label="Kopiuj kod">{copied ? <Check size={14}/> : <Copy size={14}/>} {error ? 'Spróbuj ponownie' : copied ? 'Skopiowano' : 'Kopiuj'}</button>
      <button type="button" onClick={() => {
        const url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = 'fragment.txt'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }} aria-label="Pobierz kod"><Download size={14}/></button>
    </div>
    <pre>{children}</pre>
  </details>;
}

/** Markdown is rendered as React elements. No HTML execution, image requests or implicit actions. */
export const FormattedMessage: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => (
  <div className={`message-markdown ${className}`}>
    <Markdown remarkPlugins={[remarkGfm]} components={{
      pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
      img: ({ alt, src }) => <a href={src} target="_blank" rel="noopener noreferrer">Załącznik: {alt || 'plik'}</a>,
      a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
      table: ({ children }) => <div className="message-table" tabIndex={0} role="region" aria-label="Tabela wiadomości"><table>{children}</table></div>,
    }}>{content}</Markdown>
  </div>
);
