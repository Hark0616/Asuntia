"use client";

import { CalendarClock, Eye, EyeOff, FileText, History, Plus, Save, Send, Upload } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import {
  CaseCard,
  DocumentList,
  formatDate,
  Metric,
  Modal,
  RequestList,
  StatusBadge,
  Timeline,
} from "@/components/shared-ui";
import {
  caseStatusLabels,
  milestoneStatusLabels,
  workQueueKindLabels,
  workQueueSeverityLabels,
} from "@/lib/labels";
import {
  audit,
  cloneSeed,
  createId,
  getTodayIso,
  loadWorkspaceData,
  saveWorkspaceData,
} from "@/lib/storage";
import { insertCaseMilestone, updateCaseMilestone } from "@/lib/workspace-mutators";
import {
  getFirmWorkQueue,
  getCaseDocuments,
  getCaseMilestones,
  getCaseRequests,
  getCaseUpdates,
} from "@/lib/workspace-selectors";
import type { FirmWorkQueueItem } from "@/lib/workspace-selectors";
import type {
  CaseDocument,
  CaseMilestone,
  CaseStatus,
  CaseUpdate,
  Client,
  InfoRequest,
  LegalCase,
  MilestoneStatus,
  RequestStatus,
  Visibility,
  WorkspaceData,
} from "@/lib/types";

type DrawerKind = "client" | "case" | null;

const lawyers = ["Daniela Torres", "Martin Acosta", "Sofia Bernal"];
const caseStatuses = Object.keys(caseStatusLabels) as CaseStatus[];
const milestoneStatuses = Object.keys(milestoneStatusLabels) as MilestoneStatus[];

