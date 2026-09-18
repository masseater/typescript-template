import { createFileRoute } from "@tanstack/react-router";

import { enterMemberFrame } from "#app/entry-conditions.ts";

import { MemberLayout } from "./-member-layout.tsx";

const Route = createFileRoute("/_member")({
  beforeLoad: async ({ location }: Readonly<{ location: Readonly<{ href: string }> }>) =>
    enterMemberFrame(location.href),
  component: MemberLayout,
});

export { Route };
