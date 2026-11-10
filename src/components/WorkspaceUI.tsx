import React, { useId, useState } from "react";
import { Check, Copy, Download } from "lucide-react";

export function ModuleHeader({
  title,
  children,
  meta,
}: {
  title: string;
  children?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="module-toolbar">
      <div>
        <h1>{title}</h1>
        {meta && <span className="module-meta">{meta}</span>}
      </div>
      <div className="module-actions">{children}</div>
    </header>
  );
}
export function Panel({
  title,
  children,
  actions,
}: {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="module-panel">
      {(title || actions) && (
        <header>
          <h2>{title}</h2>
          <div className="module-actions">{actions}</div>
        </header>
      )}
      {children}
    </section>
  );
}
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="module-empty">{children}</div>;
}
export function Metric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="module-metric">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}
export function Segments<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="module-segments" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button
          type="button"
          key={id}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
export function CodeInspector({
  code,
  filename = "dane.json",
}: {
  code: string;
  filename?: string;
}) {
  const [message, setMessage] = useState("");
  return (
    <div className="code-inspector">
      <div className="module-actions">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setMessage("Skopiowano");
            } catch {
              setMessage("Błąd kopiowania");
            }
          }}
        >
          {message === "Skopiowano" ? <Check size={14} /> : <Copy size={14} />}
          Kopiuj
        </button>
        <button
          type="button"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([code], { type: "text/plain;charset=utf-8" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download size={14} />
          Pobierz
        </button>
        <span role="status">{message}</span>
      </div>
      <pre tabIndex={0}>{code}</pre>
    </div>
  );
}
export function Disclosure({
  title,
  children,
  open = false,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  const id = useId();
  return (
    <details className="module-disclosure" open={open || undefined}>
      <summary aria-controls={id}>{title}</summary>
      <div id={id}>{children}</div>
    </details>
  );
}

export function WorkspaceDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => {
      el?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="module-dialog module-view"
      aria-label={title}
      onCancel={onClose}
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}