export function FirmPortal() {
  const [data, setData] = useState<WorkspaceData>(() => cloneSeed());
  const [selectedClientId, setSelectedClientId] = useState("client-1");
  const [selectedCaseId, setSelectedCaseId] = useState("case-1");
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const referenceDate = useMemo(() => getTodayIso().slice(0, 10), []);

  useEffect(() => {
    let isActive = true;

    async function loadWorkspace() {
      const loaded = await loadWorkspaceData();
      if (!isActive) {
        return;
      }

      setData(loaded);
      setSelectedClientId(loaded.clients[0]?.id ?? "");
      setSelectedCaseId(loaded.cases[0]?.id ?? "");
      setIsWorkspaceLoading(false);
    }

    void loadWorkspace();

    return () => {
      isActive = false;
    };
  }, []);

  const clientsById = useMemo(() => {
    return new Map(data.clients.map((client) => [client.id, client]));
  }, [data.clients]);

  const selectedClient = clientsById.get(selectedClientId) ?? data.clients[0];
  const selectedCase =
    data.cases.find((legalCase) => legalCase.id === selectedCaseId) ??
    data.cases.find((legalCase) => legalCase.clientId === selectedClient?.id) ??
    data.cases[0];

  const selectedClientCases = useMemo(() => {
    if (!selectedClient) {
      return [];
    }

    return data.cases
      .filter((legalCase) => legalCase.clientId === selectedClient.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [data.cases, selectedClient]);

  const metrics = useMemo(() => {
    const openCases = data.cases.filter((legalCase) => legalCase.status !== "finalizado");
    const clientAction = data.cases.filter(
      (legalCase) => legalCase.status === "requiere_cliente",
    );
    const pendingRequests = data.requests.filter(
      (request) => !["aceptada", "recibida"].includes(request.status),
    );

    return {
      clients: data.clients.length,
      openCases: openCases.length,
      clientAction: clientAction.length,
      pendingRequests: pendingRequests.length,
    };
  }, [data]);

  const workQueue = useMemo(() => {
    return getFirmWorkQueue(data, referenceDate);
  }, [data, referenceDate]);

  function commit(next: WorkspaceData) {
    setData(next);
    void saveWorkspaceData(next).catch((error) => {
      console.error("Failed to save firm workspace", error);
    });
  }

  function handleClientSelect(clientId: string) {
    setSelectedClientId(clientId);
    const firstCase = data.cases.find((legalCase) => legalCase.clientId === clientId);
    if (firstCase) {
      setSelectedCaseId(firstCase.id);
    }
  }

  function addClient(input: Pick<Client, "name" | "contactName" | "email" | "phone">) {
    const client: Client = {
      ...input,
      id: createId("client"),
      createdAt: getTodayIso(),
    };

    commit({
      ...data,
      clients: [client, ...data.clients],
      audit: [audit("Firma", "Creo cliente", client.name), ...data.audit],
    });
    setSelectedClientId(client.id);
    setDrawer(null);
  }

  function addCase(
    input: Pick<
      LegalCase,
      "clientId" | "title" | "description" | "responsible" | "nextStep" | "priority"
    >,
  ) {
    const now = getTodayIso();
    const legalCase: LegalCase = {
      ...input,
      id: createId("case"),
      trackingCode: `AS-${new Date().getFullYear()}-${String(data.cases.length + 1).padStart(3, "0")}`,
      status: "nuevo",
      createdAt: now,
      updatedAt: now,
    };
    const initialUpdate: CaseUpdate = {
      id: createId("update"),
      caseId: legalCase.id,
      author: input.responsible,
      body: "Se abrio el asunto en Asuntia.",
      visibility: "client",
      createdAt: now,
    };
    const initialMilestone: CaseMilestone = {
      id: createId("milestone"),
      caseId: legalCase.id,
      title: "Apertura del asunto",
      description: "La firma registro el asunto y definio el primer paso.",
      detail: input.nextStep,
      date: now.slice(0, 10),
      status: "current",
      evidenceEnabled: false,
    };

    commit({
      ...data,
      cases: [legalCase, ...data.cases],
      milestones: [initialMilestone, ...data.milestones],
      updates: [initialUpdate, ...data.updates],
      audit: [audit("Firma", "Creo caso", legalCase.title), ...data.audit],
    });
    setSelectedClientId(input.clientId);
    setSelectedCaseId(legalCase.id);
    setDrawer(null);
  }

  function updateCaseFields(caseId: string, patch: Partial<LegalCase>) {
    setData((current) => {
      const legalCase = current.cases.find((item) => item.id === caseId);
      if (!legalCase) {
        return current;
      }

      const next = {
        ...current,
        cases: current.cases.map((item) =>
          item.id === caseId ? { ...item, ...patch, updatedAt: getTodayIso() } : item,
        ),
        audit: [audit("Firma", "Actualizo caso", legalCase.title), ...current.audit],
      };

      void saveWorkspaceData(next).catch((error) => {
        console.error("Failed to save firm workspace", error);
      });

      return next;
    });
  }

  function handleWorkQueueSelect(item: FirmWorkQueueItem) {
    setSelectedClientId(item.clientId);
    setSelectedCaseId(item.caseId);
  }

  function addMilestone(
    caseId: string,
    input: Omit<CaseMilestone, "id" | "caseId">,
  ) {
    const legalCase = data.cases.find((item) => item.id === caseId);
    if (
      !legalCase ||
      !input.title.trim() ||
      !input.description.trim() ||
      !input.detail.trim() ||
      !input.date
    ) {
      return;
    }

    const milestone: CaseMilestone = {
      ...input,
      id: createId("milestone"),
      caseId,
      title: input.title.trim(),
      description: input.description.trim(),
      detail: input.detail.trim(),
    };
    const now = getTodayIso();

    commit({
      ...data,
      milestones: insertCaseMilestone(data.milestones, milestone),
      cases: data.cases.map((item) =>
        item.id === caseId ? { ...item, updatedAt: now } : item,
      ),
      audit: [audit(legalCase.responsible, "Creo hito", milestone.title), ...data.audit],
    });
  }

  function updateMilestone(
    caseId: string,
    milestoneId: string,
    patch: Partial<CaseMilestone>,
  ) {
    const legalCase = data.cases.find((item) => item.id === caseId);
    const milestone = data.milestones.find((item) => item.id === milestoneId);
    if (!legalCase || !milestone) {
      return;
    }

    const now = getTodayIso();

    commit({
      ...data,
      milestones: updateCaseMilestone(data.milestones, caseId, milestoneId, patch),
      cases: data.cases.map((item) =>
        item.id === caseId ? { ...item, updatedAt: now } : item,
      ),
      audit: [audit(legalCase.responsible, "Actualizo hito", milestone.title), ...data.audit],
    });
  }

  function addUpdate(caseId: string, body: string, visibility: Visibility) {
    const legalCase = data.cases.find((item) => item.id === caseId);
    if (!legalCase || !body.trim()) {
      return;
    }

    const newUpdate: CaseUpdate = {
      id: createId("update"),
      caseId,
      author: legalCase.responsible,
      body: body.trim(),
      visibility,
      createdAt: getTodayIso(),
    };

    commit({
      ...data,
      updates: [newUpdate, ...data.updates],
      cases: data.cases.map((item) =>
        item.id === caseId ? { ...item, updatedAt: newUpdate.createdAt } : item,
      ),
      audit: [audit(legalCase.responsible, "Agrego avance", legalCase.title), ...data.audit],
    });
  }

  function addRequest(caseId: string, input: Omit<InfoRequest, "id" | "caseId" | "createdAt">) {
    const legalCase = data.cases.find((item) => item.id === caseId);
    if (!legalCase) {
      return;
    }

    const request: InfoRequest = {
      ...input,
      id: createId("request"),
      caseId,
      createdAt: getTodayIso(),
    };

    commit({
      ...data,
      requests: [request, ...data.requests],
      cases: data.cases.map((item) =>
        item.id === caseId
          ? { ...item, status: "requiere_cliente", updatedAt: request.createdAt }
          : item,
      ),
      audit: [audit(legalCase.responsible, "Creo solicitud", request.title), ...data.audit],
    });
  }

  function updateRequestStatus(requestId: string, status: RequestStatus) {
    const request = data.requests.find((item) => item.id === requestId);
    if (!request) {
      return;
    }

    commit({
      ...data,
      requests: data.requests.map((item) =>
        item.id === requestId ? { ...item, status } : item,
      ),
      audit: [audit("Firma", "Cambio solicitud", request.title), ...data.audit],
    });
  }

  function addDocument(
    caseId: string,
    input: Pick<CaseDocument, "name" | "category" | "visibility">,
  ) {
    const legalCase = data.cases.find((item) => item.id === caseId);
    if (!legalCase || !input.name.trim()) {
      return;
    }

    const document: CaseDocument = {
      ...input,
      id: createId("doc"),
      caseId,
      name: input.name.trim(),
      status: "recibido",
      uploadedAt: getTodayIso(),
    };

    commit({
      ...data,
      documents: [document, ...data.documents],
      audit: [audit(legalCase.responsible, "Cargo documento", document.name), ...data.audit],
    });
  }

  if (isWorkspaceLoading) {
    return null;
  }

  return (
    <main className="app-shell">
      <AppHeader areaLabel="Firma" exitLabel="Salir" />
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="section-title">
              <h3>Clientes</h3>
              <button className="icon-button" type="button" onClick={() => setDrawer("client")}>
                <Plus size={16} />
              </button>
            </div>

            <div className="stack">
              {data.clients.map((client) => (
                <button
                  className={`client-entry ${client.id === selectedClientId ? "active" : ""}`}
                  key={client.id}
                  type="button"
                  onClick={() => handleClientSelect(client.id)}
                >
                  <strong>{client.name}</strong>
                  <span className="muted small">{client.contactName}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="main">
          <div className="toolbar">
            <div>
              <h2>{selectedClient?.name ?? "Clientes"}</h2>
              <span className="muted">{selectedClient?.email ?? "Sin cliente seleccionado"}</span>
            </div>
            <button
              className="primary-button"
              data-testid="open-case-drawer"
              type="button"
              onClick={() => setDrawer("case")}
            >
              <Plus size={16} />
              Nuevo caso
            </button>
          </div>

          <WorkQueuePanel
            items={workQueue}
            selectedCaseId={selectedCase?.id}
            onSelect={handleWorkQueueSelect}
          />

          <div className="grid metrics">
            <Metric label="Clientes" value={metrics.clients} />
            <Metric label="Casos abiertos" value={metrics.openCases} />
            <Metric label="Accion cliente" value={metrics.clientAction} />
            <Metric label="Solicitudes" value={metrics.pendingRequests} />
          </div>

          <div className="workspace-flow">
            <section className="panel case-nav-panel">
              <div className="section-title">
                <h3>Casos</h3>
                <span className="muted small">{selectedClientCases.length} activos</span>
              </div>
              <div className="case-list">
                {selectedClientCases.map((legalCase) => (
                  <CaseCard
                    active={selectedCase?.id === legalCase.id}
                    key={legalCase.id}
                    legalCase={legalCase}
                    onSelect={() => setSelectedCaseId(legalCase.id)}
                  />
                ))}
              </div>
            </section>

            {selectedCase ? (
              <CaseDetail
                documents={getCaseDocuments(data, selectedCase.id)}
                legalCase={selectedCase}
                milestones={getCaseMilestones(data, selectedCase.id)}
                requests={getCaseRequests(data, selectedCase.id)}
                updates={getCaseUpdates(data, selectedCase.id)}
                onAddDocument={addDocument}
                onAddMilestone={addMilestone}
                onAddRequest={addRequest}
                onAddUpdate={addUpdate}
                onRequestStatus={updateRequestStatus}
                onUpdateCase={updateCaseFields}
                onUpdateMilestone={updateMilestone}
              />
            ) : (
              <div className="empty-state">
                <span className="muted">Sin casos</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {drawer === "client" ? (
        <ClientDrawer onClose={() => setDrawer(null)} onSubmit={addClient} />
      ) : null}

      {drawer === "case" ? (
        <CaseDrawer
          clients={data.clients}
          defaultClientId={selectedClient?.id ?? data.clients[0]?.id ?? ""}
          onClose={() => setDrawer(null)}
          onSubmit={addCase}
        />
      ) : null}
    </main>
  );
}

function WorkQueuePanel({
  items,
  onSelect,
  selectedCaseId,
}: {
  items: FirmWorkQueueItem[];
  onSelect: (item: FirmWorkQueueItem) => void;
  selectedCaseId?: string;
}) {
  const visibleItems = items.slice(0, 6);

  return (
    <section className="panel work-queue-panel" data-testid="firm-work-queue">
      <div className="section-title">
        <div>
          <h3>Bandeja de trabajo</h3>
          <span className="muted small">
            {visibleItems.length === items.length
              ? `${items.length} pendientes priorizados`
              : `${visibleItems.length} de ${items.length} pendientes priorizados`}
          </span>
        </div>
        <CalendarClock size={17} />
      </div>

      {visibleItems.length > 0 ? (
        <div className="work-queue-list">
          {visibleItems.map((item) => (
            <button
              className={`work-queue-item severity-${item.severity} ${
                item.caseId === selectedCaseId ? "active" : ""
              }`}
              data-testid={`work-queue-item-${item.id}`}
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
            >
              <div className="work-queue-main">
                <div className="row wrap">
                  <span className="badge neutral">{workQueueKindLabels[item.kind]}</span>
                  <span className={`badge queue-${item.severity}`}>
                    {workQueueSeverityLabels[item.severity]}
                  </span>
                  {item.dueDate ? (
                    <span className="muted small">Vence {formatDate(item.dueDate)}</span>
                  ) : null}
                </div>
                <strong>{item.title}</strong>
                <span className="muted small">{item.detail}</span>
              </div>
              <span className="work-queue-client">{item.clientName}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state compact">
          <span className="muted">Sin pendientes operativos</span>
        </div>
      )}
    </section>
  );
}

function CaseDetail({
  documents,
  legalCase,
  milestones,
  requests,
  updates,
  onAddDocument,
  onAddMilestone,
  onAddRequest,
  onAddUpdate,
  onRequestStatus,
  onUpdateCase,
  onUpdateMilestone,
}: {
  documents: CaseDocument[];
  legalCase: LegalCase;
  milestones: CaseMilestone[];
  requests: InfoRequest[];
  updates: CaseUpdate[];
  onAddDocument: (
    caseId: string,
    input: Pick<CaseDocument, "name" | "category" | "visibility">,
  ) => void;
  onAddMilestone: (
    caseId: string,
    input: Omit<CaseMilestone, "id" | "caseId">,
  ) => void;
  onAddRequest: (
    caseId: string,
    input: Omit<InfoRequest, "id" | "caseId" | "createdAt">,
  ) => void;
  onAddUpdate: (caseId: string, body: string, visibility: Visibility) => void;
  onRequestStatus: (requestId: string, status: RequestStatus) => void;
  onUpdateCase: (caseId: string, patch: Partial<LegalCase>) => void;
  onUpdateMilestone: (
    caseId: string,
    milestoneId: string,
    patch: Partial<CaseMilestone>,
  ) => void;
}) {
  const [nextStep, setNextStep] = useState(legalCase.nextStep);

  useEffect(() => {
    setNextStep(legalCase.nextStep);
  }, [legalCase.id, legalCase.nextStep]);

  return (
    <section>
      <div className="panel">
        <div className="row between">
          <div>
            <h3>{legalCase.title}</h3>
            <span className="muted small">
              Codigo: {legalCase.trackingCode} · Responsable: {legalCase.responsible}
            </span>
          </div>
          <StatusBadge status={legalCase.status} />
        </div>

        <p className="muted">{legalCase.description}</p>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="case-status">Estado</label>
            <select
              data-testid="case-status"
              id="case-status"
              value={legalCase.status}
              onChange={(event) =>
                onUpdateCase(legalCase.id, { status: event.target.value as CaseStatus })
              }
            >
              {caseStatuses.map((status) => (
                <option key={status} value={status}>
                  {caseStatusLabels[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="case-priority">Prioridad</label>
            <select
              id="case-priority"
              value={legalCase.priority}
              onChange={(event) =>
                onUpdateCase(legalCase.id, {
                  priority: event.target.value as LegalCase["priority"],
                })
              }
            >
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          <div className="field full">
            <label htmlFor="next-step">Proximo paso</label>
            <textarea
              data-testid="case-next-step"
              id="next-step"
              onChange={(event) => setNextStep(event.target.value)}
              value={nextStep}
            />
          </div>
          <div className="field full">
            <button
              className="secondary-button"
              data-testid="save-case"
              type="button"
              onClick={() => onUpdateCase(legalCase.id, { nextStep })}
            >
              <Save size={16} />
              Guardar caso
            </button>
          </div>
        </div>
      </div>

      <div className="case-workbench">
        <div className="case-workbench-main">
          <MilestonePlanner
            legalCase={legalCase}
            milestones={milestones}
            onAddMilestone={onAddMilestone}
            onUpdateMilestone={onUpdateMilestone}
          />
          <UpdateComposer caseId={legalCase.id} onSubmit={onAddUpdate} />

          <div className="panel">
            <div className="section-title">
              <h3>Timeline</h3>
              <History size={17} />
            </div>
            <Timeline updates={updates} />
          </div>
        </div>

        <aside className="case-workbench-side">
          <RequestComposer caseId={legalCase.id} onSubmit={onAddRequest} />
          <DocumentComposer caseId={legalCase.id} onSubmit={onAddDocument} />

          <div className="panel">
            <div className="section-title">
              <h3>Solicitudes</h3>
              <CalendarClock size={17} />
            </div>
            <RequestList requests={requests} editable onStatus={onRequestStatus} />
          </div>

          <div className="panel">
            <div className="section-title">
              <h3>Documentos</h3>
              <FileText size={17} />
            </div>
            <DocumentList documents={documents} />
          </div>
        </aside>
      </div>
    </section>
  );
}

function MilestonePlanner({
  legalCase,
  milestones,
  onAddMilestone,
  onUpdateMilestone,
}: {
  legalCase: LegalCase;
  milestones: CaseMilestone[];
  onAddMilestone: (
    caseId: string,
    input: Omit<CaseMilestone, "id" | "caseId">,
  ) => void;
  onUpdateMilestone: (
    caseId: string,
    milestoneId: string,
    patch: Partial<CaseMilestone>,
  ) => void;
}) {
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h3>Plan del caso</h3>
          <span className="muted small">{milestones.length} hitos</span>
        </div>
        <CalendarClock size={17} />
      </div>

      {milestones.length > 0 ? (
        <div className="milestone-admin-list">
          {milestones.map((milestone) => (
            <article
              className="milestone-admin-item"
              data-testid={`firm-milestone-${milestone.id}`}
              key={milestone.id}
            >
              <div className="milestone-admin-copy">
                <div className="row wrap">
                  <span className="badge neutral">{formatDate(milestone.date)}</span>
                  <span className="badge">{milestoneStatusLabels[milestone.status]}</span>
                  {milestone.evidenceEnabled ? (
                    <span className="badge warning">Evidencia cliente</span>
                  ) : null}
                </div>
                <strong>{milestone.title}</strong>
                <p className="muted">{milestone.description}</p>
                <span className="small">{milestone.detail}</span>
              </div>

              <div className="milestone-admin-controls">
                <label className="field compact">
                  <span>Estado</span>
                  <select
                    aria-label={`Estado de ${milestone.title}`}
                    data-testid={`milestone-status-${milestone.id}`}
                    value={milestone.status}
                    onChange={(event) =>
                      onUpdateMilestone(legalCase.id, milestone.id, {
                        status: event.target.value as MilestoneStatus,
                      })
                    }
                  >
                    {milestoneStatuses.map((status) => (
                      <option key={status} value={status}>
                        {milestoneStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-field">
                  <input
                    checked={milestone.evidenceEnabled}
                    data-testid={`milestone-evidence-${milestone.id}`}
                    type="checkbox"
                    onChange={(event) =>
                      onUpdateMilestone(legalCase.id, milestone.id, {
                        evidenceEnabled: event.target.checked,
                      })
                    }
                  />
                  Evidencia
                </label>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="muted">Sin hitos configurados</span>
        </div>
      )}

      <MilestoneComposer caseId={legalCase.id} onSubmit={onAddMilestone} />
    </section>
  );
}

function MilestoneComposer({
  caseId,
  onSubmit,
}: {
  caseId: string;
  onSubmit: (
    caseId: string,
    input: Omit<CaseMilestone, "id" | "caseId">,
  ) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [detail, setDetail] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<MilestoneStatus>("upcoming");
  const [evidenceEnabled, setEvidenceEnabled] = useState(false);

  useEffect(() => {
    setTitle("");
    setDescription("");
    setDetail("");
    setDate("");
    setStatus("upcoming");
    setEvidenceEnabled(false);
  }, [caseId]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(caseId, {
      title,
      description,
      detail,
      date,
      status,
      evidenceEnabled,
    });
    setTitle("");
    setDescription("");
    setDetail("");
    setDate("");
    setStatus("upcoming");
    setEvidenceEnabled(false);
  }

  return (
    <form className="milestone-composer" onSubmit={handleSubmit}>
      <div className="section-title compact">
        <h3>Nuevo hito</h3>
        <Plus size={17} />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="milestone-title">Titulo</label>
          <input
            data-testid="milestone-title"
            id="milestone-title"
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </div>
        <div className="field">
          <label htmlFor="milestone-date">Fecha</label>
          <input
            data-testid="milestone-date"
            id="milestone-date"
            onChange={(event) => setDate(event.target.value)}
            required
            type="date"
            value={date}
          />
        </div>
        <div className="field">
          <label htmlFor="milestone-status">Estado</label>
          <select
            data-testid="milestone-status"
            id="milestone-status"
            onChange={(event) => setStatus(event.target.value as MilestoneStatus)}
            value={status}
          >
            {milestoneStatuses.map((milestoneStatus) => (
              <option key={milestoneStatus} value={milestoneStatus}>
                {milestoneStatusLabels[milestoneStatus]}
              </option>
            ))}
          </select>
        </div>
        <label className="checkbox-field form-grid-checkbox">
          <input
            checked={evidenceEnabled}
            data-testid="milestone-evidence"
            type="checkbox"
            onChange={(event) => setEvidenceEnabled(event.target.checked)}
          />
          Evidencia cliente
        </label>
        <div className="field full">
          <label htmlFor="milestone-description">Descripcion visible</label>
          <input
            data-testid="milestone-description"
            id="milestone-description"
            onChange={(event) => setDescription(event.target.value)}
            required
            value={description}
          />
        </div>
        <div className="field full">
          <label htmlFor="milestone-detail">Detalle</label>
          <textarea
            data-testid="milestone-detail"
            id="milestone-detail"
            onChange={(event) => setDetail(event.target.value)}
            required
            value={detail}
          />
        </div>
        <div className="field full">
          <button className="secondary-button" data-testid="create-milestone" type="submit">
            <Plus size={16} />
            Crear hito
          </button>
        </div>
      </div>
    </form>
  );
}

function UpdateComposer({
  caseId,
  onSubmit,
}: {
  caseId: string;
  onSubmit: (caseId: string, body: string, visibility: Visibility) => void;
}) {
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("client");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(caseId, body, visibility);
    setBody("");
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="section-title">
        <h3>Nuevo avance</h3>
        {visibility === "client" ? <Eye size={17} /> : <EyeOff size={17} />}
      </div>
      <div className="form-grid">
        <div className="field full">
          <label htmlFor="update-body">Detalle</label>
          <textarea
            data-testid="update-body"
            id="update-body"
            onChange={(event) => setBody(event.target.value)}
            required
            value={body}
          />
        </div>
        <div className="field">
          <label htmlFor="update-visibility">Visibilidad</label>
          <select
            data-testid="update-visibility"
            id="update-visibility"
            onChange={(event) => setVisibility(event.target.value as Visibility)}
            value={visibility}
          >
            <option value="client">Cliente</option>
            <option value="internal">Interno</option>
          </select>
        </div>
        <div className="field">
          <label>&nbsp;</label>
          <button className="primary-button" data-testid="publish-update" type="submit">
            <Send size={16} />
            Publicar
          </button>
        </div>
      </div>
    </form>
  );
}

function RequestComposer({
  caseId,
  onSubmit,
}: {
  caseId: string;
  onSubmit: (
    caseId: string,
    input: Omit<InfoRequest, "id" | "caseId" | "createdAt">,
  ) => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(caseId, {
      title,
      detail,
      owner,
      dueDate,
      status: "pendiente",
    });
    setTitle("");
    setDetail("");
    setOwner("");
    setDueDate("");
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="section-title">
        <h3>Nueva solicitud</h3>
        <CalendarClock size={17} />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="request-title">Titulo</label>
          <input
            data-testid="request-title"
            id="request-title"
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </div>
        <div className="field">
          <label htmlFor="request-owner">Responsable cliente</label>
          <input
            data-testid="request-owner"
            id="request-owner"
            onChange={(event) => setOwner(event.target.value)}
            required
            value={owner}
          />
        </div>
        <div className="field">
          <label htmlFor="request-date">Fecha limite</label>
          <input
            data-testid="request-date"
            id="request-date"
            onChange={(event) => setDueDate(event.target.value)}
            required
            type="date"
            value={dueDate}
          />
        </div>
        <div className="field full">
          <label htmlFor="request-detail">Detalle</label>
          <textarea
            data-testid="request-detail"
            id="request-detail"
            onChange={(event) => setDetail(event.target.value)}
            required
            value={detail}
          />
        </div>
        <div className="field full">
          <button className="secondary-button" data-testid="create-request" type="submit">
            <Plus size={16} />
            Crear solicitud
          </button>
        </div>
      </div>
    </form>
  );
}

function DocumentComposer({
  caseId,
  onSubmit,
}: {
  caseId: string;
  onSubmit: (
    caseId: string,
    input: Pick<CaseDocument, "name" | "category" | "visibility">,
  ) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [visibility, setVisibility] = useState<Visibility>("client");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(caseId, { name, category, visibility });
    setName("");
    setCategory("General");
    setVisibility("client");
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="section-title">
        <h3>Documento</h3>
        <Upload size={17} />
      </div>
      <div className="form-grid">
        <div className="field full">
          <label htmlFor="document-file">Archivo</label>
          <label className="file-picker">
            <Upload size={16} />
            <span>{name || "Seleccionar archivo"}</span>
            <input
              data-testid="document-file"
              id="document-file"
              onChange={(event) => setName(event.target.files?.[0]?.name ?? "")}
              type="file"
            />
          </label>
        </div>
        <div className="field">
          <label htmlFor="document-name">Nombre</label>
          <input
            data-testid="document-name"
            id="document-name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </div>
        <div className="field">
          <label htmlFor="document-category">Categoria</label>
          <input
            data-testid="document-category"
            id="document-category"
            onChange={(event) => setCategory(event.target.value)}
            required
            value={category}
          />
        </div>
        <div className="field">
          <label htmlFor="document-visibility">Visibilidad</label>
          <select
            data-testid="document-visibility"
            id="document-visibility"
            onChange={(event) => setVisibility(event.target.value as Visibility)}
            value={visibility}
          >
            <option value="client">Cliente</option>
            <option value="internal">Interno</option>
          </select>
        </div>
        <div className="field">
          <label>&nbsp;</label>
          <button className="secondary-button" data-testid="register-document" type="submit">
            <Upload size={16} />
            Registrar
          </button>
        </div>
      </div>
    </form>
  );
}

function ClientDrawer({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: Pick<Client, "name" | "contactName" | "email" | "phone">) => void;
}) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ name, contactName, email, phone });
  }

  return (
    <Modal title="Nuevo cliente" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="client-name">Nombre</label>
          <input
            id="client-name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </div>
        <div className="field">
          <label htmlFor="client-contact">Contacto</label>
          <input
            id="client-contact"
            onChange={(event) => setContactName(event.target.value)}
            required
            value={contactName}
          />
        </div>
        <div className="field">
          <label htmlFor="client-email">Correo</label>
          <input
            id="client-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div className="field">
          <label htmlFor="client-phone">Telefono</label>
          <input id="client-phone" onChange={(event) => setPhone(event.target.value)} value={phone} />
        </div>
        <div className="field full">
          <button className="primary-button" type="submit">
            <Save size={16} />
            Guardar cliente
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CaseDrawer({
  clients,
  defaultClientId,
  onClose,
  onSubmit,
}: {
  clients: Client[];
  defaultClientId: string;
  onClose: () => void;
  onSubmit: (
    input: Pick<
      LegalCase,
      "clientId" | "title" | "description" | "responsible" | "nextStep" | "priority"
    >,
  ) => void;
}) {
  const [clientId, setClientId] = useState(defaultClientId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState(lawyers[0]);
  const [nextStep, setNextStep] = useState("");
  const [priority, setPriority] = useState<LegalCase["priority"]>("normal");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ clientId, title, description, responsible, nextStep, priority });
  }

  return (
    <Modal title="Nuevo caso" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="case-client">Cliente</label>
          <select
            id="case-client"
            onChange={(event) => setClientId(event.target.value)}
            required
            value={clientId}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="case-responsible">Responsable</label>
          <select
            id="case-responsible"
            onChange={(event) => setResponsible(event.target.value)}
            value={responsible}
          >
            {lawyers.map((lawyer) => (
              <option key={lawyer} value={lawyer}>
                {lawyer}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label htmlFor="case-title">Titulo</label>
          <input
            id="case-title"
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </div>
        <div className="field full">
          <label htmlFor="case-description">Descripcion</label>
          <textarea
            id="case-description"
            onChange={(event) => setDescription(event.target.value)}
            required
            value={description}
          />
        </div>
        <div className="field">
          <label htmlFor="case-priority-new">Prioridad</label>
          <select
            id="case-priority-new"
            onChange={(event) => setPriority(event.target.value as LegalCase["priority"])}
            value={priority}
          >
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
          </select>
        </div>
        <div className="field full">
          <label htmlFor="case-next-step-new">Proximo paso</label>
          <textarea
            id="case-next-step-new"
            onChange={(event) => setNextStep(event.target.value)}
            required
            value={nextStep}
          />
        </div>
        <div className="field full">
          <button className="primary-button" data-testid="create-case" type="submit">
            <Save size={16} />
            Guardar caso
          </button>
        </div>
      </form>
    </Modal>
  );
}
