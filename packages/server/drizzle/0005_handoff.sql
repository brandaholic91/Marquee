ALTER TABLE briefs ADD COLUMN parent_deliverable_id TEXT REFERENCES deliverables(id) ON DELETE SET NULL;
CREATE INDEX idx_briefs_parent_deliverable ON briefs(parent_deliverable_id);
