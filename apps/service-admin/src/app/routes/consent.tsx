import { consentSearch } from "@repo/auth-ui/consent";
import { createFileRoute } from "@tanstack/react-router";

import { ConsentPage } from "#pages/consent/index.ts";

const Route = createFileRoute("/consent")({
  validateSearch: consentSearch,
  component: ConsentPage,
});

export { Route };
