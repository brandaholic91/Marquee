import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WikiPageViewer from './WikiPageViewer';

describe('WikiPageViewer', () => {
  it('renders markdown content with headings', () => {
    const content = '# Cím\nHello world';
    render(<WikiPageViewer content={content} />);
    expect(screen.getByText('Cím')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('shows empty message when content is empty', () => {
    render(<WikiPageViewer content="" />);
    expect(screen.getByText(/üres/i)).toBeInTheDocument();
  });

  it('renders markdown links', () => {
    const content = '[Link szöveg](https://example.com)';
    render(<WikiPageViewer content={content} />);
    const link = screen.getByRole('link', { name: /Link szöveg/i });
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders bold and italic text', () => {
    const content = '**Bold szöveg** és *italics*';
    render(<WikiPageViewer content={content} />);
    expect(screen.getByText(/Bold szöveg/)).toBeInTheDocument();
    expect(screen.getByText(/italics/)).toBeInTheDocument();
  });

  it('renders lists', () => {
    const content = '- Elem 1\n- Elem 2\n- Elem 3';
    render(<WikiPageViewer content={content} />);
    expect(screen.getByText('Elem 1')).toBeInTheDocument();
    expect(screen.getByText('Elem 2')).toBeInTheDocument();
    expect(screen.getByText('Elem 3')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(<WikiPageViewer content="# Test" className="custom-class" />);
    const proseDiv = container.firstChild;
    expect(proseDiv).toHaveClass('custom-class');
  });

  it('renders code blocks', () => {
    const content = '```\ncode block\n```';
    render(<WikiPageViewer content={content} />);
    expect(screen.getByText(/code block/)).toBeInTheDocument();
  });
});
