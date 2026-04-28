CREATE TABLE IF NOT EXISTS employee_teams (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_teams_unique_company_name UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS employee_teams_company_idx
  ON employee_teams (company_id);

CREATE TABLE IF NOT EXISTS employee_team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES employee_teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_team_members_unique_team_user UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS employee_team_members_team_idx
  ON employee_team_members (team_id);

CREATE INDEX IF NOT EXISTS employee_team_members_user_idx
  ON employee_team_members (user_id);
