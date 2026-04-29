import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { useEffect } from 'react';

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  minHeight?: string;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, minHeight = '180px', placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({ transformPastedText: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: [
          'prose prose-sm max-w-none outline-none p-3',
          'text-ink-1 prose-headings:font-serif prose-headings:text-ink-1',
          'prose-p:text-ink-1 prose-li:text-ink-1 prose-strong:text-ink-1',
        ].join(' '),
        style: `min-height: ${minHeight}`,
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
    onUpdate({ editor: e }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange((e.storage as any).markdown.getMarkdown() as string);
    },
  });

  // Sync external value changes (e.g. when modal re-opens with new content)
  useEffect(() => {
    if (!editor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (editor.storage as any).markdown.getMarkdown() as string;
    if (current !== value) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  return (
    <div className="border border-rule rounded-md bg-off-white focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 overflow-auto">
      <EditorContent editor={editor} />
    </div>
  );
}
