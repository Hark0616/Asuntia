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
        "firms",
        "profiles",
        "requests",
      ]),
    );
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
        "requests_case_id_idx",
      ]),
    );
  });
});
