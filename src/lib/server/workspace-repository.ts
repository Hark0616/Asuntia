import "server-only";

import type { PGlite } from "@electric-sql/pglite";
import { DEFAULT_FIRM_ID, demoProfiles } from "@/lib/auth";
import { seedData } from "@/lib/seed";
import type {
  AuditEvent,
  CaseDocument,
  CaseMilestone,
  CaseUpdate,
  Client,
  Firm,
  FirmCaseStudy,
  FirmGuide,
  FirmPracticeArea,
  FirmPublicSite,
  FirmValueProp,
  InfoRequest,
  LegalCase,
  Profile,
  WorkspaceData,
} from "@/lib/types";
import { getDatabase } from "./db";

declare global {
  var asuntiaWorkspaceWrite: Promise<unknown> | undefined;
}

async function withWorkspaceWriteLock<T>(operation: () => Promise<T>) {
  const previousWrite = globalThis.asuntiaWorkspaceWrite ?? Promise.resolve();
  const nextWrite = previousWrite.catch(() => undefined).then(operation);
  globalThis.asuntiaWorkspaceWrite = nextWrite.catch(() => undefined);
  return nextWrite;
}

async function ensureDefaultFirm(db: PGlite) {
  const firm = seedData.firms[0] ?? {
    contactEmail: "contacto@asuntia.local",
    contactPhone: "+57 300 000 0000",
    createdAt: "2026-07-04T08:00:00.000Z",
    id: DEFAULT_FIRM_ID,
    name: "Asuntia Insolvencia",
    slug: "asuntia-insolvencia",
    specialty: "Derecho de la insolvencia",
    subdomain: "cliente1",
  };

  await db.query(
    `
      INSERT INTO firms (
        id,
        name,
        slug,
        subdomain,
        specialty,
        contact_email,
        contact_phone,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        subdomain = EXCLUDED.subdomain,
        specialty = EXCLUDED.specialty,
        contact_email = EXCLUDED.contact_email,
        contact_phone = EXCLUDED.contact_phone
    `,
    [
      firm.id,
      firm.name,
      firm.slug,
      firm.subdomain,
      firm.specialty,
      firm.contactEmail,
      nullable(firm.contactPhone),
      firm.createdAt,
    ],
  );
}

async function ensureProfiles(db: PGlite, profiles: Profile[] = demoProfiles) {
  for (const profile of profiles) {
    await db.query(
      `
        INSERT INTO profiles (
          id,
          firm_id,
          client_id,
          email,
          name,
          role,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          firm_id = EXCLUDED.firm_id,
          client_id = EXCLUDED.client_id,
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          status = EXCLUDED.status
      `,
      [
        profile.id,
        profile.firmId,
        nullable(profile.clientId),
        profile.email,
        profile.name,
        profile.role,
        profile.status,
        profile.createdAt,
      ],
    );
  }
}

async function upsertFirms(db: PGlite, firms: Firm[] = seedData.firms) {
  for (const firm of firms) {
    await db.query(
      `
        INSERT INTO firms (
          id,
          name,
          slug,
          subdomain,
          specialty,
          contact_email,
          contact_phone,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          subdomain = EXCLUDED.subdomain,
          specialty = EXCLUDED.specialty,
          contact_email = EXCLUDED.contact_email,
          contact_phone = EXCLUDED.contact_phone
      `,
      [
        firm.id,
        firm.name,
        firm.slug,
        firm.subdomain,
        firm.specialty,
        firm.contactEmail,
        nullable(firm.contactPhone),
        firm.createdAt,
      ],
    );
  }
}

async function insertPublicSites(db: PGlite, publicSites: FirmPublicSite[]) {
  for (const site of publicSites) {
    await db.query(
      `
        INSERT INTO firm_public_sites (
          id,
          firm_id,
          headline,
          subheadline,
          hero_summary,
          trust_statement,
          primary_cta_label,
          secondary_cta_label,
          hero_image_url,
          status,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        site.id,
        site.firmId,
        site.headline,
        site.subheadline,
        site.heroSummary,
        site.trustStatement,
        site.primaryCtaLabel,
        site.secondaryCtaLabel,
        site.heroImageUrl,
        site.status,
        site.updatedAt,
      ],
    );
  }
}

async function insertPracticeAreas(db: PGlite, practiceAreas: FirmPracticeArea[]) {
  for (const area of practiceAreas) {
    await db.query(
      `
        INSERT INTO firm_practice_areas (
          id,
          firm_id,
          slug,
          title,
          summary,
          audience,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        area.id,
        area.firmId,
        area.slug,
        area.title,
        area.summary,
        area.audience,
        area.sortOrder,
      ],
    );
  }
}

