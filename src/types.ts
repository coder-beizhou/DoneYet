// 与 Rust 侧模型镜像(字段保持 snake_case,serde 直传)。

// ===== 便签 =====
export interface Note {
  id: string;
  title: string;
  content_md: string;
  content_json: string | null;
  category_id: string | null;
  color: string;
  is_pinned_desktop: boolean;
  is_always_on_top: boolean;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NoteUpdate {
  id: string;
  title: string;
  content_md: string;
  content_json: string | null;
  color: string;
  category_id: string | null;
  is_pinned_desktop: boolean;
  is_always_on_top: boolean;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  date: string | null;
}

// ===== 待办(todos 表,note-scoped:note_id NOT NULL) =====
export interface Todo {
  id: string;
  note_id: string | null;
  title: string;
  content: string;
  done: boolean;
  done_at: string | null;
  sort_order: number;
  due_date: string | null;
  created_at: string;
}

export interface TodoCreate {
  note_id: string | null;
  title: string;
  content?: string;
  due_date?: string | null;
  sort_order?: number;
}

export interface TodoUpdate {
  id: string;
  title: string;
  content: string;
  done: boolean;
  due_date: string | null;
  sort_order: number;
}

// ===== 提醒 =====
export interface Repeat {
  id: string;
  kind: string;
  interval: number;
  days_of_week: string | null;
  until_date: string | null;
  created_at: string;
}

export interface RepeatInput {
  kind: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  until_date?: string | null;
}

export interface Reminder {
  id: string;
  note_id: string | null;
  title: string;
  fire_at: string;
  repeat_rule_id: string | null;
  enabled: boolean;
  last_fired_at: string | null;
  next_fire_at: string | null;
  sound: string | null;
  created_at: string;
  repeat_kind: string | null; // LEFT JOIN repeats: daily|weekly|monthly|yearly
  repeat_interval: number | null;
}

export interface ReminderCreate {
  title: string;
  fire_at: string;
  note_id?: string | null;
  repeat?: RepeatInput | null;
}

export interface ReminderUpdate {
  id: string;
  title: string;
  fire_at: string;
  note_id: string | null;
  repeat: RepeatInput | null; // null=无重复(清除), 设置=替换
}

// ===== 日历聚合项 =====
export interface AgendaItem {
  kind: "reminder" | "todo" | "note";
  id: string;
  title: string;
  at: string; // ISO: reminder 的 next_fire_at/fire_at 或 todo 的 due_date
  note_id: string | null;
  done: boolean | null; // 仅 todo 有
}

// ===== 操作日志(时间轴) =====
export interface OpLog {
  id: string;
  action: string;    // created | edited | completed | uncompleted | deleted | enabled | disabled | fired
  item_kind: string; // note | todo | reminder | category
  item_id: string;
  item_title: string;
  detail: string | null;
  created_at: string;
}

// ===== 分类(书签/便签页) =====
export interface Category {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface CategoryCreate {
  name: string;
  color?: string;
}
