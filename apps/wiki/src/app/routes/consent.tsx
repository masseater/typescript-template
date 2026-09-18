import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { ConsentPage } from "#pages/consent/index.ts";

import uiStyles from "#app/auth.css?url";

const searchSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ client_id: Schema.optionalKey(Schema.String) }),
);

const Route = createFileRoute("/consent")({
  component: ConsentPage,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
  validateSearch: searchSchema,
});

export { Route };
