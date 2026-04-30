import type { ReactNode } from "react";

export type BadgeKind =
  | "cream"
  | "primary-soft"
  | "success-soft"
  | "danger-soft"
  | "agent";

export interface BadgeProps {
  kind?: BadgeKind;
  mono?: boolean;
  children: ReactNode;
}

export function Badge({ kind = "cream", mono, children }: BadgeProps) {
  return (
    <span
      className={`badge badge-${kind}`}
      style={mono ? { fontFamily: "var(--font-mono)", letterSpacing: "0.01em" } : undefined}
    >
      {children}
    </span>
  );
}
