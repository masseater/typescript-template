import { createContext, useContext, useReducer } from "react";
import type { ReactNode } from "react";

type SidebarAction = { type: "toggle" } | { type: "close" };

const reducer = (open: boolean, action: SidebarAction) => (action.type === "toggle" ? !open : false);

const SidebarContext = createContext<{ open: boolean; dispatch: (a: SidebarAction) => void } | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, dispatch] = useReducer(reducer, false);
  return <SidebarContext.Provider value={{ open, dispatch }}>{children}</SidebarContext.Provider>;
}

export const useSidebar = () => useContext(SidebarContext);
