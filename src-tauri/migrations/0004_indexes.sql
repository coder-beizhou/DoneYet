CREATE INDEX IF NOT EXISTS idx_todos_note ON todos(note_id);
CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_date) WHERE due_date IS NOT NULL;
