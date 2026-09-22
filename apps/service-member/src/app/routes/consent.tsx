import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import {
  ConsentClientUnavailable,
  ConsentPage,
  loadClientName,
} from "#pages/account/consent/index.ts";

import type { ReactElement } from "react";

const searchSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    client_id: Schema.optionalKey(Schema.String),
    scope: Schema.optionalKey(Schema.String),
  }),
);

type ConsentSearch = Readonly<{ client_id?: string | undefined; scope?: string | undefined }>;

const Route = createFileRoute("/consent")({
  component: ConsentRoute,
  validateSearch: searchSchema,
  loaderDeps: ({ search }: Readonly<{ search: ConsentSearch }>) => ({
    clientId: search.client_id,
  }),
  loader: ({ deps }: Readonly<{ deps: Readonly<{ clientId: string | undefined }> }>) => {
    if (deps.clientId === undefined) {
      return Promise.resolve(undefined);
    }
    return loadClientName(deps.clientId).catch((error: unknown) => {
      if (Schema.is(ConsentClientUnavailable)(error)) {
        return undefined;
      }
      throw error;
    });
  },
});

function ConsentRoute(): ReactElement {
  return <ConsentPage client={Route.useLoaderData()} />;
}

export { Route };
