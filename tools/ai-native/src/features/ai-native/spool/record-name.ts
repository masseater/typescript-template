import { commandIdOf, timestampOf } from "./log-destination.ts";

import type { Command } from "./parse-command.ts";

export const recordNameOf = (input: {
  stampedInstant: Date;
  command: Command;
  uniqueSuffix: string;
}): string =>
  `${timestampOf(input.stampedInstant)}-${commandIdOf(input.command)}-${input.uniqueSuffix}.log`;
