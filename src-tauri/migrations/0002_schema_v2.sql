CREATE TABLE todos_new (id TEXT PRIMARY KEY, note_id TEXT REFERENCES sticky_notes(id) ON DELETE SET NULL, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0, done_at TEXT, sort_order INTEGER NOT NULL DEFAULT 0, due_date TEXT, created_at TEXT NOT NULL);
INSERT INTO todos_new (id, note_id, title, content, done, done_at, sort_order, due_date, created_at) SELECT id, note_id, title, '' AS content, done, done_at, sort_order, due_date, created_at FROM todos;
DROP TABLE todos;
ALTER TABLE todos_new RENAME TO todos;
ALTER TABLE sticky_notes ADD COLUMN date TEXT;
