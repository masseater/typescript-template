import { createFileRoute } from "@tanstack/react-router";

import { AiPage, loadApiKeys } from "#pages/settings/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_member/settings/ai")({
  component: AiRoute,
  loader: () => loadApiKeys(),
});

function AiRoute(): ReactElement {
  const keys = Route.useLoaderData();
  return <AiPage keys={keys} />;
}

export { Route };
