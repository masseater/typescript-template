import { WikiLogin } from "#/components/wiki-login.tsx";
import { createFileRoute } from "@tanstack/react-router";
import uiStyles from "#/styles/auth.css?url";

const Route = createFileRoute("/login")({
  component: WikiLogin,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
});

export { Route };
