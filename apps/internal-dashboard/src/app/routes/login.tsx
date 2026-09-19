import { createFileRoute } from "@tanstack/react-router";

import uiStyles from "#app/auth.css?url";
import { WikiLogin } from "#pages/login/index.ts";

const Route = createFileRoute("/login")({
  component: WikiLogin,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
});

export { Route };
