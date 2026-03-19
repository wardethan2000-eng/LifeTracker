"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";

type RichEditorDisplayProps = {
  content: string;
  bodyFormat?: "plain_text" | "rich_text";
  className?: string;
};

export function RichEditorDisplay({
  content,
  bodyFormat = "plain_text",
  className,
}: RichEditorDisplayProps) {
  if (bodyFormat === "plain_text") {
    return (
      <pre className={`rich-editor-display rich-editor-display--plain ${className ?? ""}`}>
        {content}
      </pre>
    );
  }

  return <RichDisplay content={content} className={className} />;
}

function RichDisplay({ content, className }: { content: string; className?: string | undefined }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
    ],
    content,
    editable: false,
  });

  if (!editor) return null;

  return (
    <EditorContent
      editor={editor}
      className={`rich-editor-display rich-editor-display--rich ${className ?? ""}`}
    />
  );
}
