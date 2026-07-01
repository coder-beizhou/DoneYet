-- 上上签 初始化 schema (M1: 全表一次建好,后续里程碑只加命令不加迁移)
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sticky_notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content_md TEXT NOT NULL DEFAULT '',
  content_json TEXT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  color TEXT NOT NULL DEFAULT '#2a2a2e',
  is_pinned_desktop INTEGER NOT NULL DEFAULT 0,
  is_always_on_top INTEGER NOT NULL DEFAULT 0,
  x REAL,
  y REAL,
  w REAL,
  h REAL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_category ON sticky_notes(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_updated ON sticky_notes(updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON sticky_notes(is_pinned_desktop) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repeats (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  interval INTEGER NOT NULL DEFAULT 1,
  days_of_week TEXT,
  until_date TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  note_id TEXT REFERENCES sticky_notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  fire_at TEXT NOT NULL,
  repeat_rule_id TEXT REFERENCES repeats(id) ON DELETE SET NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_fired_at TEXT,
  next_fire_at TEXT,
  sound TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_next ON reminders(next_fire_at) WHERE enabled=1;

CREATE TABLE IF NOT EXISTS history_versions (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content_md TEXT NOT NULL DEFAULT '',
  content_json TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto'
);

CREATE INDEX IF NOT EXISTS idx_history_note ON history_versions(note_id, created_at DESC);

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#10b981',
  target_per_day INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_log_unique ON habit_logs(habit_id, log_date);

CREATE TABLE IF NOT EXISTS countdowns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  target_date TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'countdown',
  repeat_yearly INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#f59e0b',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'note',
  content_md TEXT NOT NULL DEFAULT '',
  icon TEXT,
  created_at TEXT NOT NULL
);
