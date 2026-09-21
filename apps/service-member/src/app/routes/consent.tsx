import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { McpConsentPage } from "#pages/settings/index.ts";

const searchSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    client_id: Schema.optionalKey(Schema.String),
    scope: Schema.optionalKey(Schema.String),
  }),
);

const Route = createFileRoute("/consent")({
  validateSearch: searchSchema,
  component: McpConsentPage,
});

export { Route };
