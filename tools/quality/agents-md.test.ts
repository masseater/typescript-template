// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { instructionViolations, repositoryRoot, workspaceDirectories } from "./agents-md.ts";
import { workspaceManifests } from "./dependencies.ts";

interface Layout {
  readonly files: readonly string[];
  readonly links: readonly (readonly [string, string])[];
  readonly name: string;
  readonly violations: number;
}

const bothMissing = 2;
const directory = "libs/probe";

const layouts: readonly Layout[] = [
  {
    files: ["AGENTS.md"],
    links: [["AGENTS.md", "CLAUDE.md"]],
    name: "instructions and a link to them",
    violations: 0,
  },
  { files: ["AGENTS.md"], links: [], name: "instructions without a link", violations: 1 },
  {
    files: ["AGENTS.md", "OTHER.md"],
    links: [["OTHER.md", "CLAUDE.md"]],
    name: "a link to another file",
    violations: 1,
  },
  {
    files: ["AGENTS.md", "CLAUDE.md"],
    links: [],
    name: "a plain file instead of a link",
    violations: 1,
  },
  { files: [], links: [], name: "nothing", violations: bothMissing },
];

async function build(root: string, layout: Layout): Promise<void> {
  const target = path.join(root, directory);
  await mkdir(target, { recursive: true });
  await Promise.all(
    layout.files.map(async (name) => writeFile(path.join(target, name), `# ${name}`)),
  );
  await Promise.all(
    layout.links.map(async ([source, name]) => symlink(source, path.join(target, name))),
  );
}

describe("workspace instruction files", () => {
  it.for(layouts)("counts the violations of a workspace with $name", async (layout) => {
    expect.assertions(1);
    const root = await mkdtemp(path.join(tmpdir(), "agents-md-"));
    try {
      await build(root, layout);
      await expect(instructionViolations(root, [directory])).resolves.toHaveLength(
        layout.violations,
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("every repository workspace carries AGENTS.md and a CLAUDE.md symlink", async () => {
    expect.hasAssertions();
    const directories = workspaceDirectories(workspaceManifests);
    expect(directories).toStrictEqual(expect.arrayContaining(["libs/db", "tools/observe"]));
    await expect(instructionViolations(repositoryRoot, directories)).resolves.toStrictEqual([]);
  });
});
