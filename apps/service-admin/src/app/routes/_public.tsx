import { createFileRoute } from "@tanstack/react-router";

import { PublicFrame } from "#widgets/public-frame/index.ts";

const Route = createFileRoute("/_public")({
  component: PublicFrame,
});

export { Route };
