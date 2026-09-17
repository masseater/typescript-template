import { Effect, Schema } from "effect";
import { applicationPorts, applications, mailpitPort } from "@template/config";
// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { downloadUrl, releases, version } from "./releases.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { execFile, spawn } from "node:child_process";
import { NodeRuntime } from "@effect/platform-node";
import type { Release } from "./releases.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { createHash } from "node:crypto";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";

class LoadTestFailure extends Schema.TaggedError<LoadTestFailure>()("LoadTestFailure", {
  reason: Schema.Literals([
    "application_unknown",
    "archive_corrupted",
    "download_failed",
    "extraction_failed",
    "file_io_failed",
    "platform_unsupported",
    "thresholds_crossed",
  ]),
}) {}

// oxlint-disable-next-line typescript/strict-void-return
const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const scenarios = fileURLToPath(new URL("../scenarios/", import.meta.url));
const installDirectory = path.join(root, ".local/k6", version);
const ownerOnlyDirectoryMode = 0o700;
const executableMode = 0o755;
const Application = Schema.Literals(applications);

function failWith(reason: LoadTestFailure["reason"]): LoadTestFailure {
  return new LoadTestFailure({ reason });
}

function fileIo<Value>(operation: () => Promise<Value>): Effect.Effect<Value, LoadTestFailure> {
  return Effect.tryPromise({ catch: () => failWith("file_io_failed"), try: operation });
}

function exists(file: string): Effect.Effect<boolean> {
  return fileIo(async () => stat(file)).pipe(
    Effect.match({ onFailure: () => false, onSuccess: () => true }),
  );
}

function selectRelease(): Effect.Effect<Release, LoadTestFailure> {
  const found = releases.get(`${process.platform}-${process.arch}`);
  return found === undefined
    ? Effect.fail(failWith("platform_unsupported"))
    : Effect.succeed(found);
}

const download = Effect.fn("download")(function* download(release: Release) {
  const response = yield* Effect.tryPromise({
    catch: () => failWith("download_failed"),
    try: async () => fetch(downloadUrl(release.archive), { redirect: "follow" }),
  });
  if (!response.ok) {
    return yield* failWith("download_failed");
  }
  const content = Buffer.from(
    yield* Effect.tryPromise({
      catch: () => failWith("download_failed"),
      try: async () => response.arrayBuffer(),
    }),
  );
  if (createHash("sha256").update(content).digest("hex") !== release.digest) {
    return yield* failWith("archive_corrupted");
  }
  const archive = path.join(installDirectory, release.archive);
  yield* fileIo(async () => writeFile(archive, content, { mode: executableMode }));
  return archive;
});

const extract = Effect.fn("extract")(function* extract(release: Release) {
  yield* fileIo(async () => rm(installDirectory, { force: true, recursive: true }));
  yield* fileIo(async () =>
    mkdir(installDirectory, { mode: ownerOnlyDirectoryMode, recursive: true }),
  );
  const archive = yield* download(release);
  yield* Effect.tryPromise({
    catch: () => failWith("extraction_failed"),
    try: async () => execFileAsync("tar", ["-xf", archive], { cwd: installDirectory }),
  });
  yield* fileIo(async () => rm(archive, { force: true }));
  yield* fileIo(async () => chmod(path.join(installDirectory, release.member), executableMode));
});

const install = Effect.fn("install")(function* install() {
  const release = yield* selectRelease();
  const binary = path.join(installDirectory, release.member);
  if (!(yield* exists(binary))) {
    yield* extract(release);
  }
  return binary;
});

function runScenario(
  binary: string,
  scenario: string,
  origin: string,
): Effect.Effect<void, LoadTestFailure> {
  return Effect.callback<undefined, LoadTestFailure>((resume) => {
    const failed = failWith("thresholds_crossed");
    const child = spawn(binary, ["run", scenario], {
      cwd: root,
      env: {
        LOAD_MAILPIT_ORIGIN: `http://127.0.0.1:${mailpitPort}`,
        LOAD_TARGET_ORIGIN: origin,
      },
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.once("error", () => {
      resume(Effect.fail(failed));
    });
    child.once("exit", (code) => {
      resume(code === 0 ? Effect.undefined : Effect.fail(failed));
    });
  });
}

const measure = Effect.fn("measure")(function* measure(app: typeof Application.Type) {
  const origin = `http://127.0.0.1:${applicationPorts[app]}`;
  yield* runScenario(yield* install(), path.join(scenarios, `${app}-journey.ts`), origin);
  return { app, event: "load.thresholds_met", ok: true, origin } as const;
});

const firstUserArgumentIndex = 2;

NodeRuntime.runMain(
  Schema.decodeUnknownEffect(Application)(process.argv[firstUserArgumentIndex]).pipe(
    Effect.mapError(() => failWith("application_unknown")),
    Effect.flatMap(measure),
    Effect.flatMap((report) =>
      Effect.sync(() => {
        process.stdout.write(`${JSON.stringify(report)}\n`);
      }),
    ),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.catchTag("LoadTestFailure", (failure) =>
      Effect.sync(() => {
        process.stderr.write(
          `${JSON.stringify({ event: "load.run_failed", ok: false, reason: failure.reason })}\n`,
        );
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
