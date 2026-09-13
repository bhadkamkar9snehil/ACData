import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; tone?: "primary" | "quiet" };
export function Button({ icon, tone = "primary", children, ...props }: Props) {
  return <button className={`button button--${tone}`} {...props}>{icon}{children}</button>;
}
