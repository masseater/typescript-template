import { createFileRoute } from "@tanstack/react-router";

import { EmailRoute } from "./-email-route.tsx";

const Route = createFileRoute("/_member/settings/email")({
  component: EmailRoute,
});

export { Route };
