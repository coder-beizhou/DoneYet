-- 0002: 全文搜索 FTS5(便签标题 + 内容)。M2 用。
-- 中文分词用 unicode61(按字切分),英文/数字正常;命中为 0 时前端兜底 LIKE。
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  note_id UNINDEXED,
  title,
  content_md,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- 初始填充历史便签(幂等:只补尚未进 FTS 的)
INSERT INTO notes_fts (note_id, title, content_md)
  SELECT s.id, s.title, s.content_md
  FROM sticky_notes s
  WHERE s.deleted_at IS NULL
    AND s.id NOT IN (SELECT note_id FROM notes_fts);

-- 同步触发器:新增/更新便签时维护 FTS(软删是 UPDATE,触发 notes_au 但内容未变,无副作用;
-- 搜索时 JOIN sticky_notes 过滤 deleted_at IS NULL,软删便签不会出现在结果)
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON sticky_notes BEGIN
  INSERT INTO notes_fts(note_id, title, content_md) VALUES (new.id, new.title, new.content_md);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON sticky_notes BEGIN
  UPDATE notes_fts SET title = new.title, content_md = new.content_md WHERE note_id = new.id;
END;
