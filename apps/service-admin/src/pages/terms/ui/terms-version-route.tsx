import { getRouteApi } from "@tanstack/react-router";

import { TermsVersionPage } from "./terms-version-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_admin/terms/$version");

function TermsVersionRoute(): ReactElement {
  const { version } = route.useParams();
  return <TermsVersionPage version={version} />;
}

export { TermsVersionRoute };
