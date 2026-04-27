export function Bulb({ active }: { active: boolean }) {
  return active
    ? <span className="bulb" aria-label="active" />
    : <span className="bulb-idle" aria-label="idle" />;
}
