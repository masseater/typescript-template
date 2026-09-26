import { useSuspenseQuery } from "@tanstack/react-query";

import { visibilityOptions } from "#entities/profile/index.ts";
import { VisibilityPage } from "./visibility-page.tsx";

import type { ReactElement } from "react";

function VisibilityRoute(): ReactElement {
  return <VisibilityPage initial={useSuspenseQuery(visibilityOptions).data} />;
}

export { VisibilityRoute };
