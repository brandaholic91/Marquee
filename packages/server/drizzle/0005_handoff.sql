ALTER TABLE briefs ADD COLUMN parent_deliverable_id TEXT REFERENCES deliverables(id) ON DELETE SET NULL;
