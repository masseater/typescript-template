import { createFileRoute } from "@tanstack/react-router";

import { enterPublicFrame } from "#app/entry-conditions.ts";
import { PublicFrame } from "#widgets/public-frame/index.ts";

const Route = createFileRoute("/_public")({
  beforeLoad: ({ location }: Readonly<{ location: Readonly<{ pathname: string }> }>) =>
    enterPublicFrame(location.pathname),
  component: PublicFrame,
});

export { Route };
