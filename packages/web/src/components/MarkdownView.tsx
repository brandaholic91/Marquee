import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
  className?: string;
}

function prepareContent(text: string): string {
  // Strip structured_data HTML comment block (not rendered by react-markdown v10)
  const stripped = text.replace(/<!--\s*structured_data[\s\S]*?-->/g, '').trim();
  // Ensure bold labels on their own line become separate paragraphs
  return stripped.replace(/\n(\*\*[^*]+\*\*[:\s])/g, '\n\n$1');
}

export function MarkdownView({ content, className }: Props) {
  return (
    <div className={`prose prose-sm max-w-none text-ink-1
      prose-headings:font-sans prose-headings:text-ink-1
      prose-p:text-ink-1 prose-li:text-ink-1 prose-p:my-1
      prose-strong:text-ink-1 prose-code:text-ink-1
      prose-a:text-primary-hover
      ${className ?? ''}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{prepareContent(content)}</ReactMarkdown>
    </div>
  );
}
