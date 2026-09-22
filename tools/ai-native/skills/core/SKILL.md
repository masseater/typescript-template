---
name: core
description: >
  Wrap heavy commands with @repo/ai-native: `throttle` caps simultaneous executions per host and namespace and can kill a process tree on `--timeout`, `spool` diverts a child's merged output into a `.spool/` log file and prints a fixed-size summary in its place, `unabridged` is a Claude Code PreToolUse hook that denies `head` and `tail` at a command position, `sync-base` is a Claude Code SessionStart / UserPromptSubmit / Stop hook that instructs catching up when an open pull request is behind its base, and `@repo/ai-native-telemetry` starts one OpenTelemetry provider per process. Load when wiring an entry point with these wrappers, when a wrapped command waits for a slot or looks hung, when you need the full log behind a spool summary line, when a Bash call was denied for slicing its output, when a pull request fell behind its base, or when a workspace has to declare its own measurement through `MST_TELEMETRY` and `OTEL_EXPORTER_OTLP_ENDPOINT`.

metadata:
  type: core
  library: "@repo/ai-native"
  library_version: "0.0.0"
sources:
  - "masseater/mst:tools/ai-native/src/throttle/usage.ts"
  - "masseater/mst:tools/ai-native/src/spool/run-spool.ts"
  - "masseater/mst:tools/ai-native/src/unabridged/find-slicing-commands.ts"
  - "masseater/mst:tools/ai-native/src/sync-base/decision.ts"
  - "masseater/mst:tools/ai-native-telemetry/src/telemetry/telemetry.ts"
  - "masseater/mst:tools/ai-native/AGENTS.md"
---

# @repo/ai-native — throttle, spool, unabridged, and sync-base

Two finite resources break when several agents and humans run heavy commands on one machine. The host's CPU, memory, and disk bandwidth are the first; `throttle` bounds them by capping how many wrapped commands run at once. The caller's context window is the second; `spool` bounds it by writing the child's output to a file and returning a fixed-size summary in its place, and `unabridged` closes the other side of it by refusing the commands that read a slice instead of the whole record. A third failure mode is a pull request whose base moved while the agent kept working: `sync-base` closes that by injecting an instruction to catch up whenever GitHub reports the head as `BEHIND`.

Both wrappers read their own options first, then `--`, then the command. Everything after `--` is passed through untouched.

## requires

- **A local filesystem for the slot area.** `throttle` puts its slots in the operating system's temporary directory and relies on OS file locks to release them when a holder exits. NFS and SMB do not provide that contract, so a slot area on a network filesystem lets two runs hold the same slot while both report success.
- **Claude Code, for `unabridged` and `sync-base`.** Both are hooks, not wrappers: each reads a hook payload on stdin and writes a decision on stdout. Invoked from a terminal with no payload either exits with `Unexpected end of JSON input`, which is the hook contract working, not a broken install. `sync-base` also needs `gh` on `PATH` and a repository where the current branch may have an open pull request.
- **A reachable sink, whenever `MST_TELEMETRY` is set.** Telemetry is off unless that variable is defined, and an export failure sets `process.exitCode = 1` and writes the reason to stderr. A command that succeeded still reports failure when the sink is down, so unset the variable rather than leaving it pointed at nothing.

## Setup

Wrap the entry point every caller already runs, and let the wrapped script own the sequence:

```json
{
  "scripts": {
    "guard": "throttle --timeout 1800 -- spool -- vp run guard:all",
    "guard:all": "vp check && vp run -r test --coverage"
  }
}
```

`throttle` goes outside and `spool` inside, always. `throttle` announces its queue position on stderr, so the reversed order writes those announcements into the log file and a queued run becomes indistinguishable from a hung one.

## Core Patterns

### Read the record instead of re-running the command

`spool` prints the command line, the log path with its size, and the outcome; on a non-zero exit it appends the last 20 recorded lines. Everything else is in the file.

```sh
spool -- vp run -r test
# spool: command: vp run -r test
# spool: log: /<repo>/.spool/20260815T030615Z-vp-run-df438630.log (10979 bytes, 187 lines)
# spool: exit: 0 (6m05s)
```

Open the named file with an editor or a file-reading tool. A second run with a filter attached pays the command's cost again and observes a different execution, so a non-deterministic failure recorded the first time is absent from the second.

### Cap what the host runs at once

```sh
MST_THROTTLE_LIMIT=3 throttle --timeout 1800 -- spool -- vp run guard:all
```

The limit is shared by every `throttle` on this host and namespace, and it defaults to 1. Non-integer values, zero, and negatives fall back to that default rather than failing. When every slot is held the wrapper joins a wait queue and reports its position on stderr; `--timeout` stops the whole process tree, with SIGTERM then SIGKILL on POSIX and `taskkill /T /F` on Windows, and `0` never interrupts.

