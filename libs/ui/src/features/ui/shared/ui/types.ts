import type { ReactNode, ReactPortal } from "react";

type UiNode = Readonly<Exclude<ReactNode, ReactPortal>>;

type Children = Readonly<{ children: UiNode }>;

export type { Children, UiNode };
