import type { ReactNode } from "react";
export function Placeholder({ title, text, children }: { title: string; text: string; children?: ReactNode }) { return <><header className="page-header"><div><h1>{title}</h1><p>{text}</p></div></header><section className="panel empty-workspace">{children ?? "This workspace is ready for your imported readings."}</section></>; }
