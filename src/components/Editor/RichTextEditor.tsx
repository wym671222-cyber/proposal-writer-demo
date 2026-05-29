import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Pilcrow, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { isHtmlContent, textToHtml } from "@/utils/content";

export type RichTextAIRequest = {
  selectedText: string;
  replaceSelection: (replacement: string) => void;
};

type RichTextEditorProps = {
  value: string;
  placeholder?: string;
  onChange: (html: string) => void;
  onAIRequest?: (request: RichTextAIRequest) => void;
  onAIMessage?: (message: string) => void;
};

export function RichTextEditor({ value, placeholder, onChange, onAIRequest, onAIMessage }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: isHtmlContent(value) ? value : textToHtml(value),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "rich-editor-content",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = isHtmlContent(value) ? value : textToHtml(value);
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  const handleAIRequest = () => {
    const { from, to, empty } = editor.state.selection;
    const selectedText = empty ? "" : editor.state.doc.textBetween(from, to, "\n").trim();
    if (!selectedText) {
      onAIMessage?.("请先选择要修改的文字。");
      return;
    }
    onAIRequest?.({
      selectedText,
      replaceSelection: (replacement) => {
        editor
          .chain()
          .focus()
          .setTextSelection({ from, to })
          .insertContent(textToHtml(replacement))
          .run();
      },
    });
  };

  return (
    <div className="rich-editor">
      <div className="rich-toolbar">
        <Button
          size="sm"
          variant={editor.isActive("bold") ? "solid" : "ghost"}
          icon={<Bold size={14} />}
          title="加粗"
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <Button
          size="sm"
          variant={editor.isActive("italic") ? "solid" : "ghost"}
          icon={<Italic size={14} />}
          title="斜体"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <Button
          size="sm"
          variant={editor.isActive("bulletList") ? "solid" : "ghost"}
          icon={<List size={14} />}
          title="无序列表"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <Button
          size="sm"
          variant={editor.isActive("orderedList") ? "solid" : "ghost"}
          icon={<ListOrdered size={14} />}
          title="有序列表"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <Button
          size="sm"
          variant="ghost"
          icon={<Pilcrow size={14} />}
          title="普通段落"
          onClick={() => editor.chain().focus().setParagraph().run()}
        />
        {onAIRequest && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Sparkles size={14} />}
            title="AI 修改选中文字"
            onClick={handleAIRequest}
          />
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
