"use client";
import { formatValue, label } from "@/lib/api";
import type { MoveRequest } from "@/lib/types";

export function RequestSummary({ request }: { request: MoveRequest | null }) {
  const latestReason = [...(request?.events ?? [])]
    .reverse()
    .find((event) => event.data?.reason)?.data?.reason;

  return (
    <aside className="panel summary">
      <div className="panel-head">
        <b>Request</b>
        {request && (
          <button
            className="refresh-button"
            type="button"
            onClick={() => window.dispatchEvent(new Event("move-desk:refresh"))}
          >
            Refresh status
          </button>
        )}
      </div>
      {request ? (
        <div className="pad">
          <strong
            className={`status ${request.status === "REJECTED" ? "rejected" : ""}`}
          >
            {label(request.status)}
          </strong>
          {latestReason && (
            <div className="decision-note">
              <b>Administrator note</b>
              <p>{latestReason}</p>
            </div>
          )}
          <dl>
            <div>
              <dt>Type</dt>
              <dd>{label(request.type)}</dd>
            </div>
            {Object.entries(request.requestData)
              .filter(([, value]) =>
                value !== null && !Array.isArray(value)
                  ? typeof value !== "object"
                  : true,
              )
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{label(key)}</dt>
                  <dd>{formatValue(value)}</dd>
                </div>
              ))}
          </dl>
          <p className="help">
            {request.status === "REJECTED"
              ? "This request is closed. Start a new conversation to create another request."
              : request.status === "INFO_REQUESTED"
                ? "Continue the conversation with the information requested by Admin."
                : "Continue the conversation to complete or follow the request."}
          </p>
        </div>
      ) : (
        <div className="empty">Request details will appear here.</div>
      )}
    </aside>
  );
}
