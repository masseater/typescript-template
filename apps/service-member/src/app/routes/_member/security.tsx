import { createFileRoute, redirect } from "@tanstack/react-router";

const Route = createFileRoute("/_member/security")({
  beforeLoad: ({ location }: Readonly<{ location: Readonly<{ searchStr: string }> }>) => {
    throw redirect({ href: `/settings/security${location.searchStr}`, replace: true });
  },
});

export { Route };
