"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DecisionDialog } from "@/components/decision-dialog";
import { useSession } from "@/hooks/use-session";
import { api, formatValue, label } from "@/lib/api";
import type { MoveRequest, Session } from "@/lib/types";

type ReasonAction = "request-info" | "reject";
const adminVisibleStatuses = new Set([
  "SUBMITTED",
  "UNDER_REVIEW",
  "INFO_REQUESTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);
export default function AdminPage() {
  const auth = useSession("ADMIN"),
    session = auth.session as Session;
  const [items, setItems] = useState<MoveRequest[]>([]);
  const [selected, setSelected] = useState<MoveRequest | null>(null);
  const [pending, setPending] = useState<ReasonAction | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const choose = useCallback(
    async (id: string, token: string) =>
      setSelected(await api<MoveRequest>(`/admin/requests/${id}`, token)),
    [],
  );
  const load = useCallback(
    async (token: string) => {
      setLoading(true);
      const result = await api<{ items: MoveRequest[] }>(
        "/admin/requests?limit=100",
        token,
      );
      const visibleItems = result.items.filter((request) =>
        adminVisibleStatuses.has(request.status),
      );
      setItems(visibleItems);
      if (visibleItems[0]) await choose(visibleItems[0].id, token);
      else setSelected(null);
      setLoading(false);
    },
    [choose],
  );
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () =>
        load(session.token).catch((caught) => {
          setError(caught.message);
          setLoading(false);
        }),
      0,
    );
    return () => clearTimeout(timer);
  }, [load, session]);
  if (!session) return null;
  async function act(name: string, reason?: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/requests/${selected.id}/${name}`, session.token, {
        method: "POST",
        body: JSON.stringify({
          expectedVersion: selected.version,
          ...(reason ? { reason } : {}),
        }),
      });
      setPending(null);
      await load(session.token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }
  const assessment = selected?.assessments?.[0];
  return (
    <AppShell session={session} onLogout={auth.logout}>
      <main className="page">
        <div className="title">
          <div>
            <h1>Move requests</h1>
            <p>Review requests for {session.user.community}.</p>
          </div>
        </div>
        {error && <div className="alert">{error}</div>}
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Resident</th>
                <th>Unit</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((request) => (
                <tr
                  key={request.id}
                  className={selected?.id === request.id ? "selected" : ""}
                  onClick={() => choose(request.id, session.token)}
                >
                  <td>Resident</td>
                  <td>{request.unit?.number}</td>
                  <td>{label(request.type)}</td>
                  <td>{label(request.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="empty">Loading requests…</div>}
          {!loading && !items.length && (
            <div className="empty">No requests found.</div>
          )}
        </section>
        {selected && (
          <div className="admin-grid">
            <section className="panel">
              <div className="panel-head">
                <b>Resident · {selected.unit?.number}</b>
                <span>{label(selected.status)}</span>
              </div>
              <div className="pad">
                <dl>
                  <div>
                    <dt>Type</dt>
                    <dd>{label(selected.type)}</dd>
                  </div>
                  {Object.entries(selected.requestData)
                    .filter(
                      ([, value]) =>
                        value !== null &&
                        (!Array.isArray(value)
                          ? typeof value !== "object"
                          : true),
                    )
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>{label(key)}</dt>
                        <dd>{formatValue(value)}</dd>
                      </div>
                    ))}
                </dl>
                <h2>Policy assessment</h2>
                <div className="policy-list">
                  {assessment?.checks?.map((check) => (
                    <div key={check.name}>
                      <span>
                        <b>{label(check.name)}</b>
                        <small>{check.message}</small>
                      </span>
                      <strong className={check.result.toLowerCase()}>
                        {label(check.result)}
                      </strong>
                    </div>
                  )) || (
                    <p>
                      {assessment?.summary ||
                        assessment?.result ||
                        "No assessment available."}
                    </p>
                  )}
                </div>
              </div>
            </section>
            <aside className="panel decision">
              <div className="panel-head">
                <b>Decision</b>
              </div>
              <div className="actions">
                {selected.status === "SUBMITTED" && (
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() => act("review")}
                  >
                    Start review
                  </button>
                )}
                {selected.status === "UNDER_REVIEW" && (
                  <>
                    <button
                      className="btn primary"
                      disabled={busy}
                      onClick={() => act("approve")}
                    >
                      Approve
                    </button>
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => setPending("request-info")}
                    >
                      Request information
                    </button>
                    <button
                      className="btn danger"
                      disabled={busy}
                      onClick={() => setPending("reject")}
                    >
                      Reject
                    </button>
                  </>
                )}
                {!["SUBMITTED", "UNDER_REVIEW"].includes(selected.status) && (
                  <p className="help">No action is available in this state.</p>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
      <DecisionDialog
        title={pending === "reject" ? "Reject request" : "Request information"}
        open={pending !== null}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => pending && act(pending, reason)}
      />
    </AppShell>
  );
}
