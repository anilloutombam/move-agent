"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MessageText } from "@/components/message-text";
import { RequestSummary } from "@/components/request-summary";
import { useSession } from "@/hooks/use-session";
import { api, label } from "@/lib/api";
import type { Conversation, Message, MoveRequest, Session } from "@/lib/types";
export default function ResidentPage() {
  const auth = useSession("RESIDENT"),
    session = auth.session as Session,
    logout = auth.logout,
    [id, setId] = useState(""),
    [history, setHistory] = useState<Conversation[]>([]),
    [messages, setMessages] = useState<Message[]>([]),
    [request, setRequest] = useState<MoveRequest | null>(null),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const open = useCallback(async (cid: string, token: string) => {
    const c = await api<Conversation>(`/conversations/${cid}?limit=100`, token);
    setId(cid);
    setMessages(
      (c.messages || [])
        .filter((m) => m.role !== "TOOL" && m.content.trim().length > 0)
        .reverse(),
    );
    setRequest(
      c.requestId
        ? await api<MoveRequest>(`/resident/requests/${c.requestId}`, token)
        : null,
    );
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () =>
        api<{ items: Conversation[] }>(
          "/conversations?limit=100",
          session.token,
        )
          .then((r) => {
            setHistory(r.items);
            if (r.items[0]) open(r.items[0].id, session.token);
          })
          .catch((x) => setError(x.message)),
      0,
    );
    return () => clearTimeout(timer);
  }, [open, session]);
  useEffect(() => {
    const messageList = document.querySelector<HTMLElement>(".messages");
    messageList?.scrollTo({
      top: messageList.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);
  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 8000);
    return () => window.clearTimeout(timer);
  }, [error]);
  useEffect(() => {
    if (!request?.id || !session) return;
    const refresh = () =>
      api<MoveRequest>(`/resident/requests/${request.id}`, session.token)
        .then(setRequest)
        .catch(() => undefined);
    window.addEventListener("focus", refresh);
    window.addEventListener("move-desk:refresh", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("move-desk:refresh", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [request?.id, session]);
  if (!session) return null;
  const token = session.token;
  async function fresh() {
    setBusy(true);
    setError("");
    try {
      const c = await api<Conversation>("/conversations", token, {
        method: "POST",
        body: "{}",
      });
      setHistory((v) => [c, ...v]);
      setId(c.id);
      setMessages([]);
      setRequest(null);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to start");
    } finally {
      setBusy(false);
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || !id) return;
    const content = text.trim();
    setError("");
    setText("");
    setMessages((v) => [
      ...v,
      { id: crypto.randomUUID(), role: "USER", content },
    ]);
    setBusy(true);
    try {
      const r = await api<{ message: Message; requestId: string | null }>(
        `/conversations/${id}/respond`,
        token,
        { method: "POST", body: JSON.stringify({ content }) },
      );
      if (r.message.content.trim()) setMessages((v) => [...v, r.message]);
      if (r.requestId)
        setRequest(
          await api<MoveRequest>(`/resident/requests/${r.requestId}`, token),
        );
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The assistant could not respond. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const closedMessage =
    request?.status === "APPROVED"
      ? "This request has been approved and is now closed."
      : request?.status === "REJECTED"
        ? "This request was rejected. Start a new conversation to create another request."
        : request?.status === "CANCELLED"
          ? "This request was cancelled."
          : null;
  const awaitingReview = ["SUBMITTED", "UNDER_REVIEW"].includes(
    request?.status ?? "",
  );
  return (
    <AppShell session={session} onLogout={logout}>
      <main className="page">
        <div className="title">
          <div>
            <h1>Move request</h1>
            <p>
              Describe your move. Nothing is submitted without confirmation.
            </p>
          </div>
          <div className="title-actions">
            <label>
              <span>Previous conversations</span>
              <select
                value={id}
                onChange={(e) => open(e.target.value, session.token)}
                disabled={!history.length}
              >
                {history.map((c, index) => (
                  <option key={c.id} value={c.id}>
                    {c.request
                      ? `${label(c.request.type)} · ${label(c.request.status)}`
                      : "Conversation"}{" "}
                    ·{" "}
                    {c.updatedAt
                      ? new Date(c.updatedAt).toLocaleDateString()
                      : `#${history.length - index}`}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" onClick={fresh}>
              New conversation
            </button>
          </div>
        </div>
        {error && (
          <div className="alert" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        <div className="resident-grid">
          <section className="panel conversation">
            <div className="panel-head">
              <b>Conversation</b>
              <span>{id ? "Draft saved" : "Not started"}</span>
            </div>
            <div className="messages">
              {messages.length ? (
                messages.map((m) => (
                  <article key={m.id}>
                    <span>{m.role === "USER" ? "You" : "Move Desk"}</span>
                    <MessageText content={m.content} />
                  </article>
                ))
              ) : (
                <div className="empty">
                  {id
                    ? "Describe whether you are moving in or out, the date and preferred time."
                    : "Start a new conversation."}
                </div>
              )}
            </div>
            {closedMessage ? (
              <div className="conversation-state closed">{closedMessage}</div>
            ) : awaitingReview ? (
              <div className="conversation-state">
                This request is awaiting administrator review.
              </div>
            ) : (
              <form className="composer" onSubmit={send}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message"
                  disabled={!id || busy}
                />
                <button className="btn primary" disabled={!id || busy}>
                  {busy ? "Sending…" : "Send"}
                </button>
              </form>
            )}
          </section>
          <RequestSummary request={request} />
        </div>
      </main>
    </AppShell>
  );
}
