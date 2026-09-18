import { Suspense, lazy } from "react";
import type { ReactElement } from "react";
import { useHydrated } from "./hydrated";

async function loadPanel(): Promise<{ default: () => ReactElement }> {
  const panel = await import("./devtools-panel");
  return { default: panel.DevtoolsPanel };
}

const Panel = import.meta.hot === undefined ? undefined : lazy(loadPanel);

function AppDevtools(): ReactElement {
  const hydrated = useHydrated();
  return <Suspense>{hydrated && Panel !== undefined ? <Panel /> : undefined}</Suspense>;
}

export { AppDevtools };
