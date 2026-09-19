import { createFileRoute } from "@tanstack/react-router";

import { MessagesPage } from "#pages/messages/index.ts";

const Route = createFileRoute("/_member/messages")({
  component: MessagesPage,
});

export { Route };
