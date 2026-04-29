import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

interface Props {
  content: string;
  className?: string;
}

export function MarkdownView({ content, className }: Props) {
  return (
    <div className={`prose prose-sm max-w-none text-ink-1
      prose-headings:font-serif prose-headings:text-ink-1
      prose-p:text-ink-1 prose-li:text-ink-1
      prose-strong:text-ink-1 prose-code:text-ink-1
      prose-a:text-primary-hover
      ${className ?? ''}`}
    >
      <ReactMarkdown remarkPlugins={[remarkBreaks]}>{content}</ReactMarkdown>
    </div>
  );
}
