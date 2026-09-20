import { createFileRoute } from "@tanstack/react-router";

import { SearchPage } from "#pages/search/index.ts";

const Route = createFileRoute("/_member/search")({
  component: SearchPage,
});

export { Route };
