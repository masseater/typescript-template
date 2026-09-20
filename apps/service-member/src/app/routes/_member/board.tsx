import { createFileRoute } from "@tanstack/react-router";

import { BoardPage } from "#pages/board/index.ts";

const Route = createFileRoute("/_member/board")({
  component: BoardPage,
});

export { Route };
