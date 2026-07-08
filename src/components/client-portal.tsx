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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import {
  DocumentList,
  RequestList,
  StatusBadge,
  Timeline,
  formatDate,
} from "@/components/shared-ui";
import {
  audit,
  cloneSeed,
  createId,
  getTodayIso,
  loadWorkspaceData,
  saveWorkspaceData,
} from "@/lib/storage";
import {
  getCaseDocuments,
  getCaseMilestones,
  getCaseRequests,
  getCaseUpdates,
  getClientActiveCases,
  getClientForCase,
  getCurrentMilestone,
  getPendingClientRequest,
  resolvePublicAccess,
} from "@/lib/workspace-selectors";
import type {
  CaseDocument,
  CaseMilestone,
  CaseUpdate,
  Client,
  InfoRequest,
  LegalCase,
  WorkspaceData,
} from "@/lib/types";

export function ClientPortal() {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData>(() => cloneSeed());
  const [accessLabel, setAccessLabel] = useState("");
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [isResolvingTracking, setIsResolvingTracking] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function resolveTracking() {
      const loaded = await loadWorkspaceData();
      if (!isActive) {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const initialQuery =
        params.get("codigo") ??
        params.get("consulta") ??
        window.sessionStorage.getItem("asuntia.accessQuery") ??
        window.sessionStorage.getItem("asuntia.trackingCode") ??
        "";

      setData(loaded);

      if (!initialQuery) {
        window.sessionStorage.removeItem("asuntia.accessQuery");
        router.replace("/");
        return;
      }

      const target = resolvePublicAccess(loaded, initialQuery);

      if (!target) {
        window.sessionStorage.removeItem("asuntia.accessQuery");
        router.replace("/");
        return;
      }

      window.sessionStorage.setItem("asuntia.accessQuery", initialQuery);

      if (target.kind === "case") {
        setAccessLabel(target.legalCase.trackingCode);
        setActiveClientId(target.client.id);
        setActiveCaseId(target.legalCase.id);
        setIsResolvingTracking(false);
        return;
      }

      const activeCases = getClientActiveCases(loaded, target.client.id);
      setAccessLabel(target.client.email);
      setActiveClientId(target.client.id);
      setActiveCaseId(activeCases[0]?.id ?? null);
      setIsResolvingTracking(false);
    }

    void resolveTracking();

    return () => {
      isActive = false;
    };
  }, [router]);

  const activeClient = activeClientId
    ? data.clients.find((client) => client.id === activeClientId)
    : undefined;
  const activeClientCases = activeClient ? getClientActiveCases(data, activeClient.id) : [];
  const activeTrackingCase = activeCaseId
    ? data.cases.find((legalCase) => legalCase.id === activeCaseId)
    : undefined;
  const activeCaseClient = activeTrackingCase ? getClientForCase(data, activeTrackingCase) : undefined;

  function commit(next: WorkspaceData) {
    setData(next);
    void saveWorkspaceData(next).catch((error) => {
      console.error("Failed to save client workspace", error);
    });
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

  function closeTracking() {
    window.sessionStorage.removeItem("asuntia.accessQuery");
    window.sessionStorage.removeItem("asuntia.trackingCode");
    router.push("/");
  }

  if (isResolvingTracking || !activeClient) {
    return null;
  }

  return (
    <main className="app-shell">
      <AppHeader
        contextLabel={accessLabel}
        exitLabel="Cerrar consulta"
        onExit={closeTracking}
      />

      <section className="main tracking-shell">
        <ClientCaseSwitcher
          activeCaseId={activeCaseId}
          cases={activeClientCases}
          client={activeClient}
          onSelect={setActiveCaseId}
        />

        {activeTrackingCase && activeCaseClient ? (
          <ClientTrackingDetail
            client={activeCaseClient}
            documents={getCaseDocuments(data, activeTrackingCase.id, "client")}
            legalCase={activeTrackingCase}
            milestones={getCaseMilestones(data, activeTrackingCase.id)}
            requests={getCaseRequests(data, activeTrackingCase.id)}
            updates={getCaseUpdates(data, activeTrackingCase.id, "client")}
            onAddEvidence={addClientEvidence}
            onExit={closeTracking}
          />
        ) : (
          <div className="empty-state">
            <span className="muted">No hay asuntos activos para este cliente.</span>
          </div>
        )}
      </section>
    </main>
  );
}

