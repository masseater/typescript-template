import { getRouteApi } from "@tanstack/react-router";

import { BoardPage } from "./board-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/board/");

function BoardRoute(): ReactElement {
  return <BoardPage list={route.useLoaderData()} search={route.useSearch()} />;
}

export { BoardRoute };
