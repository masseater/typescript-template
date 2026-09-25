#!/usr/bin/env node
import { causeRecord, firstUserArgumentIndex, runCli } from "@repo/cli";
import { optionalSetting } from "@repo/config/process-environment";
import { encodeJson } from "@repo/infra-cloudflare/operator";
import { Console, Effect, Redacted, Schema } from "effect";

import { requireRemovalApproval } from "./approval-guard.ts";

const unverifiedEvent = "github.removal_approval_unverified";

const Gate = Schema.Struct({
  environment: Schema.NonEmptyString,
  repository: Schema.NonEmptyString,
  runId: Schema.NonEmptyString,
  token: Schema.NonEmptyString,
});

runCli(
  Effect.gen(function* program() {
    const gate = yield* Schema.decodeUnknownEffect(Gate)({
      environment: process.argv[firstUserArgumentIndex],
      repository: optionalSetting("GITHUB_REPOSITORY"),
      runId: optionalSetting("GITHUB_RUN_ID"),
      token: optionalSetting("GITHUB_TOKEN"),
    });
    yield* requireRemovalApproval({ ...gate, token: Redacted.make(gate.token) });
    yield* Console.info(
      yield* encodeJson({
        environment: gate.environment,
        event: "github.removal_approval_confirmed",
      }),
    );
  }),
  (cause) => causeRecord(unverifiedEvent, { cause }),
);
