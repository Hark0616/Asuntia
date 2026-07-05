"use client";

import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  History,
  LogIn,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { caseStatusLabels, requestStatusLabels, visibilityLabels } from "@/lib/labels";
import {
  audit,
  cloneSeed,
  createId,
  getTodayIso,
  loadWorkspace,
  saveWorkspace,
} from "@/lib/storage";
import type {
  CaseDocument,
  CaseMilestone,
  CaseStatus,
  CaseUpdate,
  Client,
  InfoRequest,
  LegalCase,
  RequestStatus,
  Visibility,
  WorkspaceData,
} from "@/lib/types";

type Mode = "lawyer" | "client";
type DrawerKind = "client" | "case" | null;

const lawyers = ["Daniela Torres", "Martin Acosta", "Sofia Bernal"];

const caseStatuses = Object.keys(caseStatusLabels) as CaseStatus[];
const requestStatuses = Object.keys(requestStatusLabels) as RequestStatus[];

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

export default function Home() {
  const [data, setData] = useState<WorkspaceData>(() => cloneSeed());
  const [mode, setMode] = useState<Mode>("lawyer");
  const [selectedClientId, setSelectedClientId] = useState("client-1");
  const [selectedCaseId, setSelectedCaseId] = useState("case-1");
  const [trackingCode, setTrackingCode] = useState("");
  const [activeTrackingCaseId, setActiveTrackingCaseId] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [drawer, setDrawer] = useState<DrawerKind>(null);

  useEffect(() => {
    const loaded = loadWorkspace();
    setData(loaded);
    setSelectedClientId(loaded.clients[0]?.id ?? "");
    setSelectedCaseId(loaded.cases[0]?.id ?? "");
  }, []);

  const clientsById = useMemo(() => {
    return new Map(data.clients.map((client) => [client.id, client]));
  }, [data.clients]);

  const selectedClient = clientsById.get(selectedClientId) ?? data.clients[0];
  const selectedCase =
    data.cases.find((legalCase) => legalCase.id === selectedCaseId) ??
    data.cases.find((legalCase) => legalCase.clientId === selectedClient?.id) ??
    data.cases[0];

  const activeTrackingCase = activeTrackingCaseId
    ? data.cases.find((legalCase) => legalCase.id === activeTrackingCaseId)
    : undefined;
  const activeClient = activeTrackingCase
    ? clientsById.get(activeTrackingCase.clientId)
    : undefined;

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

  function commit(next: WorkspaceData) {
    setData(next);
    saveWorkspace(next);
  }

  function resetDemo() {
    const next = cloneSeed();
    commit(next);
    setSelectedClientId(next.clients[0]?.id ?? "");
    setSelectedCaseId(next.cases[0]?.id ?? "");
    setActiveTrackingCaseId(null);
    setTrackingCode("");
    setTrackingError("");
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
    const legalCase = data.cases.find((item) => item.id === caseId);
    if (!legalCase) {
      return;
    }

    commit({
      ...data,
      cases: data.cases.map((item) =>
        item.id === caseId ? { ...item, ...patch, updatedAt: getTodayIso() } : item,
      ),
      audit: [audit("Firma", "Actualizo caso", legalCase.title), ...data.audit],
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

  function openTrackingPortal(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const legalCase = data.cases.find((item) => {
      return item.trackingCode.toUpperCase() === normalizedCode;
    });

    if (!legalCase) {
      setTrackingError("No encontramos un asunto con ese codigo.");
      setActiveTrackingCaseId(null);
      return;
    }

    setTrackingCode(legalCase.trackingCode);
    setActiveTrackingCaseId(legalCase.id);
    setTrackingError("");
  }

  function addDocument(caseId: string, input: Pick<CaseDocument, "name" | "category" | "visibility">) {
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
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <h1>Asuntia</h1>
            <span>Casos, avances y documentos</span>
          </div>
        </div>

        <div className="row wrap">
          <button className="ghost-button" type="button" onClick={resetDemo}>
            <RefreshCcw size={16} />
            Reiniciar
          </button>
          <div className="mode-switch" aria-label="Modo de acceso">
            <button
              className={mode === "lawyer" ? "active" : ""}
              data-testid="mode-lawyer"
              type="button"
              onClick={() => setMode("lawyer")}
            >
              <BriefcaseBusiness size={16} />
              Firma
            </button>
            <button
              className={mode === "client" ? "active" : ""}
              data-testid="mode-client"
              type="button"
              onClick={() => setMode("client")}
            >
              <UserRound size={16} />
              Cliente
            </button>
          </div>
        </div>
      </header>

      {mode === "lawyer" ? (
        <LawyerWorkspace
          activeCase={selectedCase}
          activeClient={selectedClient}
          caseDocuments={caseDocuments}
          caseRequests={caseRequests}
          clients={data.clients}
          metrics={metrics}
          onAddDocument={addDocument}
          onAddRequest={addRequest}
          onAddUpdate={addUpdate}
          onClientSelect={handleClientSelect}
          onCaseSelect={setSelectedCaseId}
          onDrawer={setDrawer}
          onRequestStatus={updateRequestStatus}
          onUpdateCase={updateCaseFields}
          selectedClientCases={selectedClientCases}
          selectedClientId={selectedClientId}
          updates={visibleUpdates}
        />
      ) : (
        <ClientWorkspace
          activeClient={activeClient}
          activeCase={activeTrackingCase}
          caseMilestones={caseMilestones}
          caseDocuments={caseDocuments}
          caseRequests={caseRequests}
          trackingCode={trackingCode}
          trackingError={trackingError}
          onAddEvidence={addClientEvidence}
          onExit={() => setActiveTrackingCaseId(null)}
          onOpenTracking={openTrackingPortal}
          onTrackingCode={setTrackingCode}
          updates={visibleUpdates}
        />
      )}

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

function LawyerWorkspace({
  activeCase,
  activeClient,
  caseDocuments,
  caseRequests,
  clients,
  metrics,
  onAddDocument,
  onAddRequest,
  onAddUpdate,
  onCaseSelect,
  onClientSelect,
  onDrawer,
  onRequestStatus,
  onUpdateCase,
  selectedClientCases,
  selectedClientId,
  updates,
}: {
  activeCase?: LegalCase;
  activeClient?: Client;
  caseDocuments: (caseId: string, visibility?: Visibility) => CaseDocument[];
  caseRequests: (caseId: string) => InfoRequest[];
  clients: Client[];
  metrics: { clients: number; openCases: number; clientAction: number; pendingRequests: number };
  onAddDocument: (
    caseId: string,
    input: Pick<CaseDocument, "name" | "category" | "visibility">,
  ) => void;
  onAddRequest: (
    caseId: string,
    input: Omit<InfoRequest, "id" | "caseId" | "createdAt">,
  ) => void;
  onAddUpdate: (caseId: string, body: string, visibility: Visibility) => void;
  onCaseSelect: (caseId: string) => void;
  onClientSelect: (clientId: string) => void;
  onDrawer: (drawer: DrawerKind) => void;
  onRequestStatus: (requestId: string, status: RequestStatus) => void;
  onUpdateCase: (caseId: string, patch: Partial<LegalCase>) => void;
  selectedClientCases: LegalCase[];
  selectedClientId: string;
  updates: (caseId: string, visibility?: Visibility) => CaseUpdate[];
}) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="section-title">
            <h3>Clientes</h3>
            <button className="icon-button" type="button" onClick={() => onDrawer("client")}>
              <Plus size={16} />
            </button>
          </div>

          <div className="stack">
            {clients.map((client) => (
              <button
                className={`client-entry ${client.id === selectedClientId ? "active" : ""}`}
                key={client.id}
                type="button"
                onClick={() => onClientSelect(client.id)}
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
            <h2>{activeClient?.name ?? "Clientes"}</h2>
            <span className="muted">{activeClient?.email ?? "Sin cliente seleccionado"}</span>
          </div>
          <button
            className="primary-button"
            data-testid="open-case-drawer"
            type="button"
            onClick={() => onDrawer("case")}
          >
            <Plus size={16} />
            Nuevo caso
          </button>
        </div>

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
                  active={activeCase?.id === legalCase.id}
                  key={legalCase.id}
                  legalCase={legalCase}
                  onSelect={() => onCaseSelect(legalCase.id)}
                />
              ))}
            </div>
          </section>

          {activeCase ? (
            <CaseDetail
              documents={caseDocuments(activeCase.id)}
              legalCase={activeCase}
              requests={caseRequests(activeCase.id)}
              updates={updates(activeCase.id)}
              onAddDocument={onAddDocument}
              onAddRequest={onAddRequest}
              onAddUpdate={onAddUpdate}
              onRequestStatus={onRequestStatus}
              onUpdateCase={onUpdateCase}
            />
          ) : (
            <div className="empty-state">
              <span className="muted">Sin casos</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ClientWorkspace({
  activeClient,
  activeCase,
  caseMilestones,
  caseDocuments,
  caseRequests,
  trackingCode,
  trackingError,
  onAddEvidence,
  onExit,
  onOpenTracking,
  onTrackingCode,
  updates,
}: {
  activeClient: Client | null | undefined;
  activeCase: LegalCase | undefined;
  caseMilestones: (caseId: string) => CaseMilestone[];
  caseDocuments: (caseId: string, visibility?: Visibility) => CaseDocument[];
  caseRequests: (caseId: string) => InfoRequest[];
  trackingCode: string;
  trackingError: string;
  onAddEvidence: (caseId: string, milestoneId: string, fileName: string) => void;
  onExit: () => void;
  onOpenTracking: (code: string) => void;
  onTrackingCode: (code: string) => void;
  updates: (caseId: string, visibility?: Visibility) => CaseUpdate[];
}) {
  if (!activeCase || !activeClient) {
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

          <form
            className="tracking-form"
            onSubmit={(event) => {
              event.preventDefault();
              onOpenTracking(trackingCode);
            }}
          >
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
            <button
              className="ghost-button"
              type="button"
              onClick={() => onTrackingCode("AS-2026-003")}
            >
              AS-2026-003
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="main tracking-shell">
      <ClientTrackingDetail
        client={activeClient}
        documents={caseDocuments(activeCase.id, "client")}
        legalCase={activeCase}
        milestones={caseMilestones(activeCase.id)}
        requests={caseRequests(activeCase.id)}
        updates={updates(activeCase.id, "client")}
        onAddEvidence={onAddEvidence}
        onExit={onExit}
      />
    </section>
  );
}

function CaseDetail({
  documents,
  legalCase,
  requests,
  updates,
  onAddDocument,
  onAddRequest,
  onAddUpdate,
  onRequestStatus,
  onUpdateCase,
}: {
  documents: CaseDocument[];
  legalCase: LegalCase;
  requests: InfoRequest[];
  updates: CaseUpdate[];
  onAddDocument: (
    caseId: string,
    input: Pick<CaseDocument, "name" | "category" | "visibility">,
  ) => void;
  onAddRequest: (
    caseId: string,
    input: Omit<InfoRequest, "id" | "caseId" | "createdAt">,
  ) => void;
  onAddUpdate: (caseId: string, body: string, visibility: Visibility) => void;
  onRequestStatus: (requestId: string, status: RequestStatus) => void;
  onUpdateCase: (caseId: string, patch: Partial<LegalCase>) => void;
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
            <span className="muted small">Responsable: {legalCase.responsible}</span>
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

      <UpdateComposer caseId={legalCase.id} onSubmit={onAddUpdate} />
      <RequestComposer caseId={legalCase.id} onSubmit={onAddRequest} />
      <DocumentComposer caseId={legalCase.id} onSubmit={onAddDocument} />

      <div className="panel">
        <div className="section-title">
          <h3>Timeline</h3>
          <History size={17} />
        </div>
        <Timeline updates={updates} />
      </div>

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
          <input
            data-testid="document-file"
            id="document-file"
            onChange={(event) => setName(event.target.files?.[0]?.name ?? "")}
            type="file"
          />
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
          <input
            id="client-phone"
            onChange={(event) => setPhone(event.target.value)}
            value={phone}
          />
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

function Modal({
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

function CaseCard({
  active,
  legalCase,
  onSelect,
}: {
  active: boolean;
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

function Timeline({ updates }: { updates: CaseUpdate[] }) {
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

function RequestList({
  editable = false,
  onStatus,
  requests,
}: {
  editable?: boolean;
  onStatus?: (requestId: string, status: RequestStatus) => void;
  requests: InfoRequest[];
}) {
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

function DocumentList({ documents }: { documents: CaseDocument[] }) {
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ status }: { status: CaseStatus }) {
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

function formatDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return dateFormatter.format(new Date(year, month - 1, day));
  }

  return dateFormatter.format(new Date(value));
}

function formatDateTime(value: string) {
  return timeFormatter.format(new Date(value));
}
