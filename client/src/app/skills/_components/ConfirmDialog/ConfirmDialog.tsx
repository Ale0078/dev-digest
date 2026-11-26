/* ConfirmDialog — small Modal with a body and Cancel / Confirm. Used for skill
   delete (lists affected agents) and version restore. Text comes from callers. */
"use client";

import React from "react";
import type { CSSProperties } from "react";
import { Button, Modal } from "@devdigest/ui";

const s = {
  body: { padding: "18px 24px", fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)" } satisfies CSSProperties,
  actions: { display: "flex", justifyContent: "flex-end", gap: 10 } satisfies CSSProperties,
} as const;

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  danger,
  pending,
  onConfirm,
  onCancel,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      width={460}
      title={title}
      onClose={onCancel}
      footer={
        <div style={s.actions}>
          <Button kind="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button kind={danger ? "danger" : "primary"} size="sm" onClick={onConfirm} disabled={pending} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div style={s.body}>{children}</div>
    </Modal>
  );
}
