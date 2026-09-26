import { NodeServices } from "@effect/platform-node";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";

import { directoryEntries, type TreeFailure } from "../platform/directory-entries.ts";
import { pathExists } from "../platform/file-system.ts";

const frontmatterPattern = /^---\n(?<body>[\s\S]*?)\n---\n/u;
const markdownReferencePattern = /`(?<path>[^`\s]+\.md)`/gu;

class SkillFrontmatterUnreadable extends Schema.TaggedError<SkillFrontmatterUnreadable>()(
  "SkillFrontmatterUnreadable",
  { skill: Schema.String, reason: Schema.Literals(["missing", "not-a-mapping"]) },
) {}

const skillsDirectory = Effect.gen(function* skillsDirectory() {
  const paths = yield* Path.Path;
  return paths.join(repositoryRoot, ".claude/skills");
});

const skillNames = await Effect.runPromise(
  Effect.gen(function* skillNames() {
    const entries = yield* directoryEntries(yield* skillsDirectory);
    return entries
      .filter((entry) => entry.kind === "directory")
      .map((entry) => entry.name)
      .toSorted((left, right) => left.localeCompare(right));
  }).pipe(Effect.provide(NodeServices.layer)),
);

const markdownFiles = (
  directory: string,
): Effect.Effect<readonly string[], TreeFailure, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* collectMarkdown() {
    const paths = yield* Path.Path;
    const entries = yield* directoryEntries(directory);
    const nested = yield* Effect.forEach(entries, (entry) => {
      const entryPath = paths.join(directory, entry.name);
      if (entry.kind === "directory") {
        return markdownFiles(entryPath);
      }
      return Effect.succeed(entry.kind === "file" && entry.name.endsWith(".md") ? [entryPath] : []);
    });
    return nested.flat();
  });

const frontmatter = (skill: string) =>
  Effect.gen(function* frontmatter() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const source = yield* filesystem.readFileString(
      paths.join(yield* skillsDirectory, skill, "SKILL.md"),
    );
    const body = frontmatterPattern.exec(source)?.groups?.["body"];
    if (body === undefined) {
      return yield* new SkillFrontmatterUnreadable({ reason: "missing", skill });
    }
    const parsed: unknown = parse(body);
    if (typeof parsed !== "object" || parsed === null) {
      return yield* new SkillFrontmatterUnreadable({ reason: "not-a-mapping", skill });
    }
    return Object.fromEntries(Object.entries(parsed));
  });

const unresolvedReferences = (skill: string) =>
  Effect.gen(function* unresolvedReferences() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const files = yield* markdownFiles(paths.join(yield* skillsDirectory, skill));
    const unresolved = yield* Effect.forEach(files, (file) =>
      Effect.gen(function* unresolvedIn() {
        const referenced = [
          ...(yield* filesystem.readFileString(file)).matchAll(markdownReferencePattern),
        ]
          .map((match) => match.groups?.["path"] ?? "")
          .filter((reference) => !reference.includes("*") && !reference.includes("<"));
        const missing = yield* Effect.filter(referenced, (reference) =>
          Effect.map(
            Effect.forEach([paths.dirname(file), repositoryRoot], (base) =>
              pathExists(paths.join(base, reference)),
            ),
            (found) => !found.includes(true),
          ),
        );
        return missing.map((reference) => `${paths.relative(repositoryRoot, file)}: ${reference}`);
      }),
    );
    return unresolved.flat();
  });

describe(".claude/skills", () => {
  it.each(skillNames)("%s declares its directory name and a description", (skill) =>
    Effect.runPromise(
      Effect.gen(function* declaresNameAndDescription() {
        const { name, description } = yield* frontmatter(skill);

        expect({
          name,
          hasDescription: typeof description === "string" && description.trim() !== "",
        }).toStrictEqual({
          name: skill,
          hasDescription: true,
        });
      }).pipe(Effect.provide(NodeServices.layer)),
    ),
  );

  it.each(skillNames)("%s references only files that exist", (skill) =>
    Effect.runPromise(
      Effect.gen(function* referencesExistingFiles() {
        expect(yield* unresolvedReferences(skill)).toStrictEqual([]);
      }).pipe(Effect.provide(NodeServices.layer)),
    ),
  );
});
