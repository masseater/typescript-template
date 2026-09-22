import { createFileRoute } from "@tanstack/react-router";

import { enterMemberFrame } from "#app/entry-conditions.ts";
import { loadNavBadges } from "#widgets/member-frame/index.ts";
import { MemberLayout } from "./-member-layout.tsx";
const Route = createFileRoute("/_member")({
  beforeLoad: ({
    location,
  }: Readonly<{
    location: Readonly<{
      href: string;
      pathname: string;
    }>;
  }>) => enterMemberFrame(location.href, location.pathname),
  loader: () => loadNavBadges(),
  component: MemberLayout,
});
export { Route };
