#!/usr/bin/env node
// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";

import { causeRecord, runCli } from "@repo/cli";
import { ROLE } from "@repo/config";
import { Console, Effect, Schema } from "effect";

import { failure } from "../failure.ts";
import { resolveVerifyEnvironment, VerifyEnvironment } from "./environments.ts";
import { verifyMember } from "./member.ts";
import { verifyOperator } from "./operator.ts";
import { verifyStaff } from "./staff.ts";

import type { LocalCommandFailure } from "../failure.ts";

const verifyRoles = [ROLE.member, "operator", "staff"] as const;

const VerifyRole = Schema.Literals(verifyRoles);

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    environment: { type: "string" },
  },
});

const runCorrelationVerify = (): Effect.Effect<unknown, LocalCommandFailure> => {
  return Effect.tryPromise({
    catch: () => failure("process_failed"),
    try: async () => {
      const { spawn } = await import("node:child_process");
      const { fileURLToPath } = await import("node:url");
      const observeVerify = fileURLToPath(new URL("../observe/verify.ts", import.meta.url));
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [observeVerify, ...process.argv.slice(2)], {
          stdio: "inherit",
        });
        child.once("error", reject);
        child.once("exit", (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(new Error("VERIFY_CORRELATION_FAILED"));
        });
      });
    },
  });
};

const runSelfServiceVerify = Effect.fn("runSelfServiceVerify")(function* runSelfServiceVerify(
  role: typeof VerifyRole.Type,
) {
  const environment = yield* Schema.decodeUnknownEffect(VerifyEnvironment)(values.environment).pipe(
    Effect.mapError(() => failure("command_unsupported")),
  );
  const resolved = yield* resolveVerifyEnvironment(environment);
  if (role === ROLE.member) {
    return yield* verifyMember(resolved);
  }
  if (role === "operator") {
    return yield* verifyOperator(resolved);
  }
  return yield* verifyStaff(resolved);
});

const program = Effect.gen(function* routeVerify() {
  const [first = ""] = positionals;
  if (verifyRoles.includes(first as (typeof verifyRoles)[number])) {
    const role = yield* Schema.decodeUnknownEffect(VerifyRole)(first).pipe(
      Effect.mapError(() => failure("command_unsupported")),
    );
    return yield* runSelfServiceVerify(role);
  }
  return yield* runCorrelationVerify();
});

runCli(
  program.pipe(
    Effect.flatMap((report) =>
      report === undefined ? Effect.void : Console.log(JSON.stringify(report)),
    ),
  ),
  (cause) =>
    causeRecord("verify.failed", cause, {
      remediation:
        "Run member verification with `vp run --filter @repo/dev verify member --environment local` after `vp run --filter @repo/dev setup` and starting apps. For observability correlation use `vp run --filter @repo/dev verify --app http://127.0.0.1:3001/`.",
    }),
);
