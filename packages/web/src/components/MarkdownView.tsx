import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

interface Props {
  content: string;
  className?: string;
}

function normalizeBreaks(text: string): string {
  // Ensure bold labels on their own line become separate paragraphs
  return text.replace(/\n(\*\*[^*]+\*\*[:\s])/g, '\n\n$1');
}

export function MarkdownView({ content, className }: Props) {
  return (
    <div className={`prose prose-sm max-w-none text-ink-1
      prose-headings:font-serif prose-headings:text-ink-1
      prose-p:text-ink-1 prose-li:text-ink-1 prose-p:my-1
      prose-strong:text-ink-1 prose-code:text-ink-1
      prose-a:text-primary-hover
      ${className ?? ''}`}
    >
      <ReactMarkdown remarkPlugins={[remarkBreaks]}>{normalizeBreaks(content)}</ReactMarkdown>
    </div>
  );
}
