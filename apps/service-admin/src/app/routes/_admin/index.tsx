import { createFileRoute, redirect } from "@tanstack/react-router";

const Route = createFileRoute("/_admin/")({
  beforeLoad: () => {
    throw redirect({ to: "/members" });
  },
});

export { Route };
