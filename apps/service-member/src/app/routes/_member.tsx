import { createFileRoute } from "@tanstack/react-router";

import { enterMemberFrame } from "#app/entry-conditions.ts";
import { MemberLayout } from "#widgets/member-frame/index.ts";

const Route = createFileRoute("/_member")({
  beforeLoad: ({
    location,
  }: Readonly<{ location: Readonly<{ href: string; pathname: string }> }>) =>
    enterMemberFrame(location.href, location.pathname),
  component: MemberLayout,
});

export { Route };
