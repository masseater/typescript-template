import { AGREEMENT_KIND } from "@repo/config";
import { getRouteApi } from "@tanstack/react-router";

import { LegalDocumentPage } from "./legal-document-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_public/privacy");

function PrivacyRoute(): ReactElement {
  return <LegalDocumentPage document={route.useLoaderData()} kind={AGREEMENT_KIND.privacy} />;
}

export { PrivacyRoute };
