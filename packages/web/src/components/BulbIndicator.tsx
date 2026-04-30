export function BulbIndicator({ active }: { active: boolean }) {
  return (
    <span
      className={active ? 'bulb' : 'bulb-idle'}
      aria-label={active ? 'aktív' : 'inaktív'}
    />
  );
}
