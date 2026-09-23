#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { runCli } from "@repo/cli";
import { Cause, Effect, FileSystem } from "effect";

import { schemaDocument, schemaDocumentPath } from "./schema-document.ts";

runCli(
  Effect.gen(function* writeSchemaDocument() {
    const filesystem = yield* FileSystem.FileSystem;
    yield* filesystem.writeFileString(yield* schemaDocumentPath, schemaDocument());
  }).pipe(Effect.provide(NodeServices.layer)),
  (cause) => ({ action: "schema_document", cause: Cause.pretty(cause), success: false }),
);
