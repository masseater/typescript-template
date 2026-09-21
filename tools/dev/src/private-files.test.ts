import { applicationOrigins } from "@repo/config";
import { Effect, FileSystem, Path, PlatformError } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { layer } from "./platform.ts";
import { replacePrivateFile } from "./private-files.ts";
import { appVariables, sharedRunnerCredentials } from "./shared-runner-credentials.ts";

function privateFile(
  name: string,
): Effect.Effect<URL, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* privateFileProgram() {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const base = yield* fs.makeTempDirectory({ prefix: "private-files-" });
    return new URL(`file://${path.join(base, name)}`);
  });
}

describe("replacing a private file", () => {
  it("leaves a file that already holds the content alone", async () => {
    expect.hasAssertions();
    const location = await Effect.runPromise(privateFile("kept").pipe(Effect.provide(layer)));
    await Effect.runPromise(replacePrivateFile(location, "same\n").pipe(Effect.provide(layer)));
    const written = await Effect.runPromise(
      Effect.gen(function* program() {
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const resolved = yield* path.fromFileUrl(location);
        return yield* fs.stat(resolved);
      }).pipe(Effect.provide(layer)),
    );
    await Effect.runPromise(replacePrivateFile(location, "same\n").pipe(Effect.provide(layer)));
    const revisited = await Effect.runPromise(
      Effect.gen(function* program() {
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const resolved = yield* path.fromFileUrl(location);
        return yield* fs.stat(resolved);
      }).pipe(Effect.provide(layer)),
    );
    expect(revisited.mtime).toStrictEqual(written.mtime);
    const content = await Effect.runPromise(
      Effect.gen(function* program() {
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const resolved = yield* path.fromFileUrl(location);
        return yield* fs.readFileString(resolved);
      }).pipe(Effect.provide(layer)),
    );
    expect(content).toBe("same\n");
  });

  it("rewrites a file that holds different content", async () => {
    expect.hasAssertions();
    const location = await Effect.runPromise(privateFile("replaced").pipe(Effect.provide(layer)));
    await Effect.runPromise(replacePrivateFile(location, "before\n").pipe(Effect.provide(layer)));
    await Effect.runPromise(replacePrivateFile(location, "after\n").pipe(Effect.provide(layer)));
    const content = await Effect.runPromise(
      Effect.gen(function* program() {
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const resolved = yield* path.fromFileUrl(location);
        return yield* fs.readFileString(resolved);
      }).pipe(Effect.provide(layer)),
    );
    expect(content).toBe("after\n");
  });
});

describe("the variables every runner shares", () => {
  it("derives one secret and keeps the origins off the network", () => {
    expect.hasAssertions();
    const credentials = sharedRunnerCredentials();
    expect(credentials).toStrictEqual(sharedRunnerCredentials());
    expect(appVariables("service-member", credentials, "loopback")).toMatchObject({
      APP_ORIGIN: applicationOrigins["service-member"],
      AUTH_SECRET: credentials.authSecret,
    });
  });
});
