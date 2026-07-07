import "server-only";

import type { PGlite } from "@electric-sql/pglite";
import { seedData } from "@/lib/seed";
import type {
  AuditEvent,
  CaseDocument,
  CaseMilestone,
  CaseUpdate,
  Client,
  InfoRequest,
  LegalCase,
  WorkspaceData,
} from "@/lib/types";
import { getDatabase } from "./db";

const DEFAULT_FIRM_ID = "firm-demo";

async function ensureDefaultFirm(db: PGlite) {
  await db.query(
    `
      INSERT INTO firms (id, name, created_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `,
    [DEFAULT_FIRM_ID, "Asuntia Demo", "2026-07-04T08:00:00.000Z"],
  );

  await db.query(
    `
      INSERT INTO profiles (id, firm_id, email, name, role, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      "profile-demo-admin",
      DEFAULT_FIRM_ID,
      "equipo@asuntia.local",
      "Equipo Asuntia",
      "admin",
      "2026-07-04T08:00:00.000Z",
    ],
  );
}

async function seedIfEmpty(db: PGlite) {
  await ensureDefaultFirm(db);
  const result = await db.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM clients WHERE firm_id = $1",
    [DEFAULT_FIRM_ID],
  );

  if (Number(result.rows[0]?.count ?? 0) === 0) {
    await replaceWorkspace(seedData);
  }
}

function nullable<T>(value: T | null | undefined) {
  return value ?? null;
}

export async function loadWorkspaceFromDatabase(): Promise<WorkspaceData> {
  const db = await getDatabase();
  await seedIfEmpty(db);

  const [clients, cases, milestones, updates, requests, documents, audit] = await Promise.all([
    db.query<Client & { phone: string | null; notes: string | null }>(
      `
        SELECT
          id,
          name,
          contact_name AS "contactName",
          email,
          phone,
          notes,
          created_at::text AS "createdAt"
        FROM clients
        WHERE firm_id = $1
        ORDER BY created_at ASC
      `,
      [DEFAULT_FIRM_ID],
    ),
    db.query<LegalCase>(
      `
        SELECT
          id,
          client_id AS "clientId",
          tracking_code AS "trackingCode",
          title,
          description,
          status,
          priority,
          responsible,
          next_step AS "nextStep",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM cases
        WHERE firm_id = $1
        ORDER BY created_at ASC
      `,
      [DEFAULT_FIRM_ID],
    ),
    db.query<CaseMilestone>(
      `
        SELECT
          id,
          case_id AS "caseId",
          title,
          description,
          detail,
          date::text AS date,
          status,
          evidence_enabled AS "evidenceEnabled"
        FROM case_milestones
        ORDER BY date ASC
      `,
    ),
    db.query<CaseUpdate>(
      `
        SELECT
          id,
          case_id AS "caseId",
          author,
          body,
          visibility,
          created_at::text AS "createdAt"
        FROM case_updates
        ORDER BY created_at ASC
      `,
    ),
    db.query<InfoRequest>(
      `
        SELECT
          id,
          case_id AS "caseId",
          title,
          detail,
          owner,
          due_date::text AS "dueDate",
          status,
          created_at::text AS "createdAt"
        FROM requests
        ORDER BY created_at ASC
      `,
    ),
    db.query<CaseDocument & { milestoneId: string | null }>(
      `
        SELECT
          id,
          case_id AS "caseId",
          milestone_id AS "milestoneId",
          name,
          category,
          visibility,
          status,
          uploaded_at::text AS "uploadedAt"
        FROM documents
        ORDER BY uploaded_at ASC
      `,
    ),
    db.query<AuditEvent>(
      `
        SELECT
          id,
          actor,
          action,
          target,
          created_at::text AS "createdAt"
        FROM audit_events
        WHERE firm_id = $1
        ORDER BY created_at ASC
      `,
      [DEFAULT_FIRM_ID],
    ),
  ]);

  return {
    clients: clients.rows.map((client) => ({
      ...client,
      phone: client.phone ?? undefined,
      notes: client.notes ?? undefined,
    })),
    cases: cases.rows,
    milestones: milestones.rows,
    updates: updates.rows,
    requests: requests.rows,
    documents: documents.rows.map((document) => ({
      ...document,
      milestoneId: document.milestoneId ?? undefined,
    })),
    audit: audit.rows,
  };
}

export async function replaceWorkspace(data: WorkspaceData): Promise<WorkspaceData> {
  const db = await getDatabase();

  await db.exec("BEGIN");
  try {
    await ensureDefaultFirm(db);

    await db.exec(`
      DELETE FROM audit_events WHERE firm_id = '${DEFAULT_FIRM_ID}';
      DELETE FROM documents;
      DELETE FROM requests;
      DELETE FROM case_updates;
      DELETE FROM case_milestones;
      DELETE FROM cases WHERE firm_id = '${DEFAULT_FIRM_ID}';
      DELETE FROM clients WHERE firm_id = '${DEFAULT_FIRM_ID}';
    `);

    for (const client of data.clients) {
      await db.query(
        `
          INSERT INTO clients (id, firm_id, name, contact_name, email, phone, notes, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          client.id,
          DEFAULT_FIRM_ID,
          client.name,
          client.contactName,
          client.email,
          nullable(client.phone),
          nullable(client.notes),
          client.createdAt,
        ],
      );
    }

    for (const legalCase of data.cases) {
      await db.query(
        `
          INSERT INTO cases (
            id,
            firm_id,
            client_id,
            tracking_code,
            title,
            description,
            status,
            priority,
            responsible,
            next_step,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `,
        [
          legalCase.id,
          DEFAULT_FIRM_ID,
          legalCase.clientId,
          legalCase.trackingCode,
          legalCase.title,
          legalCase.description,
          legalCase.status,
          legalCase.priority,
          legalCase.responsible,
          legalCase.nextStep,
          legalCase.createdAt,
          legalCase.updatedAt,
        ],
      );
    }

    for (const milestone of data.milestones) {
      await db.query(
        `
          INSERT INTO case_milestones (
            id,
            case_id,
            title,
            description,
            detail,
            date,
            status,
            evidence_enabled
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          milestone.id,
          milestone.caseId,
          milestone.title,
          milestone.description,
          milestone.detail,
          milestone.date,
          milestone.status,
          milestone.evidenceEnabled,
        ],
      );
    }

    for (const update of data.updates) {
      await db.query(
        `
          INSERT INTO case_updates (id, case_id, author, body, visibility, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          update.id,
          update.caseId,
          update.author,
          update.body,
          update.visibility,
          update.createdAt,
        ],
      );
    }

    for (const request of data.requests) {
      await db.query(
        `
          INSERT INTO requests (id, case_id, title, detail, owner, due_date, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          request.id,
          request.caseId,
          request.title,
          request.detail,
          request.owner,
          request.dueDate,
          request.status,
          request.createdAt,
        ],
      );
    }

    for (const document of data.documents) {
      await db.query(
        `
          INSERT INTO documents (
            id,
            case_id,
            milestone_id,
            name,
            category,
            visibility,
            status,
            uploaded_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          document.id,
          document.caseId,
          nullable(document.milestoneId),
          document.name,
          document.category,
          document.visibility,
          document.status,
          document.uploadedAt,
        ],
      );
    }

    for (const event of data.audit) {
      await db.query(
        `
          INSERT INTO audit_events (id, firm_id, actor, action, target, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          event.id,
          DEFAULT_FIRM_ID,
          event.actor,
          event.action,
          event.target,
          event.createdAt,
        ],
      );
    }

    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }

  return loadWorkspaceFromDatabase();
}

export async function resetWorkspaceDatabase() {
  return replaceWorkspace(seedData);
}
