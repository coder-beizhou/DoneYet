CREATE TABLE IF NOT EXISTS operation_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  item_kind TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_title TEXT NOT NULL DEFAULT '',
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_log_time ON operation_log(created_at DESC);
