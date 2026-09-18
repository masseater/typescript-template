import { MemberLayout } from "./-member-layout.tsx";
import type { RouterContext } from "#app/router-context.ts";
import { createFileRoute } from "@tanstack/react-router";
import { enterMemberFrame } from "#app/entry-conditions.ts";
import { profileOptions } from "#entities/profile/index.ts";

const Route = createFileRoute("/_member")({
  beforeLoad: async ({
    context,
    location,
  }: Readonly<{ context: RouterContext; location: Readonly<{ href: string }> }>) =>
    enterMemberFrame(context.queryClient, location.href),
  component: MemberLayout,
  loader: async ({ context }: Readonly<{ context: RouterContext }>): Promise<void> => {
    await context.queryClient.query(profileOptions);
  },
});

export { Route };
