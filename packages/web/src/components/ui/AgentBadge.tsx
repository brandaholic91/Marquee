import { Bulb } from "./Bulb.js";

export interface AgentBadgeProps {
  slug: string;
  active?: boolean;
}

export function AgentBadge({ slug, active }: AgentBadgeProps) {
  return (
    <span
      className="badge-agent"
      style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
    >
      {active != null && <Bulb active={active} />}
      {slug}
    </span>
  );
}
