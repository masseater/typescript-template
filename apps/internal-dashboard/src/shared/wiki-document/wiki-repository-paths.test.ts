import { NodeServices } from "@effect/platform-node";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

const wikiPages: Readonly<Record<string, string>> = import.meta.glob(
  ["../../../content/docs/**/*.md", "!../../../content/docs/plans/**"],
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
);

const repositoryPaths = Object.entries(wikiPages).flatMap(([page, markdown]) =>
  [...markdown.matchAll(/`(?<path>(?:apps|infra|libs|tools)\/[^`\s]+)`/gu)].map((match) => ({
    page: page.replace("../../../content/docs/", ""),
    path: match.groups?.["path"] ?? "",
  })),
);

describe("repository paths named in the wiki", () => {
  it("are collected from the wiki pages", () => {
    expect(repositoryPaths.length).toBeGreaterThan(0);
  });

  it.each(repositoryPaths)("$path named in $page exists", ({ path: relative }) =>
    Effect.runPromise(
      Effect.gen(function* pathExists() {
        expect.hasAssertions();
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        expect(yield* fileSystem.exists(path.join(repositoryRoot, relative))).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer)),
    ),
  );
});
