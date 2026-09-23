import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";

import { repositoryRoot } from "./repository-root.ts";

const skillsDirectory = join(repositoryRoot, ".claude/skills");
const frontmatterPattern = /^---\n(?<body>[\s\S]*?)\n---\n/u;
const markdownReferencePattern = /`(?<path>[^`\s]+\.md)`/gu;

const skillNames = readdirSync(skillsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .toSorted((left, right) => left.localeCompare(right));

const markdownFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(entry.parentPath, entry.name));

function frontmatter(skill: string): Record<string, unknown> {
  const source = readFileSync(join(skillsDirectory, skill, "SKILL.md"), "utf8");
  const body = frontmatterPattern.exec(source)?.groups?.["body"];
  if (body === undefined) {
    throw new Error(`${skill}/SKILL.md has no frontmatter`);
  }
  const parsed: unknown = parse(body);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`${skill}/SKILL.md frontmatter is not a mapping`);
  }
  return Object.fromEntries(Object.entries(parsed));
}

function unresolvedReferences(skill: string): string[] {
  return markdownFiles(join(skillsDirectory, skill)).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(markdownReferencePattern)]
      .map((match) => match.groups?.["path"] ?? "")
      .filter((path) => !path.includes("*") && !path.includes("<"))
      .filter((path) => {
        const base = path.startsWith(".claude/") ? repositoryRoot : dirname(file);
        return !existsSync(join(base, path));
      })
      .map((path) => `${relative(repositoryRoot, file)}: ${path}`),
  );
}

describe(".claude/skills", () => {
  it.each(skillNames)("%s declares its directory name and a description", (skill) => {
    const { name, description } = frontmatter(skill);

    expect({
      name,
      hasDescription: typeof description === "string" && description.trim() !== "",
    }).toStrictEqual({
      name: skill,
      hasDescription: true,
    });
  });

  it.each(skillNames)("%s references only files that exist", (skill) => {
    expect(unresolvedReferences(skill)).toStrictEqual([]);
  });
});
