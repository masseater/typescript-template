#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { causeRecord, firstUserArgumentIndex, reportFailed, runCli } from "@repo/config/cli";
import { repositoryRoot } from "@repo/config/repository-root";
import { Console, Effect, Schema } from "effect";

import { loadCiArguments } from "./load-arguments.ts";

class LoadCiFailure extends Schema.TaggedError<LoadCiFailure>()("LoadCiFailure", {
  reason: Schema.Literals(["load_failed", "preview_failed", "usage_invalid"]),
}) {}

type PreviewHandle = { readonly kill: () => void };

const preview = (
  app: (typeof loadCiArguments.Type)["app"],
): Effect.Effect<PreviewHandle, LoadCiFailure> => {
  return Effect.callback<PreviewHandle, LoadCiFailure>((resume) => {
    const child = spawn("vp", ["preview"], {
      cwd: path.join(repositoryRoot, "apps", app),
      env: process.env,
      stdio: "ignore",
    });
    const finish = (effect: Effect.Effect<PreviewHandle, LoadCiFailure>): undefined => {
      child.removeAllListeners("error");
      child.removeAllListeners("spawn");
      child.removeAllListeners("exit");
      resume(effect);
    };
    child.once("error", () => {
      finish(Effect.fail(new LoadCiFailure({ reason: "preview_failed" })));
    });
    child.once("spawn", () => {
      finish(
        Effect.succeed({
          kill: (): undefined => {
            child.kill("SIGTERM");
          },
        }),
      );
    });
    child.once("exit", (code) => {
      if (code !== null && code !== 0) {
        finish(Effect.fail(new LoadCiFailure({ reason: "preview_failed" })));
      }
    });
  });
};

const runLoad = (
  app: (typeof loadCiArguments.Type)["app"],
  profile: (typeof loadCiArguments.Type)["profile"],
): Effect.Effect<undefined, LoadCiFailure> => {
  return Effect.callback<undefined, LoadCiFailure>((resume) => {
    const child = spawn(fileURLToPath(new URL("./cli.ts", import.meta.url)), [app, profile], {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", () => {
      resume(Effect.fail(new LoadCiFailure({ reason: "load_failed" })));
    });
    child.once("exit", (code) => {
      resume(
        code === 0
          ? Effect.succeed(undefined)
          : Effect.fail(new LoadCiFailure({ reason: "load_failed" })),
      );
    });
  });
};

const releasePreview = (handle: PreviewHandle): Effect.Effect<undefined> =>
  Effect.sync((): undefined => {
    handle.kill();
  });

const runWithPreview = (
  selection: typeof loadCiArguments.Type,
): Effect.Effect<undefined, LoadCiFailure> =>
  Effect.acquireUseRelease(
    preview(selection.app),
    () => runLoad(selection.app, selection.profile),
    releasePreview,
  );

const remediations: Readonly<Partial<Record<LoadCiFailure["reason"], string>>> = {
  usage_invalid:
    "vp run --filter @repo/load ci <service-member|service-admin|internal-dashboard> [smoke|peak]",
};

const announceFailure = (failed: {
  readonly reason: LoadCiFailure["reason"];
}): Effect.Effect<void> =>
  reportFailed({
    event: "load.ci_failed",
    ok: false,
    reason: failed.reason,
    ...(remediations[failed.reason] === undefined
      ? {}
      : { remediation: remediations[failed.reason] }),
  });

const [app, profile] = process.argv.slice(firstUserArgumentIndex);

runCli(
  Schema.decodeUnknownEffect(loadCiArguments)(
    profile === undefined ? { app } : { app, profile },
  ).pipe(
    Effect.mapError(() => new LoadCiFailure({ reason: "usage_invalid" })),
    Effect.flatMap(runWithPreview),
    Effect.tap(() => Console.log(JSON.stringify({ event: "load.ci_finished", ok: true }))),
    Effect.catchTags({
      LoadCiFailure: announceFailure,
    }),
  ),
  (cause) => causeRecord("load.ci_failed", cause, { reason: "unexpected" }),
);
