export type AvatarWho =
  | "human"
  | "director"
  | "content-lead"
  | "copywriter"
  | "eval-judge"
  | "analytics"
  | "distribution-lead"
  | "insights-lead";

export type AvatarSize = "sm" | "md";

export interface AvatarProps {
  who: AvatarWho;
  size?: AvatarSize;
}

const AVATAR_MAP: Record<AvatarWho, { initials: string; cls: string }> = {
  human:             { initials: "B",  cls: "avatar avatar-human" },
  director:          { initials: "Di", cls: "avatar avatar-director" },
  "content-lead":    { initials: "Co", cls: "avatar avatar-content-lead" },
  copywriter:        { initials: "Cw", cls: "avatar avatar-copywriter" },
  "eval-judge":      { initials: "Ev", cls: "avatar avatar-eval-judge" },
  analytics:         { initials: "An", cls: "avatar avatar-analytics" },
  "distribution-lead": { initials: "Ds", cls: "avatar avatar-distribution-lead" },
  "insights-lead":   { initials: "In", cls: "avatar avatar-insights-lead" },
};

export function Avatar({ who, size = "sm" }: AvatarProps) {
  const m = AVATAR_MAP[who] ?? { initials: "·", cls: "avatar" };
  const cls = m.cls + (size === "md" ? " avatar-md" : "");
  return <span className={cls}>{m.initials}</span>;
}
