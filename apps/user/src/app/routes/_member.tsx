import { MemberLayout } from "./-member-layout.tsx";
import { createFileRoute } from "@tanstack/react-router";
import { enterMemberFrame } from "#app/entry-conditions.ts";

const Route = createFileRoute("/_member")({
  beforeLoad: async ({ location }: Readonly<{ location: Readonly<{ href: string }> }>) =>
    enterMemberFrame(location.href),
  component: MemberLayout,
});

export { Route };
