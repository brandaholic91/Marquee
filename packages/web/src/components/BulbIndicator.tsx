export function BulbIndicator({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-bulb animate-pulse' : 'bg-ink-3'}`}
      aria-label={active ? 'aktív' : 'inaktív'}
    />
  );
}
