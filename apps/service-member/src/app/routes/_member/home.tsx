import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "#pages/home/index.ts";

const Route = createFileRoute("/_member/home")({
  component: HomePage,
});

export { Route };
