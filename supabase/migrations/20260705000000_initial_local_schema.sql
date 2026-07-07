CREATE TABLE IF NOT EXISTS firms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tracking_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('nuevo', 'en_curso', 'requiere_cliente', 'en_espera', 'finalizado')),
  priority TEXT NOT NULL CHECK (priority IN ('normal', 'alta')),
  responsible TEXT NOT NULL,
  next_step TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS case_milestones (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  detail TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'current', 'upcoming')),
  evidence_enabled BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS case_updates (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('internal', 'client')),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  owner TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pendiente', 'en_progreso', 'recibida', 'requiere_correccion', 'aceptada', 'vencida')
  ),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  milestone_id TEXT REFERENCES case_milestones(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('internal', 'client')),
  status TEXT NOT NULL CHECK (status IN ('recibido', 'en_revision', 'aprobado', 'rechazado')),
  uploaded_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS clients_firm_id_idx ON clients(firm_id);
CREATE INDEX IF NOT EXISTS cases_client_id_idx ON cases(client_id);
CREATE INDEX IF NOT EXISTS cases_firm_id_idx ON cases(firm_id);
CREATE INDEX IF NOT EXISTS case_milestones_case_id_idx ON case_milestones(case_id);
CREATE INDEX IF NOT EXISTS case_updates_case_id_idx ON case_updates(case_id);
CREATE INDEX IF NOT EXISTS requests_case_id_idx ON requests(case_id);
CREATE INDEX IF NOT EXISTS documents_case_id_idx ON documents(case_id);
CREATE INDEX IF NOT EXISTS audit_events_firm_id_idx ON audit_events(firm_id);
