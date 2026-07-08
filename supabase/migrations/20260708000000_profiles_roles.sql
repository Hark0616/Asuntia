ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('owner', 'admin', 'lawyer', 'assistant', 'client'));

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_status_check
CHECK (status IN ('active', 'inactive'));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_firm_email_idx
ON profiles(firm_id, lower(email));

CREATE INDEX IF NOT EXISTS profiles_firm_id_idx ON profiles(firm_id);
CREATE INDEX IF NOT EXISTS profiles_client_id_idx ON profiles(client_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);
