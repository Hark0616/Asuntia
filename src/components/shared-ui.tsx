"use client";

import { CheckCircle2, Clock3, X } from "lucide-react";
import type { ReactNode } from "react";
import { caseStatusLabels, requestStatusLabels, visibilityLabels } from "@/lib/labels";
import type {
  CaseDocument,
  CaseStatus,
  CaseUpdate,
  Client,
  InfoRequest,
  LegalCase,
  RequestStatus,
} from "@/lib/types";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function Modal({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="drawer" role="dialog" aria-modal="true">
      <div className="drawer-panel">
        <div className="drawer-header">
          <h3>{title}</h3>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}

export function CaseCard({
  active,
  legalCase,
  onSelect,
}: {
  active: boolean;
  client?: Client;
  legalCase: LegalCase;
  onSelect: () => void;
}) {
  return (
    <button
      className={`case-card ${active ? "active" : ""}`}
      data-testid={`case-card-${legalCase.id}`}
      type="button"
      onClick={onSelect}
    >
      <div className="case-card-header">
        <div>
          <strong>{legalCase.title}</strong>
          <span className="muted small">Actualizado {formatDate(legalCase.updatedAt)}</span>
        </div>
        <div className="case-card-badges">
          <StatusBadge status={legalCase.status} />
          {legalCase.priority === "alta" ? <span className="badge danger">Alta</span> : null}
        </div>
      </div>
    </button>
  );
}

export function Timeline({ updates }: { updates: CaseUpdate[] }) {
  if (updates.length === 0) {
    return (
      <div className="empty-state">
        <span className="muted">Sin avances</span>
      </div>
    );
  }

  return (
    <div className="timeline">
      {updates.map((update) => (
        <div className="timeline-item" key={update.id}>
          <div className="timeline-dot">
            <Clock3 size={14} />
          </div>
          <div className="timeline-body">
            <div className="row between">
              <strong>{update.author}</strong>
              <span className="muted small">{formatDateTime(update.createdAt)}</span>
            </div>
            <p>{update.body}</p>
            <span className="badge neutral">{visibilityLabels[update.visibility]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RequestList({
  editable = false,
  onStatus,
  requests,
}: {
  editable?: boolean;
  onStatus?: (requestId: string, status: RequestStatus) => void;
  requests: InfoRequest[];
}) {
  const requestStatuses = Object.keys(requestStatusLabels) as RequestStatus[];

  if (requests.length === 0) {
    return (
      <div className="empty-state">
        <span className="muted">Sin solicitudes</span>
      </div>
    );
  }

  return (
    <div className="stack">
      {requests.map((request) => (
        <div className="list-card" key={request.id}>
          <div className="row between">
            <div>
              <strong>{request.title}</strong>
              <span className="muted small">
                {request.owner} · vence {formatDate(request.dueDate)}
              </span>
            </div>
            <span className={request.status === "vencida" ? "badge danger" : "badge warning"}>
              {requestStatusLabels[request.status]}
            </span>
          </div>
          <p className="muted">{request.detail}</p>
          {editable ? (
            <select
              value={request.status}
              onChange={(event) => onStatus?.(request.id, event.target.value as RequestStatus)}
            >
              {requestStatuses.map((status) => (
                <option key={status} value={status}>
                  {requestStatusLabels[status]}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DocumentList({ documents }: { documents: CaseDocument[] }) {
  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <span className="muted">Sin documentos</span>
      </div>
    );
  }

  return (
    <div className="stack">
      {documents.map((document) => (
        <div className="list-card" key={document.id}>
          <div className="row between">
            <div>
              <strong>{document.name}</strong>
              <span className="muted small">
                {document.category} · {formatDate(document.uploadedAt)}
              </span>
            </div>
            <span className="badge neutral">{visibilityLabels[document.visibility]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  const className =
    status === "requiere_cliente"
      ? "badge warning"
      : status === "finalizado"
        ? "badge neutral"
        : "badge";

  return (
    <span className={className}>
      {status === "finalizado" ? <CheckCircle2 size={14} /> : null}
      {caseStatusLabels[status]}
    </span>
  );
}

export function formatDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return dateFormatter.format(new Date(year, month - 1, day));
  }

  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string) {
  return timeFormatter.format(new Date(value));
}
