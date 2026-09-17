import type { ReactNode, ReactPortal } from "react";

type Children = Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>;

export type { Children };
