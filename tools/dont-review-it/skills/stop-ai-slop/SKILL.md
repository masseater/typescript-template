---
name: stop-ai-slop
description: >
  Stop absence checks that only fossilize a removal, with @repo/dont-review-it: `dont-review-it check-repository` runs stop-ai-slop beside the other repository gates, compares the change on its way into the integration branch — the staged merge result during a merge, the history since `origin/main` otherwise — and reports every assertion added by the same change that deleted its subject. `--repository-root` picks the repository. Load when a report names a removal verification, when adding a check to `src/check-registry.ts`, when deciding which two revisions the comparison should use, or when the command refuses because no comparison could be resolved.

metadata:
  type: core
  library: "@repo/dont-review-it"
  library_version: "0.0.0"
sources:
  - "masseater/mst:tools/dont-review-it/src/stop-ai-slop/comparison-range.ts"
  - "masseater/mst:tools/dont-review-it/src/stop-ai-slop/check-registry.ts"
  - "masseater/mst:tools/dont-review-it/AGENTS.md"
---

# @repo/dont-review-it — stop the checks that only restate a removal

A change that deletes a file or an export sometimes gains a test pinning the absence of what it just deleted. Read on its own, that assertion is indistinguishable from an ordinary negative one — which is why the check reads the change instead of the file, and reports an absence assertion only when the same change removed its subject.

Only facts that are decidable from the two revisions are in scope. The commit message, the request that prompted the change, and any resemblance between names are not consulted.

## requires

- **A resolvable comparison.** The range comes from `MERGE_HEAD` while a merge is in progress, and otherwise from the merge base of `origin/main` and `HEAD`. A checkout holding the merge of a pull request together with its parents compares the merge against its first parent, so a depth-one pull request checkout only needs `git fetch --depth=2 origin <merge>`. Without the parents it falls back to the GitHub API when `GITHUB_REPOSITORY` and `GITHUB_TOKEN` are set, and refuses an answer that lists no files, reaches the 300-file limit of the compare endpoint, or leaves out the diff of a changed text file. With none of these there is nothing to compare, so run it where the integration branch or the merge parents are fetched.
- **Git readable from the process.** A failure to read the parser, git, a revision, or a source is reported as a usage error and stops the run; an unreadable change is never counted as a clean one.

## Setup

```sh
vp run check:repository
```

The task runs `dont-review-it check-repository`, which runs stop-ai-slop after the other repository gates. It compares the change on its way into the integration branch: during a merge, the merge base of `HEAD` and `MERGE_HEAD` against the staged result; otherwise the merge base of `origin/main` and `HEAD` against `HEAD`.

Point it at another checkout with `--repository-root`:

```sh
dont-review-it check-repository --repository-root <path>
```

## Core Patterns

### Delete an export without pinning its absence

Delete the export and the code that used it. The deletion is the record; nothing else is required.

```ts
// src/legacy.ts
export const current = true;
```

### Add a check to the registry

A new check is a `SlopCheck` — an `id` and a `run` that takes the comparison and returns problems — added to the ordered list in `src/check-registry.ts`. The list order is the order the checks run and the first order of the output. No subcommand is added for it.

```ts
export const CHECKS: readonly SlopCheck[] = [noRemovalVerification, myNewCheck];
```

### Relate a removal to an addition through a static locator

A new check reports only when it can tie something the change removed to something the change added, by a locator both sides recover from the source text. When the locator cannot be fully recovered, the check stays silent rather than matching on a name — two modules can share a name, and so can a name and a string in a sentence.

## Common Mistakes

### [HIGH] an absence assertion added with the deletion

Wrong:

```ts
import * as legacy from "./legacy.ts";

expect(legacy).not.toHaveProperty("legacyMode");
```

Correct:

```ts
import { current } from "./legacy.ts";

expect(current).toBe(true);
```

The assertion can only fail if someone re-adds the export the same change removed, so it passes forever while reading, to every later reviewer, as a rule the codebase depends on.

Source: masseater/mst:tools/dont-review-it/AGENTS.md

### [MEDIUM] a report suppressed by reshaping the assertion

Wrong:

```ts
expect(legacy).not.toHaveProperty(String("legacyMode"));
```

Correct:

```ts
// the assertion is deleted
```

Hiding the name behind an expression the locator cannot recover removes the report, not the assertion — and the command has no allowlist, severity, or ignore option precisely so that this is the only way to make one disappear without deleting anything.

Source: masseater/mst:tools/dont-review-it/AGENTS.md

### [MEDIUM] revisions guessed instead of resolved

Wrong:

```sh
git update-ref refs/remotes/origin/main HEAD~1
dont-review-it check-repository
```

Correct:

```sh
git fetch origin main
dont-review-it check-repository
```

`HEAD~1` is the previous commit, not the point the change left the integration branch, so a branch with more than one commit is examined over its last step only — the run succeeds, reports nothing, and every earlier commit's additions go unread.

Source: masseater/mst:tools/dont-review-it/src/stop-ai-slop/comparison-range.ts

### [MEDIUM] a new check published as its own subcommand

Wrong:

```ts
defineCommand({ subCommands: { check, "check-removals": checkRemovals } });
```

Correct:

```ts
export const CHECKS: readonly SlopCheck[] = [noRemovalVerification, checkRemovals];
```

`check-repository` is the only entry, and it runs the registry in definition order; a check reachable only through a second subcommand exists without running until every caller has been updated to name it — and nobody is told that they should.

Source: masseater/mst:tools/dont-review-it/AGENTS.md

## Reference

```
dont-review-it check-repository   the only entry; runs every registered check in definition order
--repository-root <path>          defaults to the current working directory

default range, merge in progress    merge-base(HEAD, MERGE_HEAD) .. the staged tree
default range, otherwise            merge-base(origin/main, HEAD) .. HEAD
pull request merge with parents     first parent .. HEAD
exit                                non-zero as soon as one problem is reported
```

There is no allowlist, no severity, and no ignore option. A construct that misfires is removed from what the check detects, keeping the decidable boundary narrow instead of adding a way to wave a report through.

## See also

- `tools/dont-review-it/skills/repository-checks` — the same single-entry, non-zero-exit gate discipline; `check-repository` runs both.
