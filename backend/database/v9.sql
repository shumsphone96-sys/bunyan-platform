ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE project_expenses DROP CONSTRAINT IF EXISTS project_expenses_status_check;
ALTER TABLE project_expenses ADD CONSTRAINT project_expenses_status_check CHECK (status IN ('pending','verified','rejected'));
CREATE INDEX IF NOT EXISTS idx_expenses_status_created ON project_expenses(status,created_at DESC);
