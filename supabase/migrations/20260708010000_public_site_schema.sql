ALTER TABLE firms
ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE firms
ADD COLUMN IF NOT EXISTS subdomain TEXT;

ALTER TABLE firms
ADD COLUMN IF NOT EXISTS specialty TEXT;

ALTER TABLE firms
ADD COLUMN IF NOT EXISTS contact_email TEXT;

ALTER TABLE firms
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

UPDATE firms
SET
  slug = COALESCE(slug, 'asuntia-insolvencia'),
  subdomain = COALESCE(subdomain, 'cliente1'),
  specialty = COALESCE(specialty, 'Derecho de la insolvencia'),
  contact_email = COALESCE(contact_email, 'contacto@asuntia.local'),
  contact_phone = COALESCE(contact_phone, '+57 300 000 0000')
WHERE id = 'firm-demo';

CREATE UNIQUE INDEX IF NOT EXISTS firms_slug_idx ON firms(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS firms_subdomain_idx ON firms(subdomain) WHERE subdomain IS NOT NULL;

CREATE TABLE IF NOT EXISTS firm_public_sites (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL UNIQUE REFERENCES firms(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  subheadline TEXT NOT NULL,
  hero_summary TEXT NOT NULL,
  trust_statement TEXT NOT NULL,
  primary_cta_label TEXT NOT NULL,
  secondary_cta_label TEXT NOT NULL,
  hero_image_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS firm_practice_areas (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  audience TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (firm_id, slug)
);

CREATE TABLE IF NOT EXISTS firm_guides (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  practice_area_id TEXT REFERENCES firm_practice_areas(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  reading_minutes INTEGER NOT NULL CHECK (reading_minutes > 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  UNIQUE (firm_id, slug)
);

CREATE TABLE IF NOT EXISTS firm_case_studies (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  practice_area_id TEXT REFERENCES firm_practice_areas(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  scenario TEXT NOT NULL,
  approach TEXT NOT NULL,
  outcome_summary TEXT NOT NULL,
  disclaimer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (firm_id, slug)
);

CREATE TABLE IF NOT EXISTS firm_value_props (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS firm_public_sites_firm_id_idx ON firm_public_sites(firm_id);
CREATE INDEX IF NOT EXISTS firm_practice_areas_firm_id_idx ON firm_practice_areas(firm_id);
CREATE INDEX IF NOT EXISTS firm_guides_firm_id_idx ON firm_guides(firm_id);
CREATE INDEX IF NOT EXISTS firm_guides_practice_area_id_idx ON firm_guides(practice_area_id);
CREATE INDEX IF NOT EXISTS firm_case_studies_firm_id_idx ON firm_case_studies(firm_id);
CREATE INDEX IF NOT EXISTS firm_case_studies_practice_area_id_idx ON firm_case_studies(practice_area_id);
CREATE INDEX IF NOT EXISTS firm_value_props_firm_id_idx ON firm_value_props(firm_id);
