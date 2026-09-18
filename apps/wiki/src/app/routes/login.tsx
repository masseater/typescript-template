import { createFileRoute } from "@tanstack/react-router";

import { WikiLogin } from "#pages/login/index.ts";

import uiStyles from "#app/auth.css?url";

const Route = createFileRoute("/login")({
  component: WikiLogin,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
});

export { Route };
