CREATE UNIQUE INDEX IF NOT EXISTS case_milestones_single_current_idx
ON case_milestones(case_id)
WHERE status = 'current';
