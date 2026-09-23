import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { Effect, Schema } from "effect";

import {
  contentRules,
  leaks,
  PREFIX_KEY,
  prefixScan,
  privateFile,
  type DeploymentValue,
  type PrefixScan,
} from "./secrets.ts";

const MAX_OUTPUT_BYTES = 33_554_432;
const run = promisify(execFile);

class IndexUnreadable extends Schema.TaggedError<IndexUnreadable>()("IndexUnreadable", {
  command: Schema.optional(Schema.String),
  exitCode: Schema.optional(Schema.Number),
  files: Schema.optional(Schema.Array(Schema.String)),
  reason: Schema.Literals(["git-command-failed", "unmerged-index"]),
}) {
  public get report(): Readonly<Record<string, unknown>> {
    const fields: Readonly<Record<string, unknown>> = {
      command: this.command,
      exitCode: this.exitCode,
      files: this.files,
      reason: this.reason,
    };
    return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  }
}

const exitCodeOf = (error: unknown): number | undefined => {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number"
    ? error.code
    : undefined;
};

const gitOutput = (
  root: string,
  args: readonly string[],
  emptyOnNoMatch: boolean,
): Effect.Effect<string, IndexUnreadable> => {
  return Effect.tryPromise({
    catch: (error) =>
      new IndexUnreadable({
        command: args.join(" "),
        exitCode: exitCodeOf(error),
        reason: "git-command-failed",
      }),
    try: async () => {
      try {
        const listing = await run("git", [...args], {
          cwd: root,
          maxBuffer: MAX_OUTPUT_BYTES,
        });
        return listing.stdout;
      } catch (error) {
        if (emptyOnNoMatch && exitCodeOf(error) === 1) {
          return "";
        }
        throw error;
      }
    },
  });
};

const zeroSeparated = (listing: string): string[] => {
  return listing.split("\0").filter((entry) => entry !== "");
};

const listCachedFiles = (root: string): Effect.Effect<readonly string[], IndexUnreadable> => {
  return Effect.map(gitOutput(root, ["ls-files", "--cached", "-z"], false), zeroSeparated);
};

const refuseUnmerged = (root: string): Effect.Effect<void, IndexUnreadable> => {
  return Effect.flatMap(gitOutput(root, ["ls-files", "--unmerged", "-z"], false), (listing) => {
    const files = [
      ...new Set(zeroSeparated(listing).map((entry) => entry.split("\t").at(-1) ?? entry)),
    ];
    return files.length > 0
      ? Effect.fail(new IndexUnreadable({ files, reason: "unmerged-index" }))
      : Effect.void;
  });
};

const filesMatchingFixed = (
  root: string,
  value: string,
): Effect.Effect<readonly string[], IndexUnreadable> => {
  return Effect.map(
    gitOutput(root, ["grep", "--cached", "-l", "-z", "-F", "-e", value], true),
    zeroSeparated,
  );
};

const filesMatchingPerl = (
  root: string,
  pattern: string,
): Effect.Effect<readonly string[], IndexUnreadable> => {
  return Effect.map(
    gitOutput(root, ["grep", "--cached", "-l", "-z", "-P", "-e", pattern], true),
    zeroSeparated,
  );
};

const showCached = (root: string, filename: string): Effect.Effect<string, IndexUnreadable> => {
  return gitOutput(root, ["show", `:${filename}`], false);
};

const addedText = (root: string): Effect.Effect<ReadonlyMap<string, string>, IndexUnreadable> => {
  return Effect.map(
    gitOutput(root, ["diff", "--cached", "--unified=0", "--no-color", "--no-ext-diff"], true),
    (diff) => {
      const added = new Map<string, string[]>();
      let filename = "";
      for (const line of diff.split("\n")) {
        if (line.startsWith("+++ b/")) {
          filename = line.slice("+++ b/".length);
          continue;
        }
        if (filename === "" || !line.startsWith("+") || line.startsWith("+++")) {
          continue;
        }
        const lines = added.get(filename) ?? [];
        lines.push(line.slice(1));
        added.set(filename, lines);
      }
      return new Map([...added.entries()].map(([name, lines]) => [name, lines.join("\n")]));
    },
  );
};

const prefixScanForIndex = Effect.fn("prefixScanForIndex")(function* prefixScanForIndex(
  root: string,
  environmentValues: readonly DeploymentValue[],
) {
  const prefix = environmentValues.find((entry) => entry.key === PREFIX_KEY)?.value;
  if (prefix === undefined) {
    return "word" as const satisfies PrefixScan;
  }
  const files = yield* filesMatchingFixed(root, prefix);
  if (files.length === 0) {
    return "word" as const satisfies PrefixScan;
  }
  const contents = yield* Effect.forEach(files, (filename) => showCached(root, filename));
  return prefixScan(environmentValues, contents);
});

type Hit = readonly [filename: string, rule: string];

type IndexHit = {
  readonly filename: string;
  readonly rules: readonly string[];
};

const deploymentValueHits = (
  introduced: ReadonlyMap<string, string>,
  environmentValues: readonly DeploymentValue[],
  scan: PrefixScan,
): readonly Hit[] =>
  environmentValues.flatMap((entry) =>
    [...introduced]
      .filter(([, content]) => leaks(content, entry, scan))
      .map(([filename]): Hit => [filename, `deployment-value:${entry.key}`]),
  );

const groupedHits = (hits: readonly Hit[]): readonly IndexHit[] => {
  const rulesByFile = new Map<string, Set<string>>();
  for (const [filename, rule] of hits) {
    rulesByFile.set(filename, (rulesByFile.get(filename) ?? new Set<string>()).add(rule));
  }
  return [...rulesByFile]
    .map(([filename, rules]) => ({ filename, rules: [...rules].toSorted() }))
    .toSorted((left, right) => left.filename.localeCompare(right.filename));
};

const indexSecretHits = Effect.fn("indexSecretHits")(function* indexSecretHits(
  root: string,
  environmentValues: readonly DeploymentValue[],
) {
  yield* refuseUnmerged(root);
  const scan = yield* prefixScanForIndex(root, environmentValues);
  const cached = yield* listCachedFiles(root);
  const contentHits = yield* Effect.forEach(Object.entries(contentRules), ([rule, pattern]) =>
    Effect.map(filesMatchingPerl(root, pattern.source), (files) =>
      files.map((filename): Hit => [filename, rule]),
    ),
  );
  const introduced = yield* addedText(root);
  return {
    hits: groupedHits([
      ...cached.filter(privateFile).map((filename): Hit => [filename, "private-file"]),
      ...contentHits.flat(),
      ...deploymentValueHits(introduced, environmentValues, scan),
    ]),
    scan,
  };
});

export { indexSecretHits };
