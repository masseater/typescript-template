import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { repositoryRoot } from "./repository-root.ts";

const ClaudeSettings = Schema.Struct({
  hooks: Schema.Record(
    Schema.String,
    Schema.Array(
      Schema.Struct({
        hooks: Schema.Array(Schema.Struct({ command: Schema.String })),
      }),
    ),
  ),
});

const packageScriptPattern =
  /vp exec -F (?<workspace>@repo\/[\w-]+) -- node --experimental-strip-types (?<script>\S+)/u;

const workspaceDirectories: Readonly<Record<string, string>> = {
  "@repo/ai-native": "tools/ai-native",
};

const registeredCommands = Object.values(
  Schema.decodeUnknownSync(Schema.fromJsonString(ClaudeSettings))(
    readFileSync(join(repositoryRoot, ".claude/settings.json"), "utf8"),
  ).hooks,
)
  .flat()
  .flatMap((matcherGroup) => matcherGroup.hooks.map((registered) => registered.command));

const unreachableScripts = registeredCommands.flatMap((command) => {
  const groups = packageScriptPattern.exec(command)?.groups;
  if (groups?.["workspace"] === undefined || groups["script"] === undefined) {
    return [];
  }
  const directory = workspaceDirectories[groups["workspace"]];
  return directory !== undefined && existsSync(join(repositoryRoot, directory, groups["script"]))
    ? []
    : [command];
});

describe(".claude/settings.json", () => {
  it("runs every workspace hook through a script that exists", () => {
    expect(unreachableScripts).toStrictEqual([]);
  });

  it("runs every hook command from the project directory", () => {
    expect(
      registeredCommands.filter((command) => !command.startsWith('cd "$CLAUDE_PROJECT_DIR" && ')),
    ).toStrictEqual([]);
  });
});
