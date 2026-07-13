import { type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import { useT } from "../../i18n";

interface Props {
  initialJson: string | null;
  onChange: (json: string, md: string) => void;
  /** 工具栏是否展开(由 NoteWindow 顶部 Aa 按钮控制)。 */
  collapsed: boolean;
}

function parseContent(initialJson: string | null): any {
  if (!initialJson) return "";
  try {
    return JSON.parse(initialJson);
  } catch {
    return "";
  }
}

function TbBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="tb-btn"
      data-active={active ? "true" : undefined}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// StarterKit + 待办清单/高亮/链接 + tiptap-markdown(让 content_md 真存 markdown,不再丢格式)。
// 工具栏展开/折叠由父组件(NoteWindow 顶部 Aa)控制;展开时显示格式按钮,折叠时只显编辑区。
export default function TipTapEditor({ initialJson, onChange, collapsed }: Props) {
  const t = useT();
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Link.configure({ openOnClick: false, autolink: true }),
      Markdown,
    ],
    content: parseContent(initialJson),
    // TipTap v3 默认不在 transaction 时重渲染,工具栏 active 会 stale(在粗体里点 B 反而取消)。
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => {
      const md = (editor.storage as any).markdown?.getMarkdown?.() ?? editor.getText();
      onChange(JSON.stringify(editor.getJSON()), md);
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <>
      {!collapsed && (
        <div className="editor-toolbar">
          <TbBtn title={t("editor.bold")} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <b>B</b>
          </TbBtn>
          <TbBtn title={t("editor.italic")} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <i>I</i>
          </TbBtn>
          <TbBtn title={t("editor.strike")} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <s>S</s>
          </TbBtn>
          <span className="tb-sep" />
          <TbBtn title={t("editor.h1")} active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            H1
          </TbBtn>
          <TbBtn title={t("editor.h2")} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            H2
          </TbBtn>
          <span className="tb-sep" />
          <TbBtn title={t("editor.bulletList")} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            {t("editor.bulletLabel")}
          </TbBtn>
          <TbBtn title={t("editor.orderedList")} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            {t("editor.orderedLabel")}
          </TbBtn>
          <TbBtn title={t("editor.taskList")} active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
            {t("editor.taskLabel")}
          </TbBtn>
          <span className="tb-sep" />
          <TbBtn title={t("editor.highlight")} active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
            {t("editor.highlight")}
          </TbBtn>
          <TbBtn title={t("editor.quote")} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            ❝
          </TbBtn>
          <TbBtn title={t("editor.inlineCode")} active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
            {"</>"}
          </TbBtn>
          <TbBtn
            title={t("editor.insertLink")}
            active={editor.isActive("link")}
            onClick={() => {
              const prev = editor.getAttributes("link").href ?? "";
              const url = window.prompt(t("editor.linkPrompt"), prev);
              if (url === null) return;
              if (url === "") {
                editor.chain().focus().unsetLink().run();
              } else {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
          >
            🔗
          </TbBtn>
        </div>
      )}
      <div
        className="tiptap-wrap"
        onMouseDown={(e) => {
          // 点编辑器空白处(非 ProseMirror 内容)→ 聚焦到末尾,可立即编辑
          const target = e.target as HTMLElement;
          if (!target.closest(".ProseMirror")) editor.commands.focus("end");
        }}
      >
        <EditorContent editor={editor} className="tiptap-content" />
      </div>
    </>
  );
}
