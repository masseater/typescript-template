import { ConsentPage } from "#/components/consent-page.tsx";
import { Schema } from "effect";
import { createFileRoute } from "@tanstack/react-router";
import uiStyles from "@template/ui/styles.css?url";

const searchSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ client_id: Schema.optionalKey(Schema.String) }),
);

const Route = createFileRoute("/consent")({
  component: ConsentPage,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
  validateSearch: searchSchema,
});

export { Route };
