import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import uiStyles from "#app/auth.css?url";
import { ConsentPage } from "#pages/consent/index.ts";

const searchSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ client_id: Schema.optionalKey(Schema.String) }),
);

const Route = createFileRoute("/consent")({
  validateSearch: searchSchema,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
  component: ConsentPage,
});

export { Route };
