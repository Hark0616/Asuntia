"use client";

import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
    const loaded = loadWorkspace();
    const params = new URLSearchParams(window.location.search);
    const initialCode =
      params.get("codigo") ?? window.sessionStorage.getItem("asuntia.trackingCode") ?? "";

    setData(loaded);
    if (initialCode) {
      const normalizedCode = initialCode.trim().toUpperCase();
      const legalCase = loaded.cases.find(
        (item) => item.trackingCode.toUpperCase() === normalizedCode,
      );

      if (legalCase) {
        setTrackingCode(legalCase.trackingCode);
        setActiveTrackingCaseId(legalCase.id);
        setTrackingError("");
      } else {
        setTrackingCode(initialCode);
        setTrackingError("No encontramos un asunto con ese codigo.");
      }
    }
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
      <AppHeader exitLabel="Cerrar consulta" />

      {!activeTrackingCase || !activeClient ? (
        <ClientAccessNotice trackingCode={trackingCode} trackingError={trackingError} />
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

function ClientAccessNotice({
  trackingCode,
  trackingError,
}: {
  trackingCode: string;
  trackingError: string;
}) {
  return (
    <section className="client-gate">
      <div className="client-gate-panel">
        <div>
          <h2>Consulta no abierta</h2>
        </div>

        {trackingCode || trackingError ? (
          <span className="small error-text">
            {trackingError || `No fue posible abrir ${trackingCode}.`}
          </span>
        ) : null}

        <Link className="primary-button" href="/">
          Consultar asunto
        </Link>
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
        <label className="file-picker">
          <FileText size={16} />
          <span>{fileName || "Seleccionar archivo"}</span>
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
        </label>
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
