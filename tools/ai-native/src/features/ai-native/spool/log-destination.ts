import { Effect } from "effect";

import { fileExists, paths } from "../host.ts";

const findSpoolRoot = (currentDir: string, fallbackDir: string): Effect.Effect<string, Error> =>
  fileExists(paths.join(currentDir, "package.json")).pipe(
    Effect.flatMap((manifestFound) => {
      if (manifestFound) {
        return Effect.succeed(paths.join(currentDir, ".spool"));
      }
      const parent = paths.dirname(currentDir);
      return parent === currentDir
        ? Effect.succeed(paths.join(fallbackDir, ".spool"))
        : findSpoolRoot(parent, fallbackDir);
    }),
  );

export const defaultSpoolRoot = (startDir: string = process.cwd()): Effect.Effect<string, Error> =>
  findSpoolRoot(paths.resolve(startDir), paths.resolve(startDir));

export const timestampOf = (stampedInstant: Date): string =>
  `${stampedInstant.toISOString().slice(0, 19).replaceAll(/[:-]/g, "")}Z`;

export const commandIdOf = (command: readonly [string, ...string[]]): string =>
  [command[0].split(/[\\/]/u).at(-1) ?? command[0], ...command.slice(1, 2)]
    .join(" ")
    .replaceAll(/[^\w-]+/g, "-")
    .slice(0, 40);
