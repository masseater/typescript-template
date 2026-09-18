import { MemberLayout } from "./-member-layout.tsx";
import type { RouterContext } from "#app/router-context.ts";
import { createFileRoute } from "@tanstack/react-router";
import { enterMemberFrame } from "#app/entry-conditions.ts";
import { profileOptions } from "#entities/profile/index.ts";

interface RouteArguments {
  readonly context: RouterContext;
  readonly location: Readonly<{ href: string }>;
}

const Route = createFileRoute("/_member")({
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  beforeLoad: async ({ context, location }: RouteArguments) =>
    enterMemberFrame(context.queryClient, location.href),
  component: MemberLayout,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  loader: async ({ context }: Pick<RouteArguments, "context">): Promise<void> => {
    await context.queryClient.query(profileOptions);
  },
});

export { Route };
