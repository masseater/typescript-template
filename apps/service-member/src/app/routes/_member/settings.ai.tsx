import { createFileRoute } from "@tanstack/react-router";

import { AiPage, loadApiKeys, loadMcpGrants } from "#pages/settings/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_member/settings/ai")({
  component: AiRoute,
  loader: async () => {
    const [grants, keys] = await Promise.all([loadMcpGrants(), loadApiKeys()]);
    return { grants, keys };
  },
});

function AiRoute(): ReactElement {
  const { grants, keys } = Route.useLoaderData();
  return <AiPage grants={grants} keys={keys} />;
}

export { Route };
