import { createFileRoute } from "@tanstack/react-router";

import { UpgradePage } from "#pages/upgrade/index.ts";

const Route = createFileRoute("/_member/upgrade")({
  component: UpgradePage,
});

export { Route };
