import { RegistryProvider } from "@effect/atom-react";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return <RegistryProvider>{children}</RegistryProvider>;
}