function ClientCaseSwitcher({
  activeCaseId,
  cases,
  client,
  onSelect,
}: {
  activeCaseId: string | null;
  cases: LegalCase[];
  client: Client;
  onSelect: (caseId: string) => void;
}) {
  return (
    <section className="panel client-case-switcher" data-testid="client-case-switcher">
      <div className="section-title">
        <div>
          <h3>Casos activos</h3>
          <span className="muted small">
            {client.name} · {cases.length} asuntos
          </span>
        </div>
        <FileText size={17} />
      </div>

      {cases.length > 0 ? (
        <div className="client-case-list">
          {cases.map((legalCase) => (
            <button
              className={`client-case-option ${legalCase.id === activeCaseId ? "active" : ""}`}
              data-testid={`client-case-option-${legalCase.id}`}
              key={legalCase.id}
              type="button"
              onClick={() => onSelect(legalCase.id)}
            >
              <div>
                <strong>{legalCase.title}</strong>
                <span className="muted small">
                  {legalCase.trackingCode} · Responsable: {legalCase.responsible}
                </span>
              </div>
              <StatusBadge status={legalCase.status} />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state compact">
          <span className="muted">Sin asuntos activos</span>
        </div>
      )}
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
  const currentMilestone = getCurrentMilestone(milestones);
  const pendingRequest = getPendingClientRequest(requests);
  const showActionCard =
    legalCase.status === "requiere_cliente" ||
    Boolean(pendingRequest) ||
    Boolean(currentMilestone?.evidenceEnabled);

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

      {showActionCard ? (
        <ClientActionCard
          currentMilestone={currentMilestone}
          legalCase={legalCase}
          request={pendingRequest}
        />
      ) : null}

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

function ClientActionCard({
  currentMilestone,
  legalCase,
  request,
}: {
  currentMilestone?: CaseMilestone;
  legalCase: LegalCase;
  request?: InfoRequest;
}) {
  const hasUpload = currentMilestone?.status === "current" && currentMilestone.evidenceEnabled;
  const title = request?.title ?? currentMilestone?.title ?? "Informacion pendiente";
  const detail = request?.detail ?? currentMilestone?.description ?? legalCase.nextStep;
  const dueDate = request?.dueDate ?? currentMilestone?.date;

  return (
    <section className="client-action-card" data-testid="client-action-card">
      <div>
        <span className="badge warning">Requiere cliente</span>
        <h3>{title}</h3>
        <p>{detail}</p>
        {dueDate ? <span className="muted small">Fecha limite: {formatDate(dueDate)}</span> : null}
      </div>
      {hasUpload ? (
        <a className="primary-button" href="#client-evidence">
          <FileText size={16} />
          Subir documento
        </a>
      ) : null}
    </section>
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
  const currentMilestone = getCurrentMilestone(milestones);
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
  const [selectedFileName, setSelectedFileName] = useState("");
  const [sentFileName, setSentFileName] = useState("");

  function sendEvidence() {
    if (!selectedFileName) {
      return;
    }

    onAddEvidence(legalCase.id, milestone.id, selectedFileName);
    setSentFileName(selectedFileName);
    setSelectedFileName("");
  }

  const sentDocument = sentFileName
    ? documents.find((document) => document.name === sentFileName)
    : undefined;

  return (
    <div className="evidence-box" id="client-evidence">
      <div>
        <strong>Sube el documento solicitado</strong>
        <p className="muted">Selecciona el archivo y confirma el envio a la firma.</p>
      </div>
      <div className="tracking-input-row">
        <label className="file-picker">
          <FileText size={16} />
          <span>{selectedFileName || "Seleccionar archivo"}</span>
          <input
            data-testid="client-evidence-file"
            onChange={(event) => {
              const file = event.target.files?.[0]?.name ?? "";
              setSelectedFileName(file);
            }}
            type="file"
          />
        </label>
        <button
          className="primary-button"
          data-testid="send-evidence"
          disabled={!selectedFileName}
          type="button"
          onClick={sendEvidence}
        >
          Enviar documento
        </button>
      </div>
      {selectedFileName ? <span className="badge neutral">{selectedFileName}</span> : null}
      {sentDocument ? <span className="badge">Recibido por la firma</span> : null}
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
