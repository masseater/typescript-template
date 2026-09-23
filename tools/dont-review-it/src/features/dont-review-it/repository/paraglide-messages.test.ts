import { NodeServices } from "@effect/platform-node";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { field, workspaceManifests } from "./dependencies.ts";

const localizedApps = ["service-member", "service-admin"] as const;
const locales = ["ja", "en"] as const;

const JsonText = Schema.fromJsonString(Schema.Unknown);

const InlangSettings = Schema.fromJsonString(
  Schema.Struct({ baseLocale: Schema.String, locales: Schema.Array(Schema.String) }),
);

class MessagesNotAnObject extends Schema.TaggedError<MessagesNotAnObject>()("MessagesNotAnObject", {
  app: Schema.String,
  locale: Schema.String,
}) {}

const appFile = (app: (typeof localizedApps)[number], ...segments: readonly string[]) =>
  Effect.gen(function* appFile() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    return yield* filesystem.readFileString(paths.join(repositoryRoot, "apps", app, ...segments));
  });

const messageKeys = (app: (typeof localizedApps)[number], locale: (typeof locales)[number]) =>
  Effect.gen(function* messageKeys() {
    const parsed = yield* Schema.decodeEffect(JsonText)(
      yield* appFile(app, "messages", `${locale}.json`),
    );
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return yield* new MessagesNotAnObject({ app, locale });
    }
    return Object.keys(parsed)
      .filter((key) => key !== "$schema")
      .toSorted();
  });

describe("paraglide message catalogs", () => {
  it.for([...localizedApps])("keeps %s locale keys identical", (app) =>
    Effect.runPromise(
      Effect.gen(function* localeKeysIdentical() {
        expect.hasAssertions();
        const [base, ...others] = yield* Effect.forEach(locales, (locale) =>
          messageKeys(app, locale),
        );
        for (const keys of others) {
          expect(keys).toStrictEqual(base);
        }
      }).pipe(Effect.provide(NodeServices.layer)),
    ),
  );

  it.for([...localizedApps])("ships project.inlang settings for %s", (app) =>
    Effect.runPromise(
      Effect.gen(function* inlangSettingsShipped() {
        expect.hasAssertions();
        const settings = yield* Schema.decodeEffect(InlangSettings)(
          yield* appFile(app, "project.inlang", "settings.json"),
        );
        expect(settings.baseLocale).toBe("ja");
        expect(settings.locales).toStrictEqual(["ja", "en"]);
      }).pipe(Effect.provide(NodeServices.layer)),
    ),
  );

  it.for([...localizedApps])("depends on @inlang/paraglide-js in %s", (app) => {
    expect.hasAssertions();
    const workspace = workspaceManifests.find(({ file }) => file === `apps/${app}/package.json`);
    expect(workspace).toBeDefined();
    if (workspace === undefined) {
      return;
    }
    expect(field(field(workspace.manifest, "dependencies"), "@inlang/paraglide-js")).toBe(
      "catalog:",
    );
  });
});
