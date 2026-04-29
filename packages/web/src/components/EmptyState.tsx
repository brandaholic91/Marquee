export function EmptyState({ title, body, actionLabel, onAction }: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="border border-rule rounded-lg bg-off-white p-8 text-center">
      <h2 className="font-serif text-xl mb-2">{title}</h2>
      <p className="text-ink-2 mb-6">{body}</p>
      {actionLabel && onAction && (
        <button
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-hover"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
