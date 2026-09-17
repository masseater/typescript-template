import { WikiSecurity } from "#/components/wiki-security.tsx";
import { createFileRoute } from "@tanstack/react-router";
import uiStyles from "@template/ui/styles.css?url";

const Route = createFileRoute("/security")({
  component: WikiSecurity,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
});

export { Route };
