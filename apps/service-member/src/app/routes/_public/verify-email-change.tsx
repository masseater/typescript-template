import { createFileRoute } from "@tanstack/react-router";

import { VerifyEmailChangePage } from "#pages/verify-email-change/index.ts";

const Route = createFileRoute("/_public/verify-email-change")({
  component: VerifyEmailChangePage,
});

export { Route };
