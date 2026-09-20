import { createFileRoute } from "@tanstack/react-router";

import { ChoosePage } from "#pages/welcome/index.ts";

const Route = createFileRoute("/_welcome/welcome/")({
  component: ChoosePage,
});

export { Route };
