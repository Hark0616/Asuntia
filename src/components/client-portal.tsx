"use client";

import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
  LogIn,
  Search,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import {
  DocumentList,
  RequestList,
  StatusBadge,
  Timeline,
  formatDate,
} from "@/components/shared-ui";
import { audit, cloneSeed, createId, getTodayIso, loadWorkspace, saveWorkspace } from "@/lib/storage";
import type {
  CaseDocument,
  CaseMilestone,
  CaseUpdate,
  Client,
  InfoRequest,
  LegalCase,
  Visibility,
  WorkspaceData,
} from "@/lib/types";

export function ClientPortal() {
  const [data, setData] = useState<WorkspaceData>(() => cloneSeed());
  const [trackingCode, setTrackingCode] = useState("");
  const [activeTrackingCaseId, setActiveTrackingCaseId] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState("");

  useEffect(() => {
    setData(loadWorkspace());
  }, []);

  const activeTrackingCase = activeTrackingCaseId
    ? data.cases.find((legalCase) => legalCase.id === activeTrackingCaseId)
    : undefined;
  const activeClient = activeTrackingCase
    ? data.clients.find((client) => client.id === activeTrackingCase.clientId)
    : undefined;

  function commit(next: WorkspaceData) {
    setData(next);
    saveWorkspace(next);
  }

  function resetDemo() {
    const next = cloneSeed();
    commit(next);
    setActiveTrackingCaseId(null);
    setTrackingCode("");
    setTrackingError("");
  }

  function openTrackingPortal(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const legalCase = data.cases.find((item) => item.trackingCode.toUpperCase() === normalizedCode);

    if (!legalCase) {
      setTrackingError("No encontramos un asunto con ese codigo.");
      setActiveTrackingCaseId(null);
      return;
    }

    setTrackingCode(legalCase.trackingCode);
    setActiveTrackingCaseId(legalCase.id);
    setTrackingError("");
  }

  function addClientEvidence(caseId: string, milestoneId: string, fileName: string) {
    const legalCase = data.cases.find((item) => item.id === caseId);
    const milestone = data.milestones.find((item) => item.id === milestoneId);
    if (!legalCase || !milestone || !fileName.trim()) {
      return;
    }

    const document: CaseDocument = {
      id: createId("doc"),
      caseId,
      milestoneId,
      name: fileName.trim(),
      category: "Evidencia cliente",
      visibility: "client",
      status: "recibido",
      uploadedAt: getTodayIso(),
    };

    commit({
      ...data,
      documents: [document, ...data.documents],
      audit: [audit("Cliente", "Cargo evidencia", milestone.title), ...data.audit],
    });
  }

  function visibleUpdates(caseId: string, visibility?: Visibility) {
    return data.updates
      .filter((update) => update.caseId === caseId)
      .filter((update) => (visibility ? update.visibility === visibility : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function caseRequests(caseId: string) {
    return data.requests
      .filter((request) => request.caseId === caseId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  function caseDocuments(caseId: string, visibility?: Visibility) {
    return data.documents
      .filter((document) => document.caseId === caseId)
      .filter((document) => (visibility ? document.visibility === visibility : true))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  function caseMilestones(caseId: string) {
    return data.milestones
      .filter((milestone) => milestone.caseId === caseId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  return (
    <main className="app-shell">
      <AppHeader active="cliente" onReset={resetDemo} />

      {!activeTrackingCase || !activeClient ? (
        <TrackingGate
          trackingCode={trackingCode}
          trackingError={trackingError}
          onOpenTracking={openTrackingPortal}
          onTrackingCode={setTrackingCode}
        />
      ) : (
        <section className="main tracking-shell">
          <ClientTrackingDetail
            client={activeClient}
            documents={caseDocuments(activeTrackingCase.id, "client")}
            legalCase={activeTrackingCase}
            milestones={caseMilestones(activeTrackingCase.id)}
            requests={caseRequests(activeTrackingCase.id)}
            updates={visibleUpdates(activeTrackingCase.id, "client")}
            onAddEvidence={addClientEvidence}
            onExit={() => setActiveTrackingCaseId(null)}
          />
        </section>
      )}
    </main>
  );
}

function TrackingGate({
  trackingCode,
  trackingError,
  onOpenTracking,
  onTrackingCode,
}: {
  trackingCode: string;
  trackingError: string;
  onOpenTracking: (code: string) => void;
  onTrackingCode: (code: string) => void;
}) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onOpenTracking(trackingCode);
  }

  return (
    <section className="client-gate">
      <div className="client-gate-panel">
        <div>
          <span className="badge neutral">Portal cliente</span>
          <h2>Consulta el estado de tu asunto</h2>
          <p className="muted">
            Ingresa el codigo de seguimiento o radicado compartido por la firma.
          </p>
        </div>

        <form className="tracking-form" onSubmit={handleSubmit}>
          <label htmlFor="tracking-code">Codigo de seguimiento</label>
          <div className="tracking-input-row">
            <Search size={18} />
            <input
              data-testid="tracking-code"
              id="tracking-code"
              onChange={(event) => onTrackingCode(event.target.value)}
              placeholder="AS-2026-001"
              value={trackingCode}
            />
            <button className="primary-button" data-testid="open-tracking" type="submit">
              <LogIn size={16} />
              Consultar
            </button>
          </div>
          {trackingError ? <span className="small error-text">{trackingError}</span> : null}
        </form>

        <div className="demo-codes">
          <span className="muted small">Codigos demo</span>
          <button
            className="ghost-button"
            data-testid="demo-code-case-1"
            type="button"
            onClick={() => onTrackingCode("AS-2026-001")}
          >
            AS-2026-001
          </button>
          <button className="ghost-button" type="button" onClick={() => onTrackingCode("AS-2026-003")}>
            AS-2026-003
          </button>
        </div>
      </div>
    </section>
  );
}

function ClientTrackingDetail({
  client,
  documents,
  legalCase,
  milestones,
  requests,
  updates,
  onAddEvidence,
  onExit,
}: {
  client: Client;
  documents: CaseDocument[];
  legalCase: LegalCase;
  milestones: CaseMilestone[];
  requests: InfoRequest[];
  updates: CaseUpdate[];
  onAddEvidence: (caseId: string, milestoneId: string, fileName: string) => void;
  onExit: () => void;
}) {
  return (
    <>
      <div className="tracking-header">
        <div>
          <span className="badge neutral">{legalCase.trackingCode}</span>
          <h2>{legalCase.title}</h2>
          <p className="muted">
            {client.name} · Responsable: {legalCase.responsible}
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={onExit}>
          <X size={16} />
          Consultar otro
        </button>
      </div>

      <section className="tracking-grid">
        <div className="panel tracking-main">
          <div>
            <div className="row between">
              <h3>Estado del asunto</h3>
              <StatusBadge status={legalCase.status} />
            </div>
            <p className="muted">{legalCase.description}</p>
          </div>

          <MilestoneTracker
            documents={documents}
            legalCase={legalCase}
            milestones={milestones}
            onAddEvidence={onAddEvidence}
          />
        </div>

        <aside className="tracking-side">
          <div className="panel">
            <div className="section-title">
              <h3>Proximo paso</h3>
              <CalendarClock size={17} />
            </div>
            <div className="list-card" data-testid="client-next-step">
              <strong>{legalCase.nextStep}</strong>
            </div>
          </div>

          <div className="panel">
            <div className="section-title">
              <h3>Solicitudes</h3>
              <CalendarClock size={17} />
            </div>
            <RequestList requests={requests} />
          </div>

          <div className="panel">
            <div className="section-title">
              <h3>Documentos</h3>
              <FileText size={17} />
            </div>
            <DocumentList documents={documents} />
          </div>

          <div className="panel">
            <div className="section-title">
              <h3>Avances publicados</h3>
              <History size={17} />
            </div>
            <Timeline updates={updates} />
          </div>
        </aside>
      </section>
    </>
  );
}

function MilestoneTracker({
  documents,
  legalCase,
  milestones,
  onAddEvidence,
}: {
  documents: CaseDocument[];
  legalCase: LegalCase;
  milestones: CaseMilestone[];
  onAddEvidence: (caseId: string, milestoneId: string, fileName: string) => void;
}) {
  const currentMilestone = milestones.find((milestone) => milestone.status === "current");
  const currentMilestoneId = currentMilestone?.id;
  const [expanded, setExpanded] = useState<string[]>(() =>
    currentMilestoneId ? [currentMilestoneId] : [],
  );

  useEffect(() => {
    setExpanded(currentMilestoneId ? [currentMilestoneId] : []);
  }, [currentMilestoneId]);

  function toggleMilestone(milestoneId: string) {
    setExpanded((current) =>
      current.includes(milestoneId)
        ? current.filter((item) => item !== milestoneId)
        : [...current, milestoneId],
    );
  }

  if (milestones.length === 0) {
    return (
      <div className="empty-state">
        <span className="muted">Sin hitos configurados</span>
      </div>
    );
  }

  return (
    <div className="milestone-list" data-testid="milestone-list">
      {milestones.map((milestone, index) => {
        const isExpanded = expanded.includes(milestone.id);
        const milestoneDocuments = documents.filter(
          (document) => document.milestoneId === milestone.id,
        );

        return (
          <article
            className={`milestone-item milestone-${milestone.status}`}
            data-testid={`milestone-${milestone.id}`}
            key={milestone.id}
          >
            <div className="milestone-rail">
              <div className="milestone-marker">
                {milestone.status === "completed" ? <CheckCircle2 size={16} /> : index + 1}
              </div>
              {index < milestones.length - 1 ? <div className="milestone-line" /> : null}
            </div>

            <div className="milestone-card">
              <button
                className="milestone-head"
                type="button"
                onClick={() => toggleMilestone(milestone.id)}
              >
                <div>
                  <span className="muted small">{formatDate(milestone.date)}</span>
                  <strong>{milestone.title}</strong>
                </div>
                <div className="row">
                  <MilestoneStatusBadge status={milestone.status} />
                  {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                </div>
              </button>

              {isExpanded ? (
                <div className="milestone-detail">
                  <p>{milestone.description}</p>
                  <span className="muted">{milestone.detail}</span>

                  {milestone.evidenceEnabled && milestone.status === "current" ? (
                    <EvidenceUpload
                      documents={milestoneDocuments}
                      legalCase={legalCase}
                      milestone={milestone}
                      onAddEvidence={onAddEvidence}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EvidenceUpload({
  documents,
  legalCase,
  milestone,
  onAddEvidence,
}: {
  documents: CaseDocument[];
  legalCase: LegalCase;
  milestone: CaseMilestone;
  onAddEvidence: (caseId: string, milestoneId: string, fileName: string) => void;
}) {
  const [fileName, setFileName] = useState("");

  return (
    <div className="evidence-box">
      <div>
        <strong>La firma habilito carga para esta etapa</strong>
        <p className="muted">Adjunta evidencia o informacion relacionada con este hito.</p>
      </div>
      <div className="tracking-input-row">
        <input
          data-testid="client-evidence-file"
          onChange={(event) => {
            const file = event.target.files?.[0]?.name ?? "";
            setFileName(file);
            if (file) {
              onAddEvidence(legalCase.id, milestone.id, file);
            }
          }}
          type="file"
        />
        {fileName ? <span className="badge">{fileName}</span> : null}
      </div>
      {documents.length > 0 ? (
        <div className="stack">
          {documents.map((document) => (
            <div className="list-card" key={document.id}>
              <strong>{document.name}</strong>
              <span className="muted small">Recibido {formatDate(document.uploadedAt)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MilestoneStatusBadge({ status }: { status: CaseMilestone["status"] }) {
  if (status === "completed") {
    return <span className="badge neutral">Completado</span>;
  }

  if (status === "current") {
    return <span className="badge">Actual</span>;
  }

  return <span className="badge neutral">Siguiente</span>;
}
