import { bashCommandOf } from "../bash-command.ts";
import { findSlicingCommands } from "./find-slicing-commands.ts";
import { denyReasonFor } from "./message.ts";

export const denyReasonOf = (toolName: string, toolInput: unknown): string | undefined => {
  const found = toolName === "Bash" ? findSlicingCommands(bashCommandOf(toolInput)) : [];
  return found.length === 0 ? undefined : denyReasonFor(found);
};
