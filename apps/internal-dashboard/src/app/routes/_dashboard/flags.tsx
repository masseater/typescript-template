import { createFileRoute } from "@tanstack/react-router";

import { FlagsPage } from "#pages/flags/index.ts";

const Route = createFileRoute("/_dashboard/flags")({
  component: FlagsPage,
});

export { Route };
