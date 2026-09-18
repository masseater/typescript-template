// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { applicationOrigins, mailpitOrigin } from "@repo/config";
import { reportFailed, runCli } from "@repo/config/cli";
import { memberPageSize } from "@repo/runtime/contracts";
import { Console, Effect, Schema } from "effect";

import { exists, installBinary } from "./binary.ts";
import {
  Application,
  awaitReady,
  clearTraces,
  oneMinuteLoadAverage,
  requireLoopbackOrigin,
} from "./environment.ts";
import { discardSummary, readSummary } from "./summary.ts";

import type { BinaryUnavailable } from "./binary.ts";
import type { EnvironmentUnusable } from "./environment.ts";
import type { Report } from "./summary.ts";

class LoadTestFailure extends Schema.TaggedError<LoadTestFailure>()("LoadTestFailure", {
  code: Schema.optionalKey(Schema.Int),
  crossed: Schema.optionalKey(Schema.Array(Schema.String)),
  reason: Schema.Literals([
    "measurement_empty",
    "scenario_failed",
    "scenario_missing",
    "summary_unreadable",
    "thresholds_crossed",
    "usage_invalid",
  ]),
}) {}

type Failure = BinaryUnavailable | EnvironmentUnusable | LoadTestFailure;

const root = fileURLToPath(new URL("../../../", import.meta.url));
const scenarios = fileURLToPath(new URL("../scenarios/", import.meta.url));
const home = path.join(root, ".local/k6");
const summaryFile = path.join(home, "summary.json");
const thresholdsExitCode = 99;
const standardErrorDescriptor = 2;
const profiles = {
  peak: { LOAD_HOLD: "40s", LOAD_PEAK_USERS: "20", LOAD_RAMP: "20s" },
  smoke: { LOAD_HOLD: "10s", LOAD_PEAK_USERS: "5", LOAD_RAMP: "5s" },
} as const;
const peak = Effect.succeed("peak" as const);
const Profile = Schema.Literals(["peak", "smoke"]).pipe(Schema.withDecodingDefaultKey(peak));
const Arguments = Schema.Struct({ app: Application, profile: Profile });
const usage = "vp run --filter @repo/load load <user|admin|wiki> [smoke|peak]";
const rebuild = "vp run --filter @repo/dev setup loopback, then vp run --filter @repo/<app> build";
const remediations: Readonly<Partial<Record<Failure["reason"], string>>> = {
  build_missing: rebuild,
  origin_mismatch: rebuild,
  target_unreachable: "vp run --filter @repo/<app> preview",
  traces_not_cleared: "restart vp run --filter @repo/<app> preview",
  usage_invalid: usage,
};

function runScenario(
  binary: string,
  scenario: string,
  environment: Readonly<Record<string, string>>,
): Effect.Effect<boolean, LoadTestFailure> {
  return Effect.callback<boolean, LoadTestFailure>((resume) => {
    const child = spawn(binary, ["run", "--summary-export", summaryFile, scenario], {
      cwd: root,
      // oxlint-disable-next-line node/no-process-env
      env: { ...process.env, ...environment },
      stdio: ["ignore", standardErrorDescriptor, "inherit"],
    });
    child.once("error", () => {
      resume(Effect.fail(new LoadTestFailure({ reason: "scenario_failed" })));
    });
    child.once("exit", (code) => {
      resume(
        code === 0 || code === thresholdsExitCode
          ? Effect.succeed(code === thresholdsExitCode)
          : Effect.fail(new LoadTestFailure({ code: code ?? 0, reason: "scenario_failed" })),
      );
    });
  });
}

function requireMeasurement(): Effect.Effect<Report, LoadTestFailure> {
  return readSummary(summaryFile).pipe(
    Effect.mapError(() => new LoadTestFailure({ reason: "summary_unreadable" })),
    Effect.filterOrFail(
      (report) => report.requests > 0,
      () => new LoadTestFailure({ reason: "measurement_empty" }),
    ),
  );
}

function scenarioEnvironment(
  profile: keyof typeof profiles,
  origin: string,
): Readonly<Record<string, string>> {
  return {
    ...profiles[profile],
    LOAD_MAILPIT_ORIGIN: mailpitOrigin,
    LOAD_MEMBER_PAGE_SIZE: String(memberPageSize),
    LOAD_TARGET_ORIGIN: origin,
  };
}

interface Measured {
  readonly app: string;
  readonly crossed: boolean;
  readonly loadAverage: Readonly<{ after: number; before: number }>;
  readonly measured: Report;
  readonly origin: string;
  readonly profile: string;
}

const prepare = Effect.fn("prepare")(function* prepare(
  app: typeof Application.Type,
  origin: string,
) {
  const scenario = path.join(scenarios, `${app}-journey.ts`);
  if (!(yield* exists(scenario))) {
    return yield* new LoadTestFailure({ reason: "scenario_missing" });
  }
  yield* requireLoopbackOrigin(app);
  const binary = yield* installBinary(home);
  yield* awaitReady(app);
  yield* clearTraces(origin);
  yield* discardSummary(summaryFile).pipe(
    Effect.mapError(() => new LoadTestFailure({ reason: "summary_unreadable" })),
  );
  return { binary, scenario };
});

const measure = Effect.fn("measure")(function* measure(input: typeof Arguments.Type) {
  const { app, profile } = input;
  const origin = applicationOrigins[app];
  const { binary, scenario } = yield* prepare(app, origin);
  const before = oneMinuteLoadAverage();
  const crossed = yield* runScenario(binary, scenario, scenarioEnvironment(profile, origin));
  const loadAverage = { after: oneMinuteLoadAverage(), before };
  const measured: Measured = {
    app,
    crossed,
    loadAverage,
    measured: yield* requireMeasurement(),
    origin,
    profile,
  };
  return measured;
});

const announce = Effect.fn("announce")(function* announce(result: Measured) {
  const { crossed, measured, ...rest } = result;
  yield* Console.log(
    JSON.stringify({ event: "load.measured", ok: !crossed, ...rest, ...measured }),
  );
  if (crossed) {
    return yield* new LoadTestFailure({ crossed: measured.crossed, reason: "thresholds_crossed" });
  }
});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function announceFailure(failure: Failure): Effect.Effect<void> {
  const remediation = remediations[failure.reason];
  const details = {
    ...(failure._tag === "LoadTestFailure" && failure.code !== undefined
      ? { exitCode: failure.code }
      : {}),
    ...(failure._tag === "LoadTestFailure" && failure.crossed !== undefined
      ? { crossed: failure.crossed }
      : {}),
    ...(remediation === undefined ? {} : { remediation }),
  };
  return reportFailed({ event: "load.run_failed", ok: false, reason: failure.reason, ...details });
}

const firstUserArgumentIndex = 2;
const [app, profile] = process.argv.slice(firstUserArgumentIndex);

runCli(
  Schema.decodeUnknownEffect(Arguments)(profile === undefined ? { app } : { app, profile }).pipe(
    Effect.mapError(() => new LoadTestFailure({ reason: "usage_invalid" })),
    Effect.flatMap(measure),
    Effect.flatMap(announce),
    Effect.catchTags({
      BinaryUnavailable: announceFailure,
      EnvironmentUnusable: announceFailure,
      LoadTestFailure: announceFailure,
    }),
  ),
  { event: "load.run_failed", ok: false, reason: "unexpected" },
);