async function insertGuides(db: PGlite, guides: FirmGuide[]) {
  for (const guide of guides) {
    await db.query(
      `
        INSERT INTO firm_guides (
          id,
          firm_id,
          practice_area_id,
          slug,
          title,
          summary,
          content,
          reading_minutes,
          status,
          sort_order,
          published_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        guide.id,
        guide.firmId,
        nullable(guide.practiceAreaId),
        guide.slug,
        guide.title,
        guide.summary,
        guide.content,
        guide.readingMinutes,
        guide.status,
        guide.sortOrder,
        nullable(guide.publishedAt),
      ],
    );
  }
}

async function insertCaseStudies(db: PGlite, caseStudies: FirmCaseStudy[]) {
  for (const caseStudy of caseStudies) {
    await db.query(
      `
        INSERT INTO firm_case_studies (
          id,
          firm_id,
          practice_area_id,
          slug,
          title,
          scenario,
          approach,
          outcome_summary,
          disclaimer,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        caseStudy.id,
        caseStudy.firmId,
        nullable(caseStudy.practiceAreaId),
        caseStudy.slug,
        caseStudy.title,
        caseStudy.scenario,
        caseStudy.approach,
        caseStudy.outcomeSummary,
        caseStudy.disclaimer,
        caseStudy.sortOrder,
      ],
    );
  }
}

