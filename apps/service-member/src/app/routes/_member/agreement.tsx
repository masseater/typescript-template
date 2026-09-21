import { redirectTarget } from "@repo/auth-ui";
import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router";

import { blocksMember } from "#entities/agreement/index.ts";
import { ReconsentPage } from "#pages/agreement/index.ts";

import type { Agreements } from "#entities/agreement/index.ts";
import type { ReactElement } from "react";

const home = "/home";

const Route = createFileRoute("/_member/agreement")({
  validateSearch: (search: Readonly<Record<string, unknown>>): { redirect?: string } =>
    search["redirect"] === undefined ? {} : { redirect: redirectTarget(search["redirect"]) },
  beforeLoad: ({
    context,
    search,
  }: Readonly<{
    context: Readonly<{ agreements: Agreements }>;
    search: Readonly<{ redirect?: string }>;
  }>) => {
    if (!blocksMember(context.agreements.pending)) {
      throw redirect({ href: search.redirect ?? home });
    }
  },
  component: AgreementRoute,
});

const route = getRouteApi("/_member/agreement");

function AgreementRoute(): ReactElement {
  const { agreements } = route.useRouteContext();
  const { redirect: destination } = route.useSearch();
  return <ReconsentPage agreements={agreements} destination={destination ?? home} />;
}

export { Route };
