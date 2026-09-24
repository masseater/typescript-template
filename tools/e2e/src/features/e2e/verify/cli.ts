#!/usr/bin/env node

import { NodeServices } from "@effect/platform-node";
import { causeRecord, runCli } from "@repo/cli";
import { ROLE } from "@repo/config";
import { Console, Effect, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { resolveVerifyEnvironment, VerifyEnvironment } from "./environments.ts";
import { failure } from "./failure.ts";
import { verifyMember } from "./member.ts";

const verifyCommand = Command.make(
  "verify",
  {
    environment: Flag.String("environment").pipe(Flag.optional),
    role: Argument.String("role").pipe(Argument.withDefault("")),
  },
  Effect.fn(function* routeVerify({ environment, role }) {
    if (role !== ROLE.member) {
      return yield* failure("command_unsupported");
    }
    const decoded = yield* Schema.decodeUnknownEffect(VerifyEnvironment)(
      Option.getOrUndefined(environment),
    ).pipe(Effect.mapError(() => failure("command_unsupported")));
    const resolved = yield* resolveVerifyEnvironment(decoded);
    yield* verifyMember(resolved).pipe(
      Effect.flatMap((report) => Console.log(JSON.stringify(report))),
    );
  }),
).pipe(Command.run({ version: "0.0.0" }), Effect.provide(NodeServices.layer));

runCli(verifyCommand, (cause) =>
  causeRecord("verify.failed", {
    cause,
    fields: {
      remediation:
        "Run member verification with `vp run --filter @repo/e2e verify member --environment local` after `vp run --filter @repo/dev setup` and starting apps.",
    },
  }),
);
