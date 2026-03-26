"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { useCallback, useEffect, useRef } from "react";

type RichEditorProps = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
  debounceMs?: number;
  /** Compact mode: renders a simplified 5-button toolbar for embedded use */
  compact?: boolean;
};

const COLOR_PALETTE = [
  "#000000", "#6b7280", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];

export function RichEditor({
  content,
  onChange,
  placeholder = "Start writing…",
  editable = true,
  autoFocus = false,
  debounceMs = 800,
  compact = false,
}: RichEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedOnChange = useCallback(
    (html: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(html), debounceMs);
    },
    [onChange, debounceMs]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
    ],
    content,
    editable,
    autofocus: autoFocus,
    onUpdate: ({ editor: e }) => {
      debouncedOnChange(e.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div className={`rich-editor ${!editable ? "rich-editor--readonly" : ""}${compact ? " rich-editor--compact" : ""}`}>
      {editable && <Toolbar editor={editor} compact={compact} />}
      <EditorContent editor={editor} className="rich-editor__content" />
    </div>
  );
}

/* ── Toolbar ────────────────────────────────────────────── */

function Toolbar({ editor, compact = false }: { editor: ReturnType<typeof useEditor>; compact?: boolean }) {
  if (!editor) return null;

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href ?? "";
    const url = window.prompt("URL", previousUrl);
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const btn = (
    label: string,
    action: () => void,
    isActive: boolean,
    title: string
  ) => (
    <button
      type="button"
      className={`rich-editor__btn ${isActive ? "rich-editor__btn--active" : ""}`}
      onClick={action}
      title={title}
      aria-label={title}
    >
      {label}
    </button>
  );

  if (compact) {
    return (
      <div className="rich-editor__toolbar rich-editor__toolbar--compact" role="toolbar" aria-label="Formatting options">
        <div className="rich-editor__group">
          {btn("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), "Bold")}
          {btn("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), "Italic")}
          {btn("U", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"), "Underline")}
        </div>
        <span className="rich-editor__sep" />
        <div className="rich-editor__group">
          {btn("•", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"), "Bullet list")}
          {btn("☑", () => editor.chain().focus().toggleTaskList().run(), editor.isActive("taskList"), "Task list")}
        </div>
      </div>
    );
  }

  return (
    <div className="rich-editor__toolbar" role="toolbar" aria-label="Formatting options">
      <div className="rich-editor__group">
        {btn("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), "Bold")}
        {btn("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), "Italic")}
        {btn("U", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"), "Underline")}
        {btn("S", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"), "Strikethrough")}
      </div>

      <span className="rich-editor__sep" />

      <div className="rich-editor__group">
        {btn("H1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }), "Heading 1")}
        {btn("H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }), "Heading 2")}
        {btn("H3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }), "Heading 3")}
      </div>

      <span className="rich-editor__sep" />

      <div className="rich-editor__group">
        {btn("•", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"), "Bullet list")}
        {btn("1.", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"), "Ordered list")}
        {btn("☑", () => editor.chain().focus().toggleTaskList().run(), editor.isActive("taskList"), "Task list")}
      </div>

      <span className="rich-editor__sep" />

      <div className="rich-editor__group">
        {btn("🔗", () => setLink(), editor.isActive("link"), "Link")}
        {btn("<>", () => editor.chain().focus().toggleCode().run(), editor.isActive("code"), "Inline code")}
        {btn("❝", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"), "Blockquote")}
        {btn("—", () => editor.chain().focus().setHorizontalRule().run(), false, "Horizontal rule")}
      </div>

      <span className="rich-editor__sep" />

      <div className="rich-editor__group">
        <ColorPicker editor={editor} />
        {btn("✦", () => editor.chain().focus().toggleHighlight().run(), editor.isActive("highlight"), "Highlight")}
      </div>

      <span className="rich-editor__sep" />

      <div className="rich-editor__group">
        {btn("⌫", () => editor.chain().focus().clearNodes().unsetAllMarks().run(), false, "Clear formatting")}
      </div>
    </div>
  );
}

/* ── Color picker ───────────────────────────────────────── */

function ColorPicker({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  return (
    <div className="rich-editor__color-picker">
      <button
        type="button"
        className="rich-editor__btn"
        title="Text color"
        aria-label="Text color"
        style={{ position: "relative" }}
      >
        A
        <span
          className="rich-editor__color-indicator"
          style={{ backgroundColor: editor.getAttributes("textStyle").color ?? "var(--ink)" }}
        />
      </button>
      <div className="rich-editor__color-dropdown">
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className="rich-editor__color-swatch"
            style={{ backgroundColor: color }}
            onClick={() => editor.chain().focus().setColor(color).run()}
            title={color}
            aria-label={`Set text color to ${color}`}
          />
        ))}
        <button
          type="button"
          className="rich-editor__color-swatch rich-editor__color-swatch--reset"
          onClick={() => editor.chain().focus().unsetColor().run()}
          title="Reset color"
          aria-label="Reset text color"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
