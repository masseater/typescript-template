import { createFileRoute } from "@tanstack/react-router";

import { SupportPage } from "#pages/support/index.ts";

const Route = createFileRoute("/_member/support")({
  component: SupportPage,
});

export { Route };
