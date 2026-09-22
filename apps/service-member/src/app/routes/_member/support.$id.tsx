import { createFileRoute } from "@tanstack/react-router";

import { SupportDetailRoute } from "#pages/support/index.ts";

const Route = createFileRoute("/_member/support/$id")({
  component: SupportDetailRoute,
});

export { Route };
