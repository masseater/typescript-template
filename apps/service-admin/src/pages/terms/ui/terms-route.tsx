import { getRouteApi } from "@tanstack/react-router";

import { TermsPage } from "./terms-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_admin/terms");

function TermsRoute(): ReactElement {
  const { draft } = route.useSearch();
  return <TermsPage drafting={draft === true} />;
}

export { TermsRoute };
