import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
let db: PGlite | undefined;

async function applySupabaseMigrations() {
  db = new PGlite();
  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await db.exec(sql);
  }

  return db;
}

afterEach(async () => {
  await db?.close();
  db = undefined;
});

describe("Supabase migrations on PGlite", () => {
  test("create the local schema expected by the workspace repository", async () => {
    const database = await applySupabaseMigrations();

    const tables = await database.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    expect(tables.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        "audit_events",
        "case_milestones",
        "case_updates",
        "cases",
        "clients",
        "documents",
        "firm_case_studies",
        "firm_guides",
        "firm_practice_areas",
        "firm_public_sites",
        "firm_value_props",
        "firms",
        "profiles",
        "requests",
      ]),
    );
  });

  test("extends firms and keeps public content scoped by firm and slug", async () => {
    const database = await applySupabaseMigrations();

    const columns = await database.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'firms'
      ORDER BY column_name
    `);

    expect(columns.rows.map((row) => row.column_name)).toEqual(
      expect.arrayContaining([
        "contact_email",
        "contact_phone",
        "slug",
        "specialty",
        "subdomain",
      ]),
    );

    await database.query(
      `
        INSERT INTO firms (
          id,
          name,
          slug,
          subdomain,
          specialty,
          contact_email,
          created_at
        )
        VALUES (
          'firm-public',
          'Firma Publica',
          'firma-publica',
          'publica',
          'Insolvencia',
          'publica@example.com',
          '2026-07-01T00:00:00.000Z'
        )
      `,
    );
    await database.query(
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
        VALUES (
          'site-public',
          'firm-public',
          'Insolvencia con orden',
          'Subtitulo',
          'Resumen',
          'Confianza',
          'Valoracion',
          'Consulta tu caso',
          '/tenant-assets/insolvencia-hero.svg',
          'published',
          '2026-07-01T00:00:00.000Z'
        )
      `,
    );
    await database.query(
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
        VALUES (
          'area-public',
          'firm-public',
          'empresa',
          'Empresa',
          'Resumen',
          'Empresas',
          10
        )
      `,
    );
    await database.query(
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
        VALUES (
          'guide-public',
          'firm-public',
          'area-public',
          'preparacion',
          'Preparacion',
          'Resumen',
          'Contenido',
          3,
          'published',
          10,
          '2026-07-01T00:00:00.000Z'
        )
      `,
    );

    await expect(
      database.query(
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
            sort_order
          )
          VALUES (
            'guide-duplicate',
            'firm-public',
            'area-public',
            'preparacion',
            'Preparacion duplicada',
            'Resumen',
            'Contenido',
            2,
            'published',
            20
          )
        `,
      ),
    ).rejects.toThrow();

    await expect(
      database.query(
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
            sort_order
          )
          VALUES (
            'guide-invalid-status',
            'firm-public',
            'area-public',
            'estado-invalido',
            'Estado invalido',
            'Resumen',
            'Contenido',
            2,
            'archived',
            30
          )
        `,
      ),
    ).rejects.toThrow();

    await expect(
      database.query(
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
          VALUES (
            'case-study-invalid-area',
            'firm-public',
            'area-missing',
            'area-missing',
            'Area faltante',
            'Escenario',
            'Enfoque',
            'Resultado',
            'Anonimizado',
            10
          )
        `,
      ),
    ).rejects.toThrow();
  });

  test("keeps client visibility and case status as database-level constraints", async () => {
    const database = await applySupabaseMigrations();

    await database.query(
      `
        INSERT INTO firms (id, name, created_at)
        VALUES ('firm-test', 'Firma Test', '2026-07-01T00:00:00.000Z')
      `,
    );
    await database.query(
      `
        INSERT INTO clients (id, firm_id, name, contact_name, email, created_at)
        VALUES ('client-test', 'firm-test', 'Cliente Test', 'Laura Mejia', 'laura@example.com', '2026-07-01T00:00:00.000Z')
      `,
    );

    await expect(
      database.query(
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
          VALUES (
            'case-invalid',
            'firm-test',
            'client-test',
            'AS-INVALID',
            'Caso invalido',
            'Debe fallar',
            'estado_libre',
            'normal',
            'Daniela Torres',
            'Revisar',
            '2026-07-01T00:00:00.000Z',
            '2026-07-01T00:00:00.000Z'
          )
        `,
      ),
    ).rejects.toThrow();
  });

  test("keeps profile roles, status and firm email uniqueness as database-level constraints", async () => {
    const database = await applySupabaseMigrations();

    await database.query(
      `
        INSERT INTO firms (id, name, created_at)
        VALUES ('firm-test', 'Firma Test', '2026-07-01T00:00:00.000Z')
      `,
    );
    await database.query(
      `
        INSERT INTO profiles (id, firm_id, email, name, role, status, created_at)
        VALUES (
          'profile-admin',
          'firm-test',
          'admin@example.com',
          'Admin Test',
          'admin',
          'active',
          '2026-07-01T00:00:00.000Z'
        )
      `,
    );

    await expect(
      database.query(
        `
          INSERT INTO profiles (id, firm_id, email, name, role, status, created_at)
          VALUES (
            'profile-invalid-role',
            'firm-test',
            'rol@example.com',
            'Rol Invalido',
            'superuser',
            'active',
            '2026-07-01T00:00:00.000Z'
          )
        `,
      ),
    ).rejects.toThrow();

    await expect(
      database.query(
        `
          INSERT INTO profiles (id, firm_id, email, name, role, status, created_at)
          VALUES (
            'profile-invalid-status',
            'firm-test',
            'estado@example.com',
            'Estado Invalido',
            'lawyer',
            'pending',
            '2026-07-01T00:00:00.000Z'
          )
        `,
      ),
    ).rejects.toThrow();

    await expect(
      database.query(
        `
          INSERT INTO profiles (id, firm_id, email, name, role, status, created_at)
          VALUES (
            'profile-duplicate-email',
            'firm-test',
            'ADMIN@example.com',
            'Admin Duplicado',
            'lawyer',
            'active',
            '2026-07-01T00:00:00.000Z'
          )
        `,
      ),
    ).rejects.toThrow();
  });

  test("prevents more than one current milestone per case", async () => {
    const database = await applySupabaseMigrations();

    await database.query(
      `
        INSERT INTO firms (id, name, created_at)
        VALUES ('firm-test', 'Firma Test', '2026-07-01T00:00:00.000Z')
      `,
    );
    await database.query(
      `
        INSERT INTO clients (id, firm_id, name, contact_name, email, created_at)
        VALUES ('client-test', 'firm-test', 'Cliente Test', 'Laura Mejia', 'laura@example.com', '2026-07-01T00:00:00.000Z')
      `,
    );
    await database.query(
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
        VALUES (
          'case-test',
          'firm-test',
          'client-test',
          'AS-TEST',
          'Caso test',
          'Caso para hitos',
          'en_curso',
          'normal',
          'Daniela Torres',
          'Revisar',
          '2026-07-01T00:00:00.000Z',
          '2026-07-01T00:00:00.000Z'
        )
      `,
    );
    await database.query(
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
        VALUES (
          'milestone-current-1',
          'case-test',
          'Revision',
          'Revision inicial',
          'Detalle',
          '2026-07-02',
          'current',
          false
        )
      `,
    );

    await expect(
      database.query(
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
          VALUES (
            'milestone-current-2',
            'case-test',
            'Radicacion',
            'Radicacion actual',
            'Detalle',
            '2026-07-03',
            'current',
            false
          )
        `,
      ),
    ).rejects.toThrow();
  });

  test("creates indexes for the relations used by case, client and document lookups", async () => {
    const database = await applySupabaseMigrations();

    const indexes = await database.query<{ indexname: string }>(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY indexname
    `);

    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "audit_events_firm_id_idx",
        "case_milestones_case_id_idx",
        "case_milestones_single_current_idx",
        "case_updates_case_id_idx",
        "cases_client_id_idx",
        "cases_firm_id_idx",
        "clients_firm_id_idx",
        "documents_case_id_idx",
        "firm_case_studies_firm_id_idx",
        "firm_case_studies_practice_area_id_idx",
        "firm_guides_firm_id_idx",
        "firm_guides_practice_area_id_idx",
        "firm_practice_areas_firm_id_idx",
        "firm_public_sites_firm_id_idx",
        "firm_value_props_firm_id_idx",
        "firms_slug_idx",
        "firms_subdomain_idx",
        "profiles_client_id_idx",
        "profiles_firm_email_idx",
        "profiles_firm_id_idx",
        "profiles_role_idx",
        "requests_case_id_idx",
      ]),
    );
  });
});
