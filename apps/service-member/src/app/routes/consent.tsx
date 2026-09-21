import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { ConsentPage, loadClientName } from "#pages/account/consent/index.ts";

import type { ReactElement } from "react";

const searchSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ client_id: Schema.optionalKey(Schema.String) }),
);

type ConsentSearch = Readonly<{ client_id?: string | undefined }>;

const Route = createFileRoute("/consent")({
  component: ConsentRoute,
  loader: async ({ deps }: Readonly<{ deps: Readonly<{ clientId: string | undefined }> }>) =>
    deps.clientId === undefined ? undefined : loadClientName(deps.clientId),
  loaderDeps: ({ search }: Readonly<{ search: ConsentSearch }>) => ({
    clientId: search.client_id,
  }),
  validateSearch: searchSchema,
});

function ConsentRoute(): ReactElement {
  return <ConsentPage client={Route.useLoaderData()} />;
}

export { Route };
