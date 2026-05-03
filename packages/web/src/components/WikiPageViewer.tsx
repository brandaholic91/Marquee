import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

interface WikiPageViewerProps {
  content: string;
  className?: string;
}

export default function WikiPageViewer({ content, className }: WikiPageViewerProps) {
  if (!content) {
    return <p className="text-ink-3">Wiki oldal üres.</p>;
  }

  return (
    <div className={`prose prose-sm max-w-none text-ink-1
      prose-headings:font-sans prose-headings:text-ink-1
      prose-p:text-ink-1 prose-li:text-ink-1 prose-p:my-1
      prose-strong:text-ink-1 prose-code:text-ink-1
      prose-a:text-primary-hover prose-blockquote:border-l-primary prose-blockquote:border-l-4 prose-blockquote:pl-4
      ${className ?? ''}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
