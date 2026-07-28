ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude numeric(9,6);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude numeric(9,6);

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_latitude_range;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_longitude_range;
ALTER TABLE projects ADD CONSTRAINT projects_latitude_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
ALTER TABLE projects ADD CONSTRAINT projects_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

CREATE INDEX IF NOT EXISTS idx_projects_coordinates ON projects(latitude,longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
