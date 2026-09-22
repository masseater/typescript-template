import { createFileRoute } from "@tanstack/react-router";

import { enterWelcomeFrame, welcomePath } from "#app/entry-conditions.ts";
import { WelcomeLayout } from "#widgets/welcome-shell/index.ts";

import type { QueryClient } from "@tanstack/react-query";

const Route = createFileRoute("/_welcome")({
  beforeLoad: ({
    context,
    location,
  }: Readonly<{
    context: Readonly<{ queryClient: QueryClient }>;
    location: Readonly<{ href: string }>;
  }>) => enterWelcomeFrame(context.queryClient, location.href),
  component: WelcomeLayout,
});

export { Route, welcomePath };
