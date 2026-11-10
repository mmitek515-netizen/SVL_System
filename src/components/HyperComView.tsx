import React, { useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { usePollingJSON, postJSON } from "../hooks/usePollingJSON";
import { ChatMessage } from "./ChatMessage";
import {
  Disclosure,
  EmptyState,
  ModuleHeader,
  Panel,
  Segments,
} from "./WorkspaceUI";
interface Transmission {
  id: number;
  direction: "incoming" | "outgoing";
  sender: string;
  recipient: string;
  content: string;
  status: string;
  created_at: string;
  in_reply_to: number | null;
}
export function HyperComView() {
  const api = usePollingJSON<{ transmissions: Transmission[] }>(
    "/api/hyper-com/transmissions",
    5000,
  );
  const [filter, setFilter] = useState<"all" | "incoming" | "outgoing">("all");
  const [reply, setReply] = useState<Transmission | null>(null);
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const send = async (body: unknown) => {
    setBusy(true);
    setError("");
    try {
      await postJSON("/api/hyper-com/transmissions", body);
      setContent("");
      setReply(null);
      setNotice("Zapisano lokalnie.");
      await api.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  };
  const visible = (api.data?.transmissions || []).filter(
    (item) =>
      (filter === "all" || item.direction === filter) &&
      (item.content + " " + item.sender)
        .toLocaleLowerCase("pl")
        .includes(query.toLocaleLowerCase("pl")),
  );
  return (
    <section className="module-view module-page">
      <ModuleHeader title="Transmisje" meta="Kolejka lokalna">
        <button
          type="button"
          onClick={() => void api.refresh()}
          disabled={api.loading}
        >
          <RefreshCw size={14} />
          Odśwież
        </button>
      </ModuleHeader>
      <Disclosure title="Tryb połączenia">
        Brak zewnętrznego połączenia. Broadcasty i odpowiedzi pozostają w
        lokalnej kolejce. Wiadomości testowe są oznaczone.
      </Disclosure>
      {(error || api.error) && <p role="alert">{error || api.error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="module-columns">
        <Panel title="Rejestr">
          <Segments
            label="Kierunek transmisji"
            value={filter}
            options={[
              ["all", "Wszystkie"],
              ["incoming", "Przychodzące"],
              ["outgoing", "Wychodzące"],
            ]}
            onChange={setFilter}
          />
          <input
            className="my-3 w-full"
            aria-label="Szukaj transmisji"
            placeholder="Szukaj…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {visible.length ? (
            visible.map((item) => (
              <div key={item.id}>
                <span className="module-meta">
                  {item.recipient} · {item.status} ·{" "}
                  {new Date(item.created_at).toLocaleString("pl")}
                </span>
                <ChatMessage
                  agent={item.sender}
                  content={item.content}
                  index={item.id - 1}
                />
                {item.direction === "incoming" && (
                  <button
                    type="button"
                    onClick={() => {
                      setReply(item);
                      document.getElementById("transmission-content")?.focus();
                    }}
                  >
                    Odpowiedz #{item.id}
                  </button>
                )}
              </div>
            ))
          ) : (
            <EmptyState>Brak transmisji.</EmptyState>
          )}
        </Panel>
        <Panel title={reply ? `Odpowiedź #${reply.id}` : "Nowa wiadomość"}>
          <form
            className="module-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (content.trim() && !busy)
                void send(
                  reply
                    ? { action: "reply", replyTo: reply.id, content }
                    : { action: "broadcast", content },
                );
            }}
          >
            <label>
              Odbiorca
              <input
                readOnly
                value={reply?.sender || "GLOBAL_BROADCAST_QUEUE"}
              />
            </label>
            <label>
              Treść
              <textarea
                id="transmission-content"
                required
                maxLength={4000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={busy}
                placeholder="Wiadomość…"
              />
            </label>
            <div className="module-actions">
              <button type="submit" disabled={busy || !content.trim()}>
                <Send size={14} />
                Dodaj do kolejki
              </button>
              {reply && (
                <button type="button" onClick={() => setReply(null)}>
                  Anuluj odpowiedź
                </button>
              )}
            </div>
          </form>
          <Disclosure title="Narzędzia testowe">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void send({
                  action: "receive",
                  sender: "Astra_1 (TEST)",
                  content: "Test lokalnej kolejki — wiadomość testowa.",
                })
              }
            >
              Dodaj wiadomość testową
            </button>
          </Disclosure>
        </Panel>
      </div>
    </section>
  );
}
