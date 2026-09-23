import { describe, expect, test } from "vite-plus/test";

import { findWorktreeAdds, unresolvedWord } from "./find-worktree-adds.ts";

describe("findWorktreeAdds", () => {
  const it = test
    .extend("plainAdds", () => findWorktreeAdds("git worktree add .claude/worktrees/x"))
    .extend("branchedAdds", () =>
      findWorktreeAdds("git worktree add -b feature --lock --reason wip ../x origin/main"),
    )
    .extend("directoryAdds", () => findWorktreeAdds("git -C repo -c a=b worktree add x"))
    .extend("chainedAdds", () => findWorktreeAdds("git fetch && cd repo; git worktree add -- -x"))
    .extend("assignedAdds", () => findWorktreeAdds("GIT_TRACE=1 /usr/bin/git worktree add x"))
    .extend("variableAdds", () => findWorktreeAdds('git worktree add "$HOME/x"'))
    .extend("globAdds", () => findWorktreeAdds("git worktree add x*"))
    .extend("missingPathAdds", () => findWorktreeAdds("git worktree add -b feature"))
    .extend("otherSubcommandAdds", () => findWorktreeAdds("git worktree list; git add x"))
    .extend("assignmentOnlyAdds", () => findWorktreeAdds("GIT_DIR=x"))
    .extend("echoedAdds", () => findWorktreeAdds("echo git worktree add x"));

  it("reads the path of a plain add", ({ plainAdds }) => {
    expect(plainAdds).toStrictEqual([{ directories: [], target: ".claude/worktrees/x" }]);
  });

  it("skips the options and their values before the path", ({ branchedAdds }) => {
    expect(branchedAdds).toStrictEqual([{ directories: [], target: "../x" }]);
  });

  it("keeps the -C directories the path is relative to", ({ directoryAdds }) => {
    expect(directoryAdds).toStrictEqual([{ directories: ["repo"], target: "x" }]);
  });

  it("finds an add chained after other commands and honours --", ({ chainedAdds }) => {
    expect(chainedAdds).toStrictEqual([{ directories: [], target: "-x" }]);
  });

  it("finds git behind environment assignments and an absolute path", ({ assignedAdds }) => {
    expect(assignedAdds).toStrictEqual([{ directories: [], target: "x" }]);
  });

  it("keeps a variable in the path unexpanded", ({ variableAdds }) => {
    expect(variableAdds).toStrictEqual([{ directories: [], target: "$HOME/x" }]);
  });

  it("marks a glob path as unresolved", ({ globAdds }) => {
    expect(globAdds).toStrictEqual([{ directories: [], target: unresolvedWord }]);
  });

  it("reports an add without a path", ({ missingPathAdds }) => {
    expect(missingPathAdds).toStrictEqual([{ directories: [], target: undefined }]);
  });

  it("ignores other git subcommands", ({ otherSubcommandAdds }) => {
    expect(otherSubcommandAdds).toStrictEqual([]);
  });

  it("ignores a command made of assignments alone", ({ assignmentOnlyAdds }) => {
    expect(assignmentOnlyAdds).toStrictEqual([]);
  });

  it("ignores git words that are arguments of another command", ({ echoedAdds }) => {
    expect(echoedAdds).toStrictEqual([]);
  });
});
