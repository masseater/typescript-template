import { createFileRoute } from "@tanstack/react-router";

import { enterMemberFrame } from "#app/entry-conditions.ts";
import { MemberLayout, loadNavBadges } from "#widgets/member-frame/index.ts";

import type { QueryClient } from "@tanstack/react-query";

const Route = createFileRoute("/_member")({
  beforeLoad: ({
    context,
    location,
  }: Readonly<{
    context: Readonly<{ queryClient: QueryClient }>;
    location: Readonly<{
      href: string;
      pathname: string;
    }>;
  }>) => enterMemberFrame(context.queryClient, location.href, location.pathname),
  loader: () => loadNavBadges(),
  component: MemberLayout,
});

export { Route };
