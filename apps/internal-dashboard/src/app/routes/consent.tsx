import { consentSearch } from "@repo/auth-ui/consent";
import { createFileRoute } from "@tanstack/react-router";

import uiStyles from "#app/auth.css?url";
import { ConsentPage } from "#pages/consent/index.ts";

const Route = createFileRoute("/consent")({
  validateSearch: consentSearch,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
  component: ConsentPage,
});

export { Route };
