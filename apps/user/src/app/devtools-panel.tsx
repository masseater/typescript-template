import { FormDevtoolsPanel } from "@tanstack/react-form-devtools";
import type { ReactElement } from "react";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

const plugins = [
  { id: "query", name: "Query", render: <ReactQueryDevtoolsPanel /> },
  { id: "router", name: "Router", render: <TanStackRouterDevtoolsPanel /> },
  { id: "form", name: "Form", render: <FormDevtoolsPanel /> },
];

function DevtoolsPanel(): ReactElement {
  return <TanStackDevtools plugins={plugins} />;
}

export { DevtoolsPanel };
