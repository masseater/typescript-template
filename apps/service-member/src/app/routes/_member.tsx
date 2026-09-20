import { createFileRoute } from "@tanstack/react-router";

import { enterMemberFrame } from "#app/entry-conditions.ts";
import { loadNavBadges } from "#pages/nav/api/badges.ts";
import { MemberLayout } from "./-member-layout.tsx";

const Route = createFileRoute("/_member")({
  beforeLoad: async ({
    location,
  }: Readonly<{ location: Readonly<{ href: string; pathname: string }> }>) =>
    enterMemberFrame(location.href, location.pathname),
  loader: async () => loadNavBadges(),
  component: MemberLayout,
});

export { Route };
