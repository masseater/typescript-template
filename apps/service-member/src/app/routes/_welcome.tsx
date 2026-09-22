import { createFileRoute } from "@tanstack/react-router";

import { enterWelcomeFrame, welcomePath } from "#app/entry-conditions.ts";
import { WelcomeLayout } from "#widgets/welcome-shell/index.ts";

const Route = createFileRoute("/_welcome")({
  beforeLoad: ({ location }: Readonly<{ location: Readonly<{ href: string }> }>) =>
    enterWelcomeFrame(location.href),
  component: WelcomeLayout,
});

export { Route, welcomePath };
