import { redirectTarget } from "@repo/auth-ui";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { blocksMember } from "#entities/agreement/index.ts";
import { AgreementRoute } from "#pages/agreement/index.ts";

import type { Agreements } from "#entities/agreement/index.ts";

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

export { Route };
