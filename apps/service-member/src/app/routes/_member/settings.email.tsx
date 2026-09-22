import { createFileRoute } from "@tanstack/react-router";

import { EmailRoute } from "#pages/settings/index.ts";

const Route = createFileRoute("/_member/settings/email")({
  component: EmailRoute,
});

export { Route };
