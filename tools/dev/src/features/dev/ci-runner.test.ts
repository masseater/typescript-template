import { homedir, userInfo } from "node:os";

import { Effect, FileSystem, Path, PlatformError } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { ciRunner } from "./ci-runner.ts";
import { layer } from "./platform.ts";

function runnerDirectory(): Effect.Effect<
  { plistFile: string; root: string },
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> {
  return Effect.gen(function* runnerDirectoryProgram() {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const base = yield* fs.makeTempDirectory({ prefix: "ci-runner-" });
    const plistFile = path.join(base, "reported.only.plist");
    yield* fs.writeFileString(path.join(base, ".service"), `${plistFile}\n`);
    return { plistFile, root: base };
  });
}

describe("the ci runner service document", () => {
  it("reports the change without touching the file", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const { plistFile, root } = yield* runnerDirectory();
        const report = yield* ciRunner([root]);
        expect(report.written).toBe(false);
        expect(report.services).toStrictEqual([
          { changed: true, label: "reported.only", plistFile, written: false },
        ]);
        const existed = yield* FileSystem.FileSystem.pipe(
          Effect.flatMap((fs) => fs.exists(plistFile)),
        );
        expect(existed).toBe(false);
      }).pipe(Effect.provide(layer)),
    ));

  it("runs the runner service under caffeinate", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const base = yield* fs.makeTempDirectory({ prefix: "ci-runner-" });
        const file = path.join(base, "written.service.plist");
        yield* fs.writeFileString(path.join(base, ".service"), `${file}\n`);
        const report = yield* ciRunner([base, "--write"]);
        expect(report.services).toStrictEqual([
          { changed: true, label: "written.service", plistFile: file, written: true },
        ]);
        const document = yield* fs.readFileString(file);
        expect(document).toContain(
          `    <array>\n      <string>/usr/bin/caffeinate</string>\n      <string>-s</string>\n      <string>${path.join(base, "runsvc.sh")}</string>\n    </array>`,
        );
      }).pipe(Effect.provide(layer)),
    ));

  it("names the service, its account and its logs", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const base = yield* fs.makeTempDirectory({ prefix: "ci-runner-" });
        const file = path.join(base, "named.service.plist");
        yield* fs.writeFileString(path.join(base, ".service"), `${file}\n`);
        yield* ciRunner([base, "--write"]);
        const document = yield* fs.readFileString(file);
        expect(document).toContain("<string>named.service</string>");
        expect(document).toContain(`<string>${userInfo().username}</string>`);
        expect(document).toContain(`<string>${base}</string>`);
        expect(document).toContain(
          `<string>${path.join(homedir(), "Library/Logs/named.service/stdout.log")}</string>`,
        );
      }).pipe(Effect.provide(layer)),
    ));

  it("leaves a service that already runs under caffeinate alone", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const base = yield* fs.makeTempDirectory({ prefix: "ci-runner-" });
        const file = path.join(base, "settled.service.plist");
        yield* fs.writeFileString(path.join(base, ".service"), `${file}\n`);
        yield* ciRunner([base, "--write"]);
        const report = yield* ciRunner([base, "--write"]);
        expect(report.services).toStrictEqual([
          { changed: false, label: "settled.service", plistFile: file, written: false },
        ]);
      }).pipe(Effect.provide(layer)),
    ));
});

describe("a ci runner directory the command cannot read", () => {
  it("refuses to guess which runner to render", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const failed = yield* Effect.flip(ciRunner([]));
        expect(failed.reason).toBe("ci_runner_root_required");
      }).pipe(Effect.provide(layer)),
    ));

  it("refuses a runner directory that names no service", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectory({ prefix: "ci-runner-bare-" });
        const failed = yield* Effect.flip(ciRunner([root]));
        expect(failed.reason).toBe("file_io_failed");
      }).pipe(Effect.provide(layer)),
    ));
});
