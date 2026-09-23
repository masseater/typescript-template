import { defineCommand } from "citty";

import { checkCommand } from "./check-command.ts";
import { checkRepositoryCommand } from "./check-repository-command.ts";

export const dontReviewItCommand = defineCommand({
  meta: {
    name: "dont-review-it",
    description: "Run the checks that keep review questions answered by machines.",
  },
  subCommands: {
    check: checkCommand,
    "check-repository": checkRepositoryCommand,
  },
});
