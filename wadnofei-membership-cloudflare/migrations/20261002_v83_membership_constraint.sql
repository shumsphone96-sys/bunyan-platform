-- Wad Nofei V83 canonical membership constraint.
-- Safe additive migration. Does not delete or rewrite member/application rows.
-- Apply only after verifying there are no duplicate non-null application_id values.

CREATE UNIQUE INDEX IF NOT EXISTS wdn_one_member_per_application
  ON members(application_id)
  WHERE application_id IS NOT NULL;
