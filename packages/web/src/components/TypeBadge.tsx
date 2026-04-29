const TYPE_LABEL: Record<string, string> = {
  social_post: 'Social poszt',
  email: 'Email',
  blog_post: 'Blog poszt',
  ad_copy: 'Hirdetés szöveg',
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="text-xs px-2.5 py-0.5 rounded-full bg-parchment text-ink-2 border border-rule">
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}
