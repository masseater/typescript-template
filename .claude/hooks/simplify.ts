import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path, Stream, String as Str } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { blockWhen, projectRoot, runHookWith } from "./env.ts";

const WORKTREES = "/.claude/worktrees/";
const NO_COMMITS = "0";

type Worktree = Readonly<{ root: string; sha: string; name: string; directory: string }>;

const run = Effect.fn("run")(function* run(cwd: string, command: string, args: readonly string[]) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(ChildProcess.make(command, args, { cwd }));
  const [stdout, stderr] = yield* Effect.all(
    [
      handle.stdout.pipe(Stream.decodeText, Stream.mkString),
      handle.stderr.pipe(Stream.decodeText, Stream.mkString),
      handle.exitCode,
    ],
    { concurrency: "unbounded" },
  );
  return { stdout: Str.trim(stdout), output: `${stdout}${stderr}` };
}, Effect.scoped);

const openWorktree = Effect.fn("openWorktree")(function* openWorktree(root: string) {
  const path = yield* Path.Path;
  const { stdout: sha } = yield* run(root, "git", ["rev-parse", "--short", "HEAD"]);
  const name = `simplify-${sha}`;
  const directory = path.join(root, ".claude", "worktrees", name);
  yield* run(root, "git", ["worktree", "add", "--quiet", "-b", name, directory, "HEAD"]);
  return { root, sha, name, directory } satisfies Worktree;
});

const review = Effect.fn("review")(function* review({ root, sha, directory }: Worktree) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const vp = path.join(root, "node_modules", ".bin", "vp");
  const install = yield* run(directory, vp, ["install", "--frozen-lockfile"]);
  const simplified = yield* run(directory, "claude", [
    "-p",
    `/simplify 対象はコミット ${sha} の変更である。簡潔にできたら vp run verify を通してこのブランチにコミットする。`,
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    "Bash(git *)",
    "Bash(vp *)",
  ]);
  yield* fileSystem.writeFileString(`${directory}.log`, `${install.output}${simplified.output}`);
  yield* run(root, "git", ["worktree", "remove", "--force", directory]);
});

const report = Effect.fn("report")(function* report({ root, sha, name, directory }: Worktree) {
  const path = yield* Path.Path;
  const { stdout: commits } = yield* run(root, "git", ["rev-list", "--count", `${sha}..${name}`]);
  if (commits === NO_COMMITS) {
    yield* run(root, "git", ["branch", "--quiet", "-D", name]);
    return;
  }
  const log = path.relative(root, `${directory}.log`);
  yield* blockWhen([
    `コミット ${sha} を /simplify した結果がブランチ ${name} にある。差分を確認し、取り込むか判断すること。ログは ${log} にある。`,
  ]);
});

const simplify = Effect.gen(function* simplify() {
  const root = yield* projectRoot;
  if (Str.includes(WORKTREES)(root)) {
    return;
  }
  const worktree = yield* openWorktree(root);
  yield* review(worktree);
  yield* report(worktree);
});

runHookWith(nodeServicesLayer)(simplify);
