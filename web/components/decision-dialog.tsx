"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
export function DecisionDialog({
  title,
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [reason, setReason] = useState("");
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (reason.trim()) onConfirm(reason.trim());
  }
  return (
    <dialog ref={dialog} className="dialog" onCancel={onCancel}>
      <form onSubmit={submit}>
        <h2>{title}</h2>
        <p>Give the resident a clear reason.</p>
        <textarea
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          required
        />
        <div>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            Confirm
          </button>
        </div>
      </form>
    </dialog>
  );
}