### Refuse the commands that read a slice

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "unabridged" }] }]
  }
}
```

The hook denies the tool call when `head` or `tail` stands at a command position: the first word, or the word after `|`, `||`, `&&`, `|&`, `;`, `;;`, `&`, `(`, or `<(`. Leading directories are ignored, so `/usr/bin/tail` counts. Words in other positions are left alone — `git rev-parse HEAD`, `echo 'tail'`, `cat headers.txt`, and `vp test > tail` all pass. A passing call produces no output at all.

### Instruct catching up when a pull request is behind its base

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "sync-base" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "sync-base" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "sync-base" }] }]
  }
}
```

The hook calls `gh pr view --json number,url,baseRefName,mergeStateStatus` in the payload's `cwd`. When that pull request's `mergeStateStatus` is `BEHIND`, it returns `hookSpecificOutput.additionalContext` naming the pull request, its base, and how to bring the latest base in (`git fetch` plus rebase/merge, or `mergify stack sync`). Any other status, a missing pull request, or a failed `gh` call produces no output. Where `sync-base` is not on `PATH`, `vp exec sync-base` reaches it.

### Start the provider once, at the process entry

```ts
import { startTelemetry } from "@repo/ai-native-telemetry";

const telemetry = startTelemetry("my-command");
```

`startTelemetry` is memoized for the life of the process, so the first caller fixes `service.name` for everything measured in it. Shutdown is registered on `beforeExit` through a microtask, which puts it after every other `beforeExit` handler regardless of registration order; anything of your own that must run before the exporter stops has to register its own handler rather than rely on ordering.

For Vitest, hand the shipped entry to `experimental.openTelemetry.sdkPath` as an absolute path — the option is resolved against Vitest's `root`, which is the package directory, not the repository root:

```ts
import { fileURLToPath } from "node:url";

const sdkPath = fileURLToPath(import.meta.resolve("@repo/ai-native-telemetry/vitest-sdk"));
```

## Common Mistakes

### [HIGH] wrappers composed with spool on the outside

Wrong:

```sh
spool -- throttle -- vp run guard:all
```

Correct:

```sh
throttle -- spool -- vp run guard:all
```

`throttle` writes its wait-queue position to stderr, and `spool` captures stderr into the log file, so a run waiting behind three others prints the same silent summary as a run that has hung — and the exit code is identical because both are still in progress.

Source: masseater/mst:tools/ai-native/AGENTS.md

### [HIGH] throttle nested inside the command it wraps

Wrong:

```json
{
  "scripts": {
    "guard": "throttle -- vp run test:all",
    "test:all": "throttle -- vp run -r test"
  }
}
```

Correct:

```json
{
  "scripts": {
    "guard": "throttle -- spool -- vp run test:all",
    "test:all": "vp run -r test"
  }
}
```

The inner call competes for the same host and namespace as an independent holder, so one logical run consumes two slots; with the default limit of 1 it waits for a slot its own parent is holding until the wait budget runs out.

Source: masseater/mst:tools/ai-native/src/throttle/usage.ts

### [HIGH] an interactive command wrapped with spool

Wrong:

```sh
spool -- gh auth login
```

Correct:

```sh
gh auth login
```

The prompt is part of the child's output, so it is written to the log file while the terminal stays blank and the child waits for input nobody can see it asking for.

Source: masseater/mst:tools/ai-native/AGENTS.md

### [MEDIUM] a wrapper failure read as the child's exit code

Wrong:

```sh
spool -- vp run -r build
echo "build failed with $?"
```

Correct:

```sh
spool -- vp run -r build
# read the summary: the channel and wording say whether spool or the child failed
```

Recording failures and slot failures make the run report failure even when the child succeeded, and `throttle` uses exit code `1` for both a failing child and a slot it could not acquire or release, so the number alone cannot tell the two apart; the wrapper writes its own reason to stderr.

Source: masseater/mst:tools/ai-native/src/spool/run-spool.ts

### [MEDIUM] telemetry started a second time under a different name

Wrong:

```ts
const first = startTelemetry("lint");
const second = startTelemetry("test");
```

Correct:

```ts
const telemetry = startTelemetry("guard");
```

`startTelemetry` is memoized, so the second call returns the provider the first one built and its service name is discarded — the spans still export, under the wrong service, and nothing reports the substitution.

Source: masseater/mst:tools/ai-native-telemetry/src/telemetry/telemetry.ts

### [MEDIUM] unabridged expected to see inside a nested shell

Wrong:

```sh
bash -c 'vp run -r test | tail -20'
```

Correct:

```sh
spool -- vp run -r test
```

The hook reads command positions of the command line it is handed; `bash -c '...'` collapses to a single string token and `xargs head` puts `head` in an argument position, so both are allowed and the slice happens with no denial to notice.

Source: masseater/mst:tools/ai-native/src/unabridged/find-slicing-commands.ts

## Reference

```
throttle                     exit 0 the child succeeded; 1 the child failed, was
                             killed, could not start, ran past --timeout, or a slot
                             could not be acquired or released; 2 throttle misused
MST_THROTTLE_LIMIT           slots shared per host and namespace; default 1
--timeout <seconds>          stops the child's whole process tree; 0 never does

spool                        exit: the child's own code (128+signal when signalled),
                             127 when the child cannot start, 1 when recording fails,
                             2 on usage errors
.spool/                      one log file per run, never cleaned, discarded with the
                             work tree; located by walking up to the nearest package.json
CI                           set to any non-empty value other than "false" makes spool
                             pass stdio through and write no file

MST_TELEMETRY                defined turns measurement on
OTEL_SDK_DISABLED            "true" turns it back off
OTEL_EXPORTER_OTLP_ENDPOINT  where spans, metrics, and log records are sent
```

Do not delete, rename, or replace `slot-*.lock` while a `throttle` process may be running, and keep the slot area out of any temporary-file cleaner.

## See also

- `tools/dont-review-it/skills/repository-checks` — the single gate these wrappers wrap, and the check that reports a workspace which never declared its own measurement.
