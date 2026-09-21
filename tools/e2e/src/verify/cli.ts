#!/usr/bin/env node

import { parseArgs } from "node:util";

import { causeRecord, runCli } from "@repo/cli";
import { ROLE } from "@repo/config";
import { Console, Effect, Schema } from "effect";

import { resolveVerifyEnvironment, VerifyEnvironment } from "./environments.ts";
import { failure } from "./failure.ts";
import { verifyMember } from "./member.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    environment: { type: "string" },
  },
});

const program = Effect.gen(function* routeVerify() {
  const [role = ""] = positionals;
  if (role !== ROLE.member) {
    return yield* failure("command_unsupported");
  }
  const environment = yield* Schema.decodeUnknownEffect(VerifyEnvironment)(values.environment).pipe(
    Effect.mapError(() => failure("command_unsupported")),
  );
  const resolved = yield* resolveVerifyEnvironment(environment);
  return yield* verifyMember(resolved);
});

runCli(program.pipe(Effect.flatMap((report) => Console.log(JSON.stringify(report)))), (cause) =>
  causeRecord("verify.failed", cause, {
    remediation:
      "Run member verification with `vp run --filter @repo/e2e verify member --environment local` after `vp run --filter @repo/dev setup` and starting apps.",
  }),
);