async function insertValueProps(db: PGlite, valueProps: FirmValueProp[]) {
  for (const valueProp of valueProps) {
    await db.query(
      `
        INSERT INTO firm_value_props (id, firm_id, title, body, sort_order)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        valueProp.id,
        valueProp.firmId,
        valueProp.title,
        valueProp.body,
        valueProp.sortOrder,
      ],
    );
  }
}

async function insertPublicContent(db: PGlite, data: WorkspaceData) {
  await insertPublicSites(db, data.publicSites);
  await insertPracticeAreas(db, data.practiceAreas);
  await insertGuides(db, data.guides);
  await insertCaseStudies(db, data.caseStudies);
  await insertValueProps(db, data.valueProps);
}

async function ensurePublicContent(db: PGlite) {
  const result = await db.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM firm_public_sites WHERE firm_id = $1",
    [DEFAULT_FIRM_ID],
  );

  if (Number(result.rows[0]?.count ?? 0) > 0) {
    return;
  }

  await upsertFirms(db);
  await insertPublicContent(db, seedData);
}

async function seedIfEmpty(db: PGlite) {
  await ensureDefaultFirm(db);
  const result = await db.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM clients WHERE firm_id = $1",
    [DEFAULT_FIRM_ID],
  );

  if (Number(result.rows[0]?.count ?? 0) === 0) {
    await replaceWorkspace(seedData);
    return;
  }

  await db.query("UPDATE profiles SET status = 'inactive' WHERE id = $1", [
    "profile-demo-admin",
  ]);
  await ensureProfiles(db);
  await ensurePublicContent(db);
}

function nullable<T>(value: T | null | undefined) {
  return value ?? null;
}

export async function loadWorkspaceFromDatabase(): Promise<WorkspaceData> {
  const db = await getDatabase();
  await seedIfEmpty(db);

  const [
    firms,
    publicSites,
    practiceAreas,
    guides,
    caseStudies,
    valueProps,
    profiles,
    clients,
    cases,
    milestones,
    updates,
    requests,
    documents,
    audit,
  ] = await Promise.all([
    db.query<Firm & { contactPhone: string | null }>(
      `
        SELECT
          id,
          name,
          slug,
          subdomain,
          specialty,
          contact_email AS "contactEmail",
          contact_phone AS "contactPhone",
          created_at::text AS "createdAt"
        FROM firms
        WHERE id = $1
        ORDER BY created_at ASC
      `,
      [DEFAULT_FIRM_ID],
    ),
    db.query<FirmPublicSite>(
      `
        SELECT
          id,
          firm_id AS "firmId",
          headline,
          subheadline,
          hero_summary AS "heroSummary",
          trust_statement AS "trustStatement",
          primary_cta_label AS "primaryCtaLabel",
          secondary_cta_label AS "secondaryCtaLabel",
          hero_image_url AS "heroImageUrl",
          status,
          updated_at::text AS "updatedAt"
        FROM firm_public_sites
        WHERE firm_id = $1
        ORDER BY updated_at DESC
      `,
      [DEFAULT_FIRM_ID],
    ),
    db.query<FirmPracticeArea>(
      `
        SELECT
          id,
          firm_id AS "firmId",
          slug,
          title,
          summary,
          audience,
          sort_order AS "sortOrder"
        FROM firm_practice_areas
        WHERE firm_id = $1
        ORDER BY sort_order ASC, title ASC
      `,
      [DEFAULT_FIRM_ID],
    ),
    db.query<FirmGuide & { practiceAreaId: string | null; publishedAt: string | null }>(
      `
        SELECT
          id,
          firm_id AS "firmId",
          practice_area_id AS "practiceAreaId",
          slug,
          title,
          summary,
          content,
          reading_minutes AS "readingMinutes",
          status,
          sort_order AS "sortOrder",
          published_at::text AS "publishedAt"
        FROM firm_guides
        WHERE firm_id = $1
        ORDER BY sort_order ASC, title ASC
      `,
      [DEFAULT_FIRM_ID],
    ),
    db.query<FirmCaseStudy & { practiceAreaId: string | null }>(
      `
        SELECT
          id,
          firm_id AS "firmId",
          practice_area_id AS "practiceAreaId",
          slug,
          title,
          scenario,
          approach,
          outcome_summary AS "outcomeSummary",
          disclaimer,
          sort_order AS "sortOrder"
        FROM firm_case_studies
        WHERE firm_id = $1
        ORDER BY sort_order ASC, title ASC
      `,
      [DEFAULT_FIRM_ID],
    ),
    db.query<FirmValueProp>(
      `
        SELECT
          id,
          firm_id AS "firmId",
          title,
          body,
          sort_order AS "sortOrder"
        FROM firm_value_props
        WHERE firm_id = $1
        ORDER BY sort_order ASC, title ASC
      `,
      [DEFAULT_FIRM_ID],
    ),
    db.query<Profile & { clientId: string | null }>(
      `
        SELECT
          id,
          firm_id AS "firmId",
          client_id AS "clientId",
          email,
          name,
          role,
          status,
          created_at::text AS "createdAt"
        FROM profiles
        WHERE firm_id = $1
        ORDER BY created_at ASC
      `,
      [DEFAULT_FIRM_ID],
    ),
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
    firms: firms.rows.map((firm) => ({
      ...firm,
      contactPhone: firm.contactPhone ?? undefined,
    })),
    publicSites: publicSites.rows,
    practiceAreas: practiceAreas.rows,
    guides: guides.rows.map((guide) => ({
      ...guide,
      practiceAreaId: guide.practiceAreaId ?? undefined,
      publishedAt: guide.publishedAt ?? undefined,
    })),
    caseStudies: caseStudies.rows.map((caseStudy) => ({
      ...caseStudy,
      practiceAreaId: caseStudy.practiceAreaId ?? undefined,
    })),
    valueProps: valueProps.rows,
    profiles: profiles.rows.map((profile) => ({
      ...profile,
      clientId: profile.clientId ?? undefined,
    })),
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
  return withWorkspaceWriteLock(async () => {
    const db = await getDatabase();
    const nextData: WorkspaceData = {
      ...data,
      audit: data.audit ?? seedData.audit,
      caseStudies: data.caseStudies ?? seedData.caseStudies,
      cases: data.cases ?? seedData.cases,
      clients: data.clients ?? seedData.clients,
      documents: data.documents ?? seedData.documents,
      firms: data.firms?.length ? data.firms : seedData.firms,
      guides: data.guides ?? seedData.guides,
      milestones: data.milestones ?? seedData.milestones,
      practiceAreas: data.practiceAreas ?? seedData.practiceAreas,
      profiles: data.profiles ?? demoProfiles,
      publicSites: data.publicSites ?? seedData.publicSites,
      requests: data.requests ?? seedData.requests,
      updates: data.updates ?? seedData.updates,
      valueProps: data.valueProps ?? seedData.valueProps,
    };

    await db.exec("BEGIN");
    try {
      await ensureDefaultFirm(db);

      await db.exec(`
        DELETE FROM firm_value_props WHERE firm_id = '${DEFAULT_FIRM_ID}';
        DELETE FROM firm_case_studies WHERE firm_id = '${DEFAULT_FIRM_ID}';
        DELETE FROM firm_guides WHERE firm_id = '${DEFAULT_FIRM_ID}';
        DELETE FROM firm_practice_areas WHERE firm_id = '${DEFAULT_FIRM_ID}';
        DELETE FROM firm_public_sites WHERE firm_id = '${DEFAULT_FIRM_ID}';
        DELETE FROM audit_events WHERE firm_id = '${DEFAULT_FIRM_ID}';
        DELETE FROM documents;
        DELETE FROM requests;
        DELETE FROM case_updates;
        DELETE FROM case_milestones;
        DELETE FROM cases WHERE firm_id = '${DEFAULT_FIRM_ID}';
        DELETE FROM clients WHERE firm_id = '${DEFAULT_FIRM_ID}';
        DELETE FROM profiles WHERE firm_id = '${DEFAULT_FIRM_ID}';
      `);

      await upsertFirms(db, nextData.firms);
      await insertPublicContent(db, nextData);

      for (const client of nextData.clients) {
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

      for (const legalCase of nextData.cases) {
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

      for (const milestone of nextData.milestones) {
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

      for (const update of nextData.updates) {
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

      for (const request of nextData.requests) {
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

      for (const document of nextData.documents) {
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

      for (const event of nextData.audit) {
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

      await ensureProfiles(db, nextData.profiles);

      await db.exec("COMMIT");
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }

    return loadWorkspaceFromDatabase();
  });
}

export async function resetWorkspaceDatabase() {
  return replaceWorkspace(seedData);
}
