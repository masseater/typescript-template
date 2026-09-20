// oxlint-disable-next-line import/no-nodejs-modules
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
  it("reports the change without touching the file", async () => {
    expect.hasAssertions();
    const { plistFile, root } = await Effect.runPromise(runnerDirectory().pipe(Effect.provide(layer)));
    const report = await Effect.runPromise(ciRunner([root]).pipe(Effect.provide(layer)));
    expect(report.written).toBe(false);
    expect(report.services).toStrictEqual([
      { changed: true, label: "reported.only", plistFile, written: false },
    ]);
    await expect(
      Effect.runPromise(
        FileSystem.FileSystem.pipe(
          Effect.flatMap((fs) => fs.readFileString(plistFile)),
          Effect.provide(layer),
        ),
      ),
    ).rejects.toThrow();
  });

  it("runs the runner service under caffeinate", async () => {
    expect.hasAssertions();
    const path = await Effect.runPromise(Path.Path.pipe(Effect.provide(layer)));
    const { plistFile, root } = await Effect.runPromise(
      Effect.gen(function* program() {
        const fs = yield* FileSystem.FileSystem;
        const base = yield* fs.makeTempDirectory({ prefix: "ci-runner-" });
        const file = path.join(base, "written.service.plist");
        yield* fs.writeFileString(path.join(base, ".service"), `${file}\n`);
        return { plistFile: file, root: base };
      }).pipe(Effect.provide(layer)),
    );
    const report = await Effect.runPromise(ciRunner([root, "--write"]).pipe(Effect.provide(layer)));
    expect(report.services).toStrictEqual([
      { changed: true, label: "written.service", plistFile, written: true },
    ]);
    const document = await Effect.runPromise(
      FileSystem.FileSystem.pipe(
        Effect.flatMap((fs) => fs.readFileString(plistFile)),
        Effect.provide(layer),
      ),
    );
    expect(document).toContain(
      `    <array>\n      <string>/usr/bin/caffeinate</string>\n      <string>-s</string>\n      <string>${path.join(root, "runsvc.sh")}</string>\n    </array>`,
    );
  });

  it("names the service, its account and its logs", async () => {
    expect.hasAssertions();
    const path = await Effect.runPromise(Path.Path.pipe(Effect.provide(layer)));
    const { plistFile, root } = await Effect.runPromise(
      Effect.gen(function* program() {
        const fs = yield* FileSystem.FileSystem;
        const base = yield* fs.makeTempDirectory({ prefix: "ci-runner-" });
        const file = path.join(base, "named.service.plist");
        yield* fs.writeFileString(path.join(base, ".service"), `${file}\n`);
        return { plistFile: file, root: base };
      }).pipe(Effect.provide(layer)),
    );
    await Effect.runPromise(ciRunner([root, "--write"]).pipe(Effect.provide(layer)));
    const document = await Effect.runPromise(
      FileSystem.FileSystem.pipe(
        Effect.flatMap((fs) => fs.readFileString(plistFile)),
        Effect.provide(layer),
      ),
    );
    expect(document).toContain("<string>named.service</string>");
    expect(document).toContain(`<string>${userInfo().username}</string>`);
    expect(document).toContain(`<string>${root}</string>`);
    expect(document).toContain(
      `<string>${path.join(homedir(), "Library/Logs/named.service/stdout.log")}</string>`,
    );
  });

  it("leaves a service that already runs under caffeinate alone", async () => {
    expect.hasAssertions();
    const { plistFile, root } = await Effect.runPromise(
      Effect.gen(function* program() {
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const base = yield* fs.makeTempDirectory({ prefix: "ci-runner-" });
        const file = path.join(base, "settled.service.plist");
        yield* fs.writeFileString(path.join(base, ".service"), `${file}\n`);
        return { plistFile: file, root: base };
      }).pipe(Effect.provide(layer)),
    );
    await Effect.runPromise(ciRunner([root, "--write"]).pipe(Effect.provide(layer)));
    const report = await Effect.runPromise(ciRunner([root, "--write"]).pipe(Effect.provide(layer)));
    expect(report.services).toStrictEqual([
      { changed: false, label: "settled.service", plistFile, written: false },
    ]);
  });
});

describe("a ci runner directory the command cannot read", () => {
  it("refuses to guess which runner to render", async () => {
    expect.hasAssertions();
    const failed = await Effect.runPromise(
      Effect.flip(ciRunner([])).pipe(Effect.provide(layer)),
    );
    expect(failed.reason).toBe("ci_runner_root_required");
  });

  it("refuses a runner directory that names no service", async () => {
    expect.hasAssertions();
    const root = await Effect.runPromise(
      FileSystem.FileSystem.pipe(
        Effect.flatMap((fs) => fs.makeTempDirectory({ prefix: "ci-runner-bare-" })),
        Effect.provide(layer),
      ),
    );
    const failed = await Effect.runPromise(Effect.flip(ciRunner([root])).pipe(Effect.provide(layer)));
    expect(failed.reason).toBe("file_io_failed");
  });
});
