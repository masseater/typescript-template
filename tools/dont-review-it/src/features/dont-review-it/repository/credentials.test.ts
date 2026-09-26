import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect, vi } from "vite-plus/test";

import { deploymentCredentials } from "./credentials.ts";

const unusablePrefix = "NOT-A-DEPLOYABLE-PREFIX";
const project = "template-project";

const stubbedEnvironment = (entries: Readonly<Record<string, string | undefined>>) =>
  Effect.sync(() => {
    for (const [name, value] of Object.entries(entries)) {
      vi.stubEnv(name, value);
    }
  });

const fixture = Effect.gen(function* fixture() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "template-credentials-" });
  const home = yield* filesystem.makeTempDirectoryScoped({ prefix: "template-config-" });
  yield* stubbedEnvironment({ TEMPLATE_CLOUDFLARE_ENV_FILE: undefined, XDG_CONFIG_HOME: home });
  yield* filesystem.writeFileString(
    paths.join(root, "package.json"),
    yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ name: project }),
  );
  return { filename: paths.join(home, project, "cloudflare.env"), root };
});

const writeCredentials = (filename: string, contents: string) =>
  Effect.gen(function* writeCredentials() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    yield* filesystem.makeDirectory(paths.dirname(filename), { recursive: true });
    yield* filesystem.writeFileString(filename, contents);
  });

const report = (root: string) =>
  Effect.map(Effect.flip(deploymentCredentials(root)), (failure) => failure.report);

layer(NodeServices.layer)("deployment credentials the staged-diff check scans for", (it) => {
  it.effect("reports no credentials configured when the default file was never created", () =>
    Effect.gen(function* program() {
      const { root } = yield* fixture;
      expect(yield* deploymentCredentials(root)).toStrictEqual({ source: "absent", values: [] });
    }),
  );

  it.effect("reads the file the deploy command resolves", () =>
    Effect.gen(function* program() {
      const { filename, root } = yield* fixture;
      yield* writeCredentials(filename, `TEMPLATE_PREFIX="${unusablePrefix}"\nBUDGET_JPY=5000\n`);
      expect(yield* deploymentCredentials(root)).toStrictEqual({
        source: "file",
        values: [{ key: "TEMPLATE_PREFIX", value: unusablePrefix }],
      });
    }),
  );

  it.effect("keeps the credentials path out of what it reports", () =>
    Effect.gen(function* program() {
      const paths = yield* Path.Path;
      const { filename, root } = yield* fixture;
      yield* stubbedEnvironment({ TEMPLATE_CLOUDFLARE_ENV_FILE: filename });
      const reported = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
        yield* report(root),
      );
      expect(reported).not.toContain(paths.dirname(filename));
    }),
  );
});

layer(NodeServices.layer)("deployment credentials that cannot be scanned", (it) => {
  describe("a configured file that is not there", () => {
    it.effect("refuses to pass", () =>
      Effect.gen(function* program() {
        const { filename, root } = yield* fixture;
        yield* stubbedEnvironment({ TEMPLATE_CLOUDFLARE_ENV_FILE: filename });
        expect(yield* report(root)).toStrictEqual({
          code: "ENOENT",
          reason: "credentials-unreadable",
        });
      }),
    );
  });

  describe("a file that is there but cannot be read", () => {
    it.effect("refuses to pass", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const { filename, root } = yield* fixture;
        yield* filesystem.makeDirectory(filename, { recursive: true });
        expect(yield* report(root)).toStrictEqual({
          code: "EISDIR",
          reason: "credentials-unreadable",
        });
      }),
    );
  });

  describe("a file that holds no deployment value to scan for", () => {
    it.effect("refuses to pass", () =>
      Effect.gen(function* program() {
        const { filename, root } = yield* fixture;
        yield* writeCredentials(filename, "BUDGET_JPY=5000\n# nothing private here\n");
        expect(yield* report(root)).toStrictEqual({ reason: "credentials-without-values" });
      }),
    );
  });

  describe("a project manifest that cannot be read", () => {
    it.effect("refuses to pass", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const { root } = yield* fixture;
        yield* filesystem.remove(paths.join(root, "package.json"));
        expect(yield* report(root)).toStrictEqual({
          code: "ENOENT",
          reason: "manifest-unreadable",
        });
      }),
    );
  });
});
