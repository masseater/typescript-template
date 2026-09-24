import { createFileRoute } from "@tanstack/react-router";

import { ChoosePage } from "#pages/account/welcome/index.ts";

const Route = createFileRoute("/_welcome/welcome/choose")({
  component: ChoosePage,
});

export { Route };
