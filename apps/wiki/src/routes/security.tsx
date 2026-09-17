import { WikiSecurity } from "#/components/wiki-security.tsx";
import { createFileRoute } from "@tanstack/react-router";
import uiStyles from "#/styles/auth.css?url";

const Route = createFileRoute("/security")({
  component: WikiSecurity,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
});

export { Route };
