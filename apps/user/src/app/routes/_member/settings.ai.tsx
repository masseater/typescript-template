import { createFileRoute } from "@tanstack/react-router";

import { AiPage } from "#pages/settings/index.ts";

const Route = createFileRoute("/_member/settings/ai")({
  component: AiPage,
});

export { Route };
